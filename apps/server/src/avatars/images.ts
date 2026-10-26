import sharp from 'sharp';
import { z } from 'zod';
import { RoomError } from '../multiplayer/support.js';
export const cropSchema = z.strictObject({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  size: z
    .number()
    .min(1 / 4)
    .max(1),
});
export type Crop = z.infer<typeof cropSchema>;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export async function optimizeAvatar(
  input: Buffer,
  crop: Crop,
): Promise<{ profile: Buffer; thumbnail: Buffer }> {
  if (input.length === 0 || input.length > MAX_UPLOAD_BYTES)
    throw new RoomError('AVATAR_TOO_LARGE', 413);
  try {
    const jpeg = input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff;
    const png = input
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp =
      input.subarray(0, 4).toString() === 'RIFF' &&
      input.subarray(8, 12).toString() === 'WEBP';
    if (!jpeg && !png && !webp) throw new Error('Unsupported image');
    cropSchema.parse(crop);
    const image = sharp(input, {
      limitInputPixels: 16_000_000,
      animated: false,
      failOn: 'error',
    });
    const metadata = await image.metadata();
    if (
      !['jpeg', 'png', 'webp'].includes(metadata.format ?? '') ||
      (metadata.pages ?? 1) !== 1 ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > 8192 ||
      metadata.height > 8192
    )
      throw new Error('Unsupported image');
    const swap =
      (metadata.orientation ?? 1) >= 5 && (metadata.orientation ?? 1) <= 8;
    const width = swap ? metadata.height : metadata.width;
    const height = swap ? metadata.width : metadata.height;
    const side = Math.floor(Math.min(width, height) * crop.size);
    if (side < 16) throw new Error('Crop too small');
    const left = Math.round((width - side) * crop.x);
    const top = Math.round((height - side) * crop.y);
    // autoOrient before extract; re-encoding strips EXIF/GPS and all source metadata by default.
    const profile = await image
      .autoOrient()
      .extract({ left, top, width: side, height: side })
      .resize(256, 256)
      .webp({ quality: 82 })
      .timeout({ seconds: 5 })
      .toBuffer();
    const thumbnail = await sharp(profile)
      .resize(64, 64)
      .webp({ quality: 78 })
      .toBuffer();
    return { profile, thumbnail };
  } catch {
    throw new RoomError('INVALID_AVATAR', 400);
  }
}

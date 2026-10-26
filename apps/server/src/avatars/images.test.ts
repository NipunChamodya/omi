import { expect, it } from 'vitest';
import sharp from 'sharp';
import { optimizeAvatar } from './images.js';
import { safeGooglePicture } from '../auth/oidc.js';
it('applies horizontal crop coordinates to actual decoded pixels', async () => {
  const raw = Buffer.alloc(128 * 64 * 3);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 128; x++) {
      const at = (y * 128 + x) * 3;
      raw[at] = x < 64 ? 255 : 0;
      raw[at + 1] = x < 64 ? 0 : 255;
    }
  const image = await sharp(raw, {
    raw: { width: 128, height: 64, channels: 3 },
  })
    .png()
    .toBuffer();
  const left = await optimizeAvatar(image, { x: 0, y: 0.5, size: 1 });
  const right = await optimizeAvatar(image, { x: 1, y: 0.5, size: 1 });
  const a = await sharp(left.profile).stats();
  const b = await sharp(right.profile).stats();
  expect(a.channels[0]!.mean).toBeGreaterThan(240);
  expect(a.channels[1]!.mean).toBeLessThan(10);
  expect(b.channels[1]!.mean).toBeGreaterThan(240);
  expect(b.channels[0]!.mean).toBeLessThan(10);
});
it('allows only HTTPS Google-owned avatar URLs and never fetches arbitrary profile URLs', () => {
  expect(safeGooglePicture('https://lh3.googleusercontent.com/a/avatar')).toBe(
    'https://lh3.googleusercontent.com/a/avatar',
  );
  for (const value of [
    'javascript:alert(1)',
    'data:image/svg+xml,x',
    'http://lh3.googleusercontent.com/a',
    'https://googleusercontent.com.evil.example/a',
    'https://user:password@lh3.googleusercontent.com/a',
    'https://169.254.169.254/latest',
    null,
  ])
    expect(safeGooglePicture(value)).toBeNull();
});

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
export type AvatarSize = 'profile' | 'thumbnail';
export interface AvatarStorage {
  put(id: string, size: AvatarSize, bytes: Buffer): Promise<void>;
  get(id: string, size: AvatarSize): Promise<Buffer>;
  remove(id: string): Promise<void>;
  close?(): void;
}
export class S3Avatars implements AvatarStorage {
  private readonly client;
  constructor(
    private readonly bucket: string,
    region: string,
    endpoint?: string,
  ) {
    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      maxAttempts: 2,
    });
  }
  private key(id: string, size: AvatarSize) {
    return `avatars/${id}/${size}.webp`;
  }
  async put(id: string, size: AvatarSize, bytes: Buffer) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key(id, size),
        Body: bytes,
        ContentType: 'image/webp',
        CacheControl: 'max-age=3600',
      }),
      { abortSignal: AbortSignal.timeout(10_000) },
    );
  }
  async get(id: string, size: AvatarSize) {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.key(id, size) }),
      { abortSignal: AbortSignal.timeout(10_000) },
    );
    if (!response.Body) throw new Error('Missing avatar');
    const chunks: Buffer[] = [];
    let length = 0;
    const stream = response.Body as Readable;
    for await (const chunk of stream) {
      const bytes = Buffer.from(chunk);
      length += bytes.length;
      if (length > 262144) {
        stream.destroy();
        throw new Error('Avatar too large');
      }
      chunks.push(bytes);
    }
    return Buffer.concat(chunks);
  }
  async remove(id: string) {
    for (const size of ['profile', 'thumbnail'] as const)
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: this.key(id, size),
        }),
        { abortSignal: AbortSignal.timeout(10_000) },
      );
  }
  close() {
    this.client.destroy();
  }
}

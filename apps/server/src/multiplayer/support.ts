import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { GuestIdentity } from '@omi/shared';

export class RoomError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 409,
    public readonly version: number | null = null,
  ) {
    super(code);
    this.name = 'RoomError';
  }
}
/** Every membership, presence and game mutation uses the same room queue. */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();
  pending = 0;
  constructor(private readonly limit: number) {}
  run<T>(task: () => T | Promise<T>, cleanup = false): Promise<T> {
    if (!cleanup && this.pending >= this.limit)
      return Promise.reject(new RoomError('ROOM_BUSY', 429));
    this.pending++;
    const next = this.tail.then(task);
    this.tail = next
      .catch(() => undefined)
      .finally(() => {
        this.pending--;
      });
    return next;
  }
}
export type Identity = GuestIdentity &
  Readonly<{ tokenHash: string; userId?: string; avatarUrl?: string | null }>;
export class GuestSessions {
  private readonly sessions = new Map<string, Identity>();
  constructor(
    private readonly now: () => number,
    private readonly ttl: number,
    private readonly max: number,
  ) {}
  create(displayName: string): { token: string; identity: Identity } {
    this.sweep();
    if (this.sessions.size >= this.max)
      throw new RoomError('SESSION_CAPACITY', 503);
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hash(token);
    const identity = {
      actorId: randomUUID(),
      displayName,
      expiresAt: this.now() + this.ttl,
      tokenHash,
    };
    this.sessions.set(tokenHash, identity);
    return { token, identity };
  }
  get(token: string | undefined): Identity | undefined {
    if (!token || token.length !== 43) return undefined;
    const identity = this.sessions.get(this.hash(token));
    return identity && this.active(identity) ? identity : undefined;
  }
  active(identity: Identity): boolean {
    return (
      identity.expiresAt > this.now() &&
      this.sessions.get(identity.tokenHash) === identity
    );
  }
  revoke(token: string | undefined): void {
    if (token) this.sessions.delete(this.hash(token));
  }
  sweep(): void {
    for (const [hash, identity] of this.sessions)
      if (identity.expiresAt <= this.now()) this.sessions.delete(hash);
  }
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
/** Bounded fixed-window counters. New keys are refused when capacity is occupied. */
export class RateLimiter {
  private readonly buckets = new Map<
    string,
    { start: number; count: number }
  >();
  constructor(
    private readonly now: () => number,
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 4096,
  ) {}
  take(key: string): boolean {
    const now = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket || now - bucket.start >= this.windowMs) {
      if (!bucket && this.buckets.size >= this.maxKeys) {
        this.sweep();
        if (this.buckets.size >= this.maxKeys) return false;
      }
      bucket = { start: now, count: 0 };
      this.buckets.set(key, bucket);
    }
    return ++bucket.count <= this.limit;
  }
  sweep(): void {
    for (const [key, bucket] of this.buckets)
      if (this.now() - bucket.start >= this.windowMs) this.buckets.delete(key);
  }
}

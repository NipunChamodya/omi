import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PublicProfile } from '@omi/shared';
import type { Identity } from '../multiplayer/support.js';
import { RoomError } from '../multiplayer/support.js';
import type { AccountRepository } from '../persistence/repository.js';
import type { UserRecord } from '../persistence/schema.js';
import type { IdentityProvider } from './oidc.js';
import type { AvatarStorage } from '../avatars/storage.js';
import type { Crop } from '../avatars/images.js';
import { optimizeAvatar } from '../avatars/images.js';
import { randomUUID } from 'node:crypto';
export const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
export const publicProfile = (user: UserRecord): PublicProfile => ({
  id: user.id,
  displayName: user.displayName,
  googleAvatarUrl: user.googleAvatarUrl,
  avatarUrl: user.avatarId ? `/avatars/${user.avatarId}/profile.webp` : null,
  thumbnailUrl: user.avatarId
    ? `/avatars/${user.avatarId}/thumbnail.webp`
    : null,
  version: user.version,
});
type CachedSession = {
  identity: Identity;
  csrfToken: string;
  profile: PublicProfile;
};
export class Accounts {
  private readonly cache = new Map<string, CachedSession>();
  private processing = 0;
  private collecting = false;
  private closed = false;
  onProfileChange: (profile: PublicProfile) => Promise<void> = async () =>
    undefined;
  constructor(
    readonly repo: AccountRepository,
    readonly provider: IdentityProvider | null,
    readonly storage: AvatarStorage | null,
    readonly callback: string,
    private readonly now: () => number = Date.now,
  ) {}
  get(token: string | undefined): CachedSession | undefined {
    if (!token || token.length !== 43) return undefined;
    const hash = digest(token);
    let cached = this.cache.get(hash);
    if (cached) {
      if (cached.identity.expiresAt > this.now()) return cached;
      this.cache.delete(hash);
      return undefined;
    }
    const row = this.repo.session(hash);
    if (!row || row.expiresAt <= this.now()) return undefined;
    const user = this.repo.user(row.userId);
    if (!user) return undefined;
    this.pruneCache();
    if (this.cache.size >= 1000) throw new RoomError('SESSION_CAPACITY', 503);
    const profile = publicProfile(user);
    cached = {
      identity: null as unknown as Identity,
      csrfToken: row.csrfToken,
      profile,
    };
    const holder = cached;
    holder.identity = Object.freeze({
      actorId: user.id,
      userId: user.id,
      tokenHash: hash,
      expiresAt: row.expiresAt,
      get displayName() {
        return holder.profile.displayName;
      },
      get avatarUrl() {
        return holder.profile.thumbnailUrl ?? holder.profile.googleAvatarUrl;
      },
    });
    this.cache.set(hash, holder);
    return holder;
  }
  active(identity: Identity): boolean {
    return (
      this.cache.get(identity.tokenHash)?.identity === identity &&
      identity.expiresAt > this.now()
    );
  }
  requireCsrf(identity: Identity, value: unknown): void {
    const expected = this.cache.get(identity.tokenHash)?.csrfToken;
    if (
      !this.active(identity) ||
      !expected ||
      typeof value !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(value) ||
      value.length !== expected.length ||
      !timingSafeEqual(Buffer.from(value), Buffer.from(expected))
    )
      throw new RoomError('CSRF_REJECTED', 403);
  }
  async begin(returnTo: string) {
    if (!this.provider) throw new RoomError('GOOGLE_NOT_CONFIGURED', 503);
    this.repo.prune(this.now());
    const binding = secret();
    const transaction = {
      state: secret(),
      nonce: secret(),
      verifier: secret(),
    };
    const url = await this.provider.authorization(transaction);
    this.repo.putTransaction({
      ...transaction,
      bindingHash: digest(binding),
      returnTo,
      expiresAt: this.now() + 5 * 60_000,
    });
    return { binding, url };
  }
  async complete(
    binding: string | undefined,
    url: URL,
    oldToken: string | undefined,
  ) {
    if (!this.provider || !binding || binding.length !== 43)
      throw new RoomError('LOGIN_FAILED', 400);
    const transaction = this.repo.consumeTransaction(digest(binding));
    if (!transaction || transaction.expiresAt <= this.now())
      throw new RoomError('LOGIN_FAILED', 400);
    const google = await this.provider.exchange(url, transaction);
    const user = this.repo.googleUser(
      google.sub,
      google.name,
      google.picture,
      this.now(),
    );
    const token = secret();
    const hash = digest(token);
    const expiresAt = this.now() + 7 * 24 * 60 * 60_000;
    if (oldToken) this.revoke(digest(oldToken));
    this.repo.putSession({
      tokenHash: hash,
      userId: user.id,
      csrfToken: secret(),
      createdAt: this.now(),
      expiresAt,
    });
    // Retiring the oldest persistent session also invalidates any in-memory authorization.
    for (const [key, cached] of this.cache)
      if (cached.identity.userId === user.id && !this.repo.session(key))
        this.cache.delete(key);
    await this.refresh(user);
    return { token, expiresAt, returnTo: transaction.returnTo };
  }
  revoke(hash: string) {
    this.repo.revokeSession(hash);
    this.cache.delete(hash);
  }
  private async refresh(user: UserRecord) {
    const profile = publicProfile(user);
    for (const cached of this.cache.values())
      if (cached.identity.userId === user.id) cached.profile = profile;
    await this.onProfileChange(profile);
    return profile;
  }
  async rename(identity: Identity, version: number, name: string) {
    return this.refresh(
      this.repo.updateName(identity.actorId, version, name, this.now()),
    );
  }
  async upload(identity: Identity, version: number, input: Buffer, crop: Crop) {
    if (!this.storage) throw new RoomError('AVATAR_STORAGE_UNAVAILABLE', 503);
    if (this.processing >= 2) throw new RoomError('UPLOAD_BUSY', 429);
    if (this.repo.user(identity.actorId)?.version !== version)
      throw new RoomError('PROFILE_CONFLICT');
    this.processing++;
    const id = randomUUID();
    try {
      const images = await optimizeAvatar(input, crop);
      this.repo.pendingAvatar(id, identity.actorId, this.now());
      try {
        await this.storage.put(id, 'profile', images.profile);
        await this.storage.put(id, 'thumbnail', images.thumbnail);
        if (!this.active(identity)) throw new RoomError('LOGIN_REQUIRED', 401);
        this.repo.setAvatar(identity.actorId, version, id, this.now());
      } catch (error) {
        this.repo.discardAvatar(id);
        throw error;
      }
      return await this.refresh(this.repo.user(identity.actorId)!);
    } finally {
      this.processing--;
      void this.collect();
    }
  }
  async removeAvatar(identity: Identity, version: number) {
    const profile = await this.refresh(
      this.repo.setAvatar(identity.actorId, version, null, this.now()),
    );
    void this.collect();
    return profile;
  }
  async collect() {
    if (this.closed || !this.storage || this.collecting) return;
    this.collecting = true;
    try {
      for (const avatar of this.repo.cleanupAvatars(this.now())) {
        if (this.closed) break;
        try {
          await this.storage.remove(avatar.id);
          if (!this.closed) this.repo.forgetAvatar(avatar.id);
        } catch {
          /* Keep durable cleanup intent for the next maintenance cycle. */
        }
      }
    } finally {
      this.collecting = false;
    }
  }
  private pruneCache() {
    for (const [hash, cached] of this.cache)
      if (cached.identity.expiresAt <= this.now()) this.cache.delete(hash);
  }
  maintenance() {
    if (this.closed) return;
    this.repo.prune(this.now());
    this.pruneCache();
    void this.collect();
  }
  close() {
    this.closed = true;
    this.cache.clear();
    this.storage?.close?.();
    this.repo.close();
  }
}

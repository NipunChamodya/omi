import { randomUUID } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { and, eq, lt, or } from 'drizzle-orm';
import { avatars, oauthTransactions, sessions, users } from './schema.js';
import type {
  AvatarRecord,
  OAuthTransaction,
  SessionRecord,
  UserRecord,
} from './schema.js';
import { RoomError } from '../multiplayer/support.js';
/** Application-facing persistence boundary. A PostgreSQL implementation can replace this adapter. */
export interface AccountRepository {
  user(id: string): UserRecord | undefined;
  googleUser(
    sub: string,
    name: string,
    picture: string | null,
    now: number,
  ): UserRecord;
  updateName(
    id: string,
    version: number,
    name: string,
    now: number,
  ): UserRecord;
  putSession(session: SessionRecord): void;
  session(hash: string): SessionRecord | undefined;
  revokeSession(hash: string): void;
  putTransaction(transaction: OAuthTransaction): void;
  consumeTransaction(hash: string): OAuthTransaction | undefined;
  pendingAvatar(id: string, userId: string, now: number): void;
  avatar(id: string): AvatarRecord | undefined;
  setAvatar(
    userId: string,
    version: number,
    id: string | null,
    now: number,
  ): UserRecord;
  discardAvatar(id: string): void;
  cleanupAvatars(now: number): AvatarRecord[];
  forgetAvatar(id: string): void;
  prune(now: number): void;
  close(): void;
}
export class SqliteAccounts implements AccountRepository {
  private readonly sqlite;
  private readonly db;
  constructor(path: string) {
    if (path !== ':memory:')
      mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
    this.sqlite = new Database(path);
    if (path !== ':memory:') chmodSync(path, 0o600);
    this.sqlite.pragma('foreign_keys = ON');
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('busy_timeout = 5000');
    this.db = drizzle(this.sqlite);
    // Source and compiled modules have the same depth relative to workspace migrations.
    migrate(this.db, {
      migrationsFolder: fileURLToPath(
        new URL('../../migrations', import.meta.url),
      ),
    });
  }
  user(id: string) {
    return this.db.select().from(users).where(eq(users.id, id)).get();
  }
  googleUser(
    sub: string,
    name: string,
    picture: string | null,
    now: number,
  ): UserRecord {
    return this.db.transaction((tx) => {
      const existing = tx
        .select()
        .from(users)
        .where(eq(users.googleSub, sub))
        .get();
      if (existing) {
        tx.update(users)
          .set({ googleAvatarUrl: picture })
          .where(eq(users.id, existing.id))
          .run();
        return { ...existing, googleAvatarUrl: picture };
      }
      return tx
        .insert(users)
        .values({
          id: randomUUID(),
          googleSub: sub,
          displayName: name,
          googleAvatarUrl: picture,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
    });
  }
  updateName(
    id: string,
    version: number,
    name: string,
    now: number,
  ): UserRecord {
    const updated = this.db
      .update(users)
      .set({ displayName: name, version: version + 1, updatedAt: now })
      .where(and(eq(users.id, id), eq(users.version, version)))
      .returning()
      .get();
    if (!updated) throw new RoomError('PROFILE_CONFLICT');
    return updated;
  }
  putSession(session: SessionRecord): void {
    this.db.transaction((tx) => {
      const existing = tx
        .select()
        .from(sessions)
        .where(eq(sessions.userId, session.userId))
        .all();
      for (const old of existing
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, Math.max(0, existing.length - 9)))
        tx.delete(sessions).where(eq(sessions.tokenHash, old.tokenHash)).run();
      tx.insert(sessions).values(session).run();
    });
  }
  session(hash: string) {
    return this.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hash))
      .get();
  }
  revokeSession(hash: string) {
    this.db.delete(sessions).where(eq(sessions.tokenHash, hash)).run();
  }
  putTransaction(transaction: OAuthTransaction) {
    if (this.db.select().from(oauthTransactions).all().length >= 1000)
      throw new RoomError('LOGIN_CAPACITY', 503);
    this.db.insert(oauthTransactions).values(transaction).run();
  }
  consumeTransaction(hash: string) {
    return this.db.transaction((tx) => {
      const row = tx
        .select()
        .from(oauthTransactions)
        .where(eq(oauthTransactions.bindingHash, hash))
        .get();
      tx.delete(oauthTransactions)
        .where(eq(oauthTransactions.bindingHash, hash))
        .run();
      return row;
    });
  }
  pendingAvatar(id: string, userId: string, now: number) {
    if (
      this.db.select().from(avatars).where(eq(avatars.userId, userId)).all()
        .length >= 5
    )
      throw new RoomError('UPLOAD_CLEANUP_PENDING', 503);
    this.db
      .insert(avatars)
      .values({ id, userId, status: 'pending', createdAt: now })
      .run();
  }
  avatar(id: string) {
    return this.db.select().from(avatars).where(eq(avatars.id, id)).get();
  }
  setAvatar(
    userId: string,
    version: number,
    id: string | null,
    now: number,
  ): UserRecord {
    return this.db.transaction((tx) => {
      const user = tx.select().from(users).where(eq(users.id, userId)).get();
      if (!user || user.version !== version)
        throw new RoomError('PROFILE_CONFLICT');
      if (id) {
        const avatar = tx
          .select()
          .from(avatars)
          .where(
            and(
              eq(avatars.id, id),
              eq(avatars.userId, userId),
              eq(avatars.status, 'pending'),
            ),
          )
          .get();
        if (!avatar) throw new RoomError('INVALID_AVATAR', 400);
      }
      if (user.avatarId)
        tx.update(avatars)
          .set({ status: 'deleting' })
          .where(eq(avatars.id, user.avatarId))
          .run();
      if (id)
        tx.update(avatars)
          .set({ status: 'active' })
          .where(eq(avatars.id, id))
          .run();
      return tx
        .update(users)
        .set({ avatarId: id, version: version + 1, updatedAt: now })
        .where(eq(users.id, userId))
        .returning()
        .get();
    });
  }
  discardAvatar(id: string) {
    this.db
      .update(avatars)
      .set({ status: 'deleting' })
      .where(eq(avatars.id, id))
      .run();
  }
  cleanupAvatars(now: number) {
    return this.db
      .select()
      .from(avatars)
      .where(
        or(
          eq(avatars.status, 'deleting'),
          and(
            eq(avatars.status, 'pending'),
            lt(avatars.createdAt, now - 10 * 60_000),
          ),
        ),
      )
      .limit(2)
      .all();
  }
  forgetAvatar(id: string) {
    this.db.delete(avatars).where(eq(avatars.id, id)).run();
  }
  prune(now: number) {
    this.db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
    this.db
      .delete(oauthTransactions)
      .where(lt(oauthTransactions.expiresAt, now))
      .run();
  }
  close() {
    this.sqlite.close();
  }
}

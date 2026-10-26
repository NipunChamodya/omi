import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    googleSub: text('google_sub').notNull(),
    displayName: text('display_name').notNull(),
    googleAvatarUrl: text('google_avatar_url'),
    avatarId: text('avatar_id'),
    version: integer('version').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('users_google_sub_unique').on(table.googleSub)],
);
export const sessions = sqliteTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    csrfToken: text('csrf_token').notNull(),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('sessions_expiry').on(table.expiresAt),
    index('sessions_user').on(table.userId),
  ],
);
export const oauthTransactions = sqliteTable(
  'oauth_transactions',
  {
    bindingHash: text('binding_hash').primaryKey(),
    state: text('state').notNull(),
    nonce: text('nonce').notNull(),
    verifier: text('verifier').notNull(),
    returnTo: text('return_to').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [index('oauth_expiry').on(table.expiresAt)],
);
export const avatars = sqliteTable(
  'avatars',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', {
      enum: ['pending', 'active', 'deleting'],
    }).notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('avatars_cleanup').on(table.status, table.createdAt)],
);
export type UserRecord = typeof users.$inferSelect;
export type SessionRecord = typeof sessions.$inferSelect;
export type OAuthTransaction = typeof oauthTransactions.$inferSelect;
export type AvatarRecord = typeof avatars.$inferSelect;
export const socialReports = sqliteTable(
  'social_reports',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id').notNull(),
    reporterId: text('reporter_id').notNull(),
    subjectId: text('subject_id').notNull(),
    messageId: text('message_id').notNull(),
    reason: text('reason').notNull(),
    note: text('note').notNull(),
    messageText: text('message_text').notNull(),
    messageCreatedAt: integer('message_created_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('social_reports_once').on(table.reporterId, table.messageId),
    index('social_reports_age').on(table.createdAt),
  ],
);

CREATE TABLE omi_room_invitations (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES omi_match_state(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  partnership INTEGER NOT NULL CHECK (partnership IN (0,1)),
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX omi_invitation_expiry ON omi_room_invitations(expires_at);
--> statement-breakpoint
CREATE TABLE omi_account_safety (
  actor_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  protected_play INTEGER NOT NULL DEFAULT 0 CHECK (protected_play IN (0,1)),
  restricted INTEGER NOT NULL DEFAULT 0 CHECK (restricted IN (0,1))
);
--> statement-breakpoint
CREATE TABLE omi_restriction_audit (
  id INTEGER PRIMARY KEY,
  report_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  restricted INTEGER NOT NULL,
  occurred_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX omi_restriction_subject ON omi_restriction_audit(subject_id, id);
--> statement-breakpoint
CREATE INDEX omi_restriction_report ON omi_restriction_audit(report_id);

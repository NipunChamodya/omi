CREATE TABLE omi_match_state (
  id TEXT PRIMARY KEY NOT NULL,
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  payload TEXT NOT NULL,
  checksum TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX omi_match_state_active ON omi_match_state (active);
--> statement-breakpoint
CREATE TABLE omi_match_results (
  room_id TEXT NOT NULL REFERENCES omi_match_state (id),
  actor_id TEXT NOT NULL,
  won INTEGER NOT NULL CHECK (won IN (0, 1)),
  ranked INTEGER NOT NULL CHECK (ranked IN (0, 1)),
  reason TEXT NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (room_id, actor_id)
);
--> statement-breakpoint
CREATE INDEX omi_match_results_actor ON omi_match_results (actor_id, completed_at);
--> statement-breakpoint
CREATE TABLE omi_friendships (
  left_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  right_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  accepted INTEGER NOT NULL DEFAULT 0 CHECK (accepted IN (0, 1)),
  left_blocked INTEGER NOT NULL DEFAULT 0 CHECK (left_blocked IN (0, 1)),
  right_blocked INTEGER NOT NULL DEFAULT 0 CHECK (right_blocked IN (0, 1)),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (left_id, right_id),
  CHECK (left_id < right_id)
);
--> statement-breakpoint
CREATE INDEX omi_friendships_right ON omi_friendships (right_id, updated_at);
--> statement-breakpoint
CREATE TABLE omi_guest_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  actor_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX omi_guest_sessions_expiry ON omi_guest_sessions (expires_at);

CREATE TABLE omi_http_receipts (
  actor_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  descriptor TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (actor_id, action_id)
);
--> statement-breakpoint
CREATE INDEX omi_http_receipts_expiry ON omi_http_receipts (expires_at);

ALTER TABLE omi_match_results ADD COLUMN partner_id TEXT;
--> statement-breakpoint
CREATE TABLE omi_match_hands (
  match_id TEXT PRIMARY KEY REFERENCES omi_match_state (id),
  summary TEXT NOT NULL
);
--> statement-breakpoint
ALTER TABLE social_reports ADD COLUMN review_status TEXT NOT NULL DEFAULT 'open'
  CHECK (review_status IN ('open', 'reviewed', 'dismissed'));
--> statement-breakpoint
ALTER TABLE social_reports ADD COLUMN review_revision INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE omi_moderation_audit (
  report_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  moderator_id TEXT NOT NULL,
  status TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  PRIMARY KEY (report_id, revision)
);

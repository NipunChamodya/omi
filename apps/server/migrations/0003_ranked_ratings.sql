CREATE TABLE omi_ratings (
  actor_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 0)
);
--> statement-breakpoint
CREATE INDEX omi_ratings_leaderboard ON omi_ratings (rating DESC, actor_id);
--> statement-breakpoint
CREATE TABLE omi_rating_history (
  room_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  previous INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (room_id, actor_id),
  FOREIGN KEY (room_id, actor_id) REFERENCES omi_match_results(room_id, actor_id)
);
--> statement-breakpoint
CREATE INDEX omi_rating_history_actor ON omi_rating_history(actor_id, completed_at DESC);

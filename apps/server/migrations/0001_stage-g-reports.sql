CREATE TABLE `social_reports` (
  `id` text PRIMARY KEY NOT NULL,
  `room_id` text NOT NULL,
  `reporter_id` text NOT NULL,
  `subject_id` text NOT NULL,
  `message_id` text NOT NULL,
  `reason` text NOT NULL,
  `note` text NOT NULL,
  `message_text` text NOT NULL,
  `message_created_at` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_reports_once` ON `social_reports` (`reporter_id`, `message_id`);
--> statement-breakpoint
CREATE INDEX `social_reports_age` ON `social_reports` (`created_at`);

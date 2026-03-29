CREATE TABLE IF NOT EXISTS `history_events` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`level` text NOT NULL,
	`category` text NOT NULL,
	`entity_kind` text,
	`entity_ref` text,
	`message` text NOT NULL,
	`details_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_history_events_run_id_created_at` ON `history_events` (`run_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `history_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`trigger` text NOT NULL,
	`action` text NOT NULL,
	`status` text NOT NULL,
	`message` text,
	`summary_json` text,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL
);

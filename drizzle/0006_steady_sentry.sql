CREATE TABLE IF NOT EXISTS `mapping_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`conflict_key` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`severity` text NOT NULL,
	`mapping_kind` text NOT NULL,
	`mapping_id` text NOT NULL,
	`source_tab` text NOT NULL,
	`mealie_id` text,
	`mealie_name` text,
	`grocy_id` integer,
	`grocy_name` text,
	`summary` text NOT NULL,
	`occurrences` integer NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_mapping_conflicts_conflict_key` ON `mapping_conflicts` (`conflict_key`);

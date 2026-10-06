CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plugin_installations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_hint` text NOT NULL,
	`provider_id` text,
	`provider_label` text,
	`account_key` text,
	`account_label` text,
	`auth_state` text,
	`manifest_json` text,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`rotated_at` integer,
	`revoked_at` integer,
	`last_seen_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_plugin_installations_token_hash` ON `plugin_installations` (`token_hash`);
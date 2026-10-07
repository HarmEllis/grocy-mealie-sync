CREATE TABLE `shop_catalog_searches` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`target_name` text NOT NULL,
	`query` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`result_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`next_attempt_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_shop_catalog_searches_provider` ON `shop_catalog_searches` (`provider_id`);
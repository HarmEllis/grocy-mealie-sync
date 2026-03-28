CREATE TABLE IF NOT EXISTS `runtime_locks` (
	`name` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_product_mappings_grocy_product_id` ON `product_mappings` (`grocy_product_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_unit_mappings_grocy_unit_id` ON `unit_mappings` (`grocy_unit_id`);

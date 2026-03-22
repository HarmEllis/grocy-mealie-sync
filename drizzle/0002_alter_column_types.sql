-- Recreate product_mappings to make unit_mapping_id nullable
CREATE TABLE `product_mappings_new` (
	`id` text PRIMARY KEY NOT NULL,
	`mealie_food_id` text NOT NULL,
	`mealie_food_name` text NOT NULL,
	`grocy_product_id` integer NOT NULL,
	`grocy_product_name` text NOT NULL,
	`unit_mapping_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `product_mappings_new` SELECT `id`, `mealie_food_id`, `mealie_food_name`, `grocy_product_id`, `grocy_product_name`, CASE WHEN `unit_mapping_id` = '' THEN NULL ELSE `unit_mapping_id` END, `created_at`, `updated_at` FROM `product_mappings`;
--> statement-breakpoint
DROP TABLE `product_mappings`;
--> statement-breakpoint
ALTER TABLE `product_mappings_new` RENAME TO `product_mappings`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_product_mappings_mealie_food_id` ON `product_mappings` (`mealie_food_id`);
--> statement-breakpoint
-- Recreate unit_mappings to change conversion_factor from integer to real
CREATE TABLE `unit_mappings_new` (
	`id` text PRIMARY KEY NOT NULL,
	`mealie_unit_id` text NOT NULL,
	`mealie_unit_name` text NOT NULL,
	`mealie_unit_abbreviation` text NOT NULL,
	`grocy_unit_id` integer NOT NULL,
	`grocy_unit_name` text NOT NULL,
	`conversion_factor` real NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `unit_mappings_new` SELECT * FROM `unit_mappings`;
--> statement-breakpoint
DROP TABLE `unit_mappings`;
--> statement-breakpoint
ALTER TABLE `unit_mappings_new` RENAME TO `unit_mappings`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_unit_mappings_mealie_unit_id` ON `unit_mappings` (`mealie_unit_id`);

PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_product_mappings` (
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
INSERT INTO `__new_product_mappings`("id", "mealie_food_id", "mealie_food_name", "grocy_product_id", "grocy_product_name", "unit_mapping_id", "created_at", "updated_at") SELECT "id", "mealie_food_id", "mealie_food_name", "grocy_product_id", "grocy_product_name", "unit_mapping_id", "created_at", "updated_at" FROM `product_mappings`;--> statement-breakpoint
DROP TABLE `product_mappings`;--> statement-breakpoint
ALTER TABLE `__new_product_mappings` RENAME TO `product_mappings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_product_mappings_mealie_food_id` ON `product_mappings` (`mealie_food_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_product_mappings_grocy_product_id` ON `product_mappings` (`grocy_product_id`);--> statement-breakpoint
CREATE TABLE `__new_unit_mappings` (
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
INSERT INTO `__new_unit_mappings`("id", "mealie_unit_id", "mealie_unit_name", "mealie_unit_abbreviation", "grocy_unit_id", "grocy_unit_name", "conversion_factor", "created_at", "updated_at") SELECT "id", "mealie_unit_id", "mealie_unit_name", "mealie_unit_abbreviation", "grocy_unit_id", "grocy_unit_name", "conversion_factor", "created_at", "updated_at" FROM `unit_mappings`;--> statement-breakpoint
DROP TABLE `unit_mappings`;--> statement-breakpoint
ALTER TABLE `__new_unit_mappings` RENAME TO `unit_mappings`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_unit_mappings_mealie_unit_id` ON `unit_mappings` (`mealie_unit_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_unit_mappings_grocy_unit_id` ON `unit_mappings` (`grocy_unit_id`);
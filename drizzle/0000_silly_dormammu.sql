CREATE TABLE `product_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`mealie_food_id` text NOT NULL,
	`mealie_food_name` text NOT NULL,
	`grocy_product_id` integer NOT NULL,
	`grocy_product_name` text NOT NULL,
	`unit_mapping_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`state_data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `unit_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`mealie_unit_id` text NOT NULL,
	`mealie_unit_name` text NOT NULL,
	`mealie_unit_abbreviation` text NOT NULL,
	`grocy_unit_id` integer NOT NULL,
	`grocy_unit_name` text NOT NULL,
	`conversion_factor` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

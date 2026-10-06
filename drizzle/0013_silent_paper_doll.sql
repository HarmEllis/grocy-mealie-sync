CREATE TABLE `retailer_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`retailer_product_id` text NOT NULL,
	`retailer_product_name` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`target_name` text NOT NULL,
	`role` text NOT NULL,
	`package_base_amount` real,
	`package_base_unit_id` text,
	`package_base_unit_name` text,
	`package_source` text,
	`confirmed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_retailer_mappings_provider_product` ON `retailer_mappings` (`provider_id`,`retailer_product_id`);--> statement-breakpoint
CREATE INDEX `idx_retailer_mappings_target` ON `retailer_mappings` (`target_kind`,`target_id`);--> statement-breakpoint
CREATE TABLE `retailer_products` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`external_id` text NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`gtins_json` text,
	`package_amount` real,
	`package_unit` text,
	`measure` text NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_retailer_products_provider_external` ON `retailer_products` (`provider_id`,`external_id`);--> statement-breakpoint
CREATE TABLE `retailer_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`retailer_product_id` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`target_name` text NOT NULL,
	`score` real NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`decided_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_retailer_suggestions_pair` ON `retailer_suggestions` (`provider_id`,`retailer_product_id`,`target_kind`,`target_id`);
CREATE TABLE `shop_export_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`export_id` text NOT NULL,
	`demand_revision_id` text NOT NULL,
	`mealie_item_id` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`base_amount` real NOT NULL,
	`row_factor` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_shop_export_allocations_export` ON `shop_export_allocations` (`export_id`);--> statement-breakpoint
CREATE INDEX `idx_shop_export_allocations_revision` ON `shop_export_allocations` (`demand_revision_id`);--> statement-breakpoint
CREATE TABLE `shop_exports` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`retailer_product_id` text NOT NULL,
	`packages` integer NOT NULL,
	`base_amount` real NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` integer NOT NULL,
	`superseded_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_shop_exports_installation_product` ON `shop_exports` (`installation_id`,`retailer_product_id`);--> statement-breakpoint
CREATE TABLE `shop_list_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`retailer_product_id` text NOT NULL,
	`line_id` text,
	`managed_qty` integer NOT NULL,
	`baseline_user_qty` integer NOT NULL,
	`last_written_qty` integer NOT NULL,
	`paused_reason` text,
	`paused_observed_qty` integer,
	`released_export_id` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_shop_list_lines_installation_product` ON `shop_list_lines` (`installation_id`,`retailer_product_id`);
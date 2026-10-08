DROP INDEX `idx_shop_list_lines_installation_product`;--> statement-breakpoint
ALTER TABLE `shop_list_lines` ADD `kind` text DEFAULT 'product' NOT NULL;--> statement-breakpoint
ALTER TABLE `shop_list_lines` ADD `note_text` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_shop_list_lines_installation_product_kind` ON `shop_list_lines` (`installation_id`,`retailer_product_id`,`kind`);--> statement-breakpoint
ALTER TABLE `retailer_products` ADD `availability` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `retailer_products` ADD `availability_checked_at` integer;--> statement-breakpoint
ALTER TABLE `shop_exports` ADD `note_exposed_at` integer;
CREATE TABLE `discrepancies` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`receipt_line_id` text,
	`lifecycle_id` text,
	`evidence_json` text NOT NULL,
	`resolution` text,
	`resolution_effect_id` text,
	`created_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_discrepancies_identity` ON `discrepancies` (`kind`,`receipt_line_id`,`lifecycle_id`);--> statement-breakpoint
CREATE TABLE `low_stock_accounted_restocks` (
	`effect_id` text PRIMARY KEY NOT NULL,
	`grocy_product_id` integer NOT NULL,
	`stock_amount` real NOT NULL,
	`created_at` integer NOT NULL,
	`consumed_at` integer
);
--> statement-breakpoint
CREATE TABLE `receipt_cursors` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`account_key` text NOT NULL,
	`since_at` integer,
	`last_pull_at` integer,
	`page_cursor` text,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `receipt_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`line_no` integer NOT NULL,
	`kind` text NOT NULL,
	`retailer_product_id` text,
	`gtin` text,
	`description` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`unit_price_cents` integer,
	`amount_cents` integer,
	`status` text NOT NULL,
	`review_reason` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_receipt_lines_receipt_line` ON `receipt_lines` (`receipt_id`,`line_no`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`account_key` text NOT NULL,
	`external_receipt_id` text NOT NULL,
	`purchased_at` integer NOT NULL,
	`fetched_at` integer NOT NULL,
	`content_hash` text,
	`status` text NOT NULL,
	`line_count` integer NOT NULL,
	`store_label` text,
	`total_cents` integer,
	`processed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_receipts_provider_account_external` ON `receipts` (`provider_id`,`account_key`,`external_receipt_id`);--> statement-breakpoint
CREATE INDEX `idx_receipts_status` ON `receipts` (`status`);--> statement-breakpoint
CREATE TABLE `reconciliation_links` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_line_id` text NOT NULL,
	`kind` text NOT NULL,
	`lifecycle_id` text,
	`demand_revision_id` text,
	`mealie_item_id` text,
	`export_id` text,
	`target_kind` text,
	`target_id` text,
	`base_amount` real NOT NULL,
	`effect_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reconciliation_links_line` ON `reconciliation_links` (`receipt_line_id`);--> statement-breakpoint
CREATE INDEX `idx_reconciliation_links_lifecycle` ON `reconciliation_links` (`lifecycle_id`);
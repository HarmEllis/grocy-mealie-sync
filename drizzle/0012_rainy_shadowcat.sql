CREATE TABLE `check_lifecycles` (
	`id` text PRIMARY KEY NOT NULL,
	`mealie_item_id` text NOT NULL,
	`demand_revision_id` text,
	`mealie_food_id` text,
	`grocy_product_id` integer,
	`quantity` real,
	`status` text NOT NULL,
	`checked_observed_at` integer NOT NULL,
	`closed_reason` text,
	`closed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_check_lifecycles_item` ON `check_lifecycles` (`mealie_item_id`,`status`);--> statement-breakpoint
CREATE TABLE `demand_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`mealie_item_id` text NOT NULL,
	`revision` integer NOT NULL,
	`food_id` text,
	`unit_id` text,
	`quantity` real NOT NULL,
	`note` text,
	`sub_items_json` text,
	`checked` integer NOT NULL,
	`fingerprint` text NOT NULL,
	`observed_at` integer NOT NULL,
	`superseded_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_demand_revisions_item_revision` ON `demand_revisions` (`mealie_item_id`,`revision`);--> statement-breakpoint
CREATE TABLE `demands` (
	`mealie_item_id` text PRIMARY KEY NOT NULL,
	`shopping_list_id` text NOT NULL,
	`status` text NOT NULL,
	`latest_revision_id` text,
	`first_seen_at` integer NOT NULL,
	`checked_at` integer,
	`removed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_demands_status` ON `demands` (`status`);--> statement-breakpoint
CREATE TABLE `shop_effects` (
	`id` text PRIMARY KEY NOT NULL,
	`effect_key` text NOT NULL,
	`kind` text NOT NULL,
	`source_kind` text NOT NULL,
	`source_ref` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`evidence_json` text,
	`external_ref` text,
	`error` text,
	`depends_on` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`started_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_shop_effects_effect_key` ON `shop_effects` (`effect_key`);--> statement-breakpoint
CREATE INDEX `idx_shop_effects_status` ON `shop_effects` (`status`);--> statement-breakpoint
CREATE INDEX `idx_shop_effects_source` ON `shop_effects` (`source_kind`,`source_ref`);
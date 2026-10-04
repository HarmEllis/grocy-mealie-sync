ALTER TABLE `history_events` ADD `kind` text DEFAULT 'diagnostic' NOT NULL;--> statement-breakpoint
ALTER TABLE `history_events` ADD `product_name` text;--> statement-breakpoint
ALTER TABLE `history_events` ADD `source` text;--> statement-breakpoint
ALTER TABLE `history_events` ADD `target` text;--> statement-breakpoint
ALTER TABLE `history_events` ADD `reason` text;--> statement-breakpoint
CREATE INDEX `idx_history_events_kind_created_at` ON `history_events` (`kind`,`created_at`,`id`);--> statement-breakpoint
UPDATE `history_events` SET `kind` = 'mutation'
WHERE `level` = 'info' AND `category` <> 'sync'
AND `run_id` IN (SELECT `id` FROM `history_runs` WHERE `trigger` = 'manual' AND `status` IN ('success', 'partial') AND `action` <> 'product_sync');--> statement-breakpoint
UPDATE `history_events` SET `kind` = 'issue'
WHERE `level` IN ('warning', 'error')
AND `run_id` IN (SELECT `id` FROM `history_runs` WHERE `status` <> 'skipped')
AND `message` NOT LIKE '%Sync completed.'
AND `message` NOT LIKE '%sync skipped.'
AND `message` NOT LIKE '%step skipped.'
AND `message` NOT LIKE '%Completed. Open conflicts:%';--> statement-breakpoint
UPDATE `history_events` SET `product_name` = coalesce(
  json_extract(`details_json`, '$.grocyProductName'), json_extract(`details_json`, '$.mealieFoodName'),
  json_extract(`details_json`, '$.productName'), json_extract(`details_json`, '$.foodName'), json_extract(`details_json`, '$.name')
)
WHERE json_valid(`details_json`) AND `entity_kind` IN ('product', 'shopping_item', 'stock_entry');--> statement-breakpoint
UPDATE `history_events` SET `created_at` = `created_at` * 1000;

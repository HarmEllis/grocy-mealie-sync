-- Add unique index on mealie_food_id to prevent duplicate product mappings
CREATE UNIQUE INDEX IF NOT EXISTS `idx_product_mappings_mealie_food_id` ON `product_mappings` (`mealie_food_id`);
--> statement-breakpoint
-- Add unique index on mealie_unit_id to prevent duplicate unit mappings
CREATE UNIQUE INDEX IF NOT EXISTS `idx_unit_mappings_mealie_unit_id` ON `unit_mappings` (`mealie_unit_id`);

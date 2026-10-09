import type { ProjectionReviewReason } from './projection';

export function needsProjectionAttention(reason: ProjectionReviewReason): boolean {
  return reason !== 'no_retailer_mapping' && reason !== 'no_food';
}

export const PROJECTION_LABELS: Record<ProjectionReviewReason, string> = {
  no_food: 'This row has no product; select a Mealie ingredient.',
  no_retailer_mapping: 'No preferred retailer product is mapped to this ingredient.',
  mapping_unconfirmed: 'Confirm the retailer product mapping and its package amount.',
  mapping_unit_changed: 'The mapped base unit changed; confirm the package amount again.',
  unknown_product: 'The Grocy product or its stock unit is missing.',
  missing_unit: 'Select a unit so the quantity can be converted.',
  purchase_unit_ambiguous: 'The purchase unit differs from the stock unit; specify an unambiguous quantity.',
  no_conversion: 'No conversion is configured between the Mealie unit and the mapped base unit.',
};

export const MIN_STOCK_STEP_VALUES = ['1', '0.1', '0.01'] as const;

export type MinStockStep = (typeof MIN_STOCK_STEP_VALUES)[number];

export const MIN_STOCK_STEP_LABELS: Record<MinStockStep, string> = {
  '1': 'Whole numbers (1)',
  '0.1': 'Tenths (0.1)',
  '0.01': 'Hundredths (0.01)',
};

export function isMinStockStep(value: string): value is MinStockStep {
  return MIN_STOCK_STEP_VALUES.includes(value as MinStockStep);
}

export function normalizeMinStockStep(value: string | null | undefined, fallback: MinStockStep): MinStockStep {
  if (!value) {
    return fallback;
  }

  return isMinStockStep(value) ? value : fallback;
}

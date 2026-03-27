export function resolveTimeZone(value: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function formatDateTime(
  value: string | Date | null,
  options: {
    fallback?: string;
    timeZone?: string | null;
  } = {},
): string {
  const fallback = options.fallback ?? '-';

  if (!value) {
    return fallback;
  }

  try {
    const date = value instanceof Date ? value : new Date(value);
    return options.timeZone
      ? date.toLocaleString(undefined, { timeZone: options.timeZone })
      : date.toLocaleString();
  } catch {
    return String(value);
  }
}

import * as ct from 'countries-and-timezones';

export function resolveTimeZone(value: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function resolveLocaleFromTimeZone(timeZone: string | null): string | null {
  if (!timeZone) {
    return null;
  }

  const timezoneInfo = ct.getTimezone(timeZone);
  const countryCode = timezoneInfo?.countries?.[0];

  if (!countryCode) {
    return null;
  }

  try {
    const locale = new Intl.Locale(`und-${countryCode}`).maximize();

    if (!locale.language || !locale.region) {
      return null;
    }

    return `${locale.language}-${locale.region}`;
  } catch {
    return null;
  }
}

export function formatDateTime(
  value: string | Date | null,
  options: {
    fallback?: string;
    timeZone?: string | null;
    locale?: string | null;
  } = {},
): string {
  const fallback = options.fallback ?? '-';

  if (!value) {
    return fallback;
  }

  try {
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat(options.locale ?? undefined, {
      timeZone: options.timeZone ?? undefined,
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return String(value);
  }
}

'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { formatDateTime } from '@/lib/date-time';

type When = (value: string | null | undefined) => string;

const WhenContext = createContext<When>(value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
});

/** Formats timestamps in the configured time zone and locale, like the rest of the app. */
export function ShopFormatProvider({ timeZone, locale, children }: { timeZone: string | null; locale: string | null; children: ReactNode }) {
  const when: When = value => (value ? formatDateTime(value, { fallback: '', timeZone, locale }) : '');
  return <WhenContext.Provider value={when}>{children}</WhenContext.Provider>;
}

export function useWhen(): When {
  return useContext(WhenContext);
}

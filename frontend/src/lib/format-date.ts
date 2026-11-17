import i18n from '@/i18n';

/** Dates follow the language of the interface, not only the one of the browser. */
export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(i18n.language, { dateStyle: 'medium' });

export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "2 hours ago", "yesterday", "now": for places where how long ago matters more than the exact moment. */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat(i18n.language, {
    numeric: 'auto',
  });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }
  return formatter.format(0, 'second');
}

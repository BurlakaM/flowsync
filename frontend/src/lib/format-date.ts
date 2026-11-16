import i18n from '@/i18n';

/** Dates follow the language of the interface, not only the one of the browser. */
export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(i18n.language, { dateStyle: 'medium' });

export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

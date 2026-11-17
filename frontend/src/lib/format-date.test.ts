import i18n from '@/i18n';
import { formatRelativeTime } from './format-date';

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-11-17T12:00:00Z');
  const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

  it('says "now" for the last moments', () => {
    expect(formatRelativeTime(ago(10), now)).toBe('now');
  });

  it('picks the largest fitting unit', () => {
    expect(formatRelativeTime(ago(5 * 60), now)).toBe('5 minutes ago');
    expect(formatRelativeTime(ago(3 * 3600), now)).toBe('3 hours ago');
    expect(formatRelativeTime(ago(24 * 3600), now)).toBe('yesterday');
    expect(formatRelativeTime(ago(10 * 24 * 3600), now)).toBe('10 days ago');
    expect(formatRelativeTime(ago(60 * 24 * 3600), now)).toBe('2 months ago');
  });

  it('follows the language of the interface', async () => {
    await i18n.changeLanguage('uk');
    expect(formatRelativeTime(ago(3 * 3600), now)).toBe('3 години тому');
  });
});

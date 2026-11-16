export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Українська' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

// A harmless preference (not a credential), so localStorage is the right place for it.
const STORAGE_KEY = 'language';

const isLanguage = (value: unknown): value is LanguageCode =>
  LANGUAGES.some((language) => language.code === value);

/** The saved choice; otherwise the language of the browser if we have it; otherwise English. */
export function detectLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // Blocked storage: the choice just does not survive a reload.
  }
  const browser = typeof navigator === 'undefined' ? '' : navigator.language;
  return browser.toLowerCase().startsWith('uk') ? 'uk' : 'en';
}

export function saveLanguage(language: LanguageCode): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // See above.
  }
}

export { isLanguage };

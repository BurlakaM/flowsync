export const THEMES = ['light', 'dark', 'system'] as const;

export type ThemePreference = (typeof THEMES)[number];

// A harmless preference (not a credential), so localStorage is the right place for it.
// `public/theme-init.js` reads the same key before the first paint.
const STORAGE_KEY = 'theme';

export const isThemePreference = (value: unknown): value is ThemePreference =>
  THEMES.some((theme) => theme === value);

/** The saved choice; without one the interface follows the system. */
export function getThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isThemePreference(saved)) return saved;
  } catch {
    // Blocked storage: the choice just does not survive a reload.
  }
  return 'system';
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // See above.
  }
}

const darkQuery = () =>
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

export const resolveTheme = (preference: ThemePreference): 'light' | 'dark' =>
  preference === 'system'
    ? darkQuery()?.matches
      ? 'dark'
      : 'light'
    : preference;

/** Switches the `dark` class (the tokens in `index.css` do the rest) and the color scheme of native controls. */
export function applyTheme(preference: ThemePreference): void {
  const resolved = resolveTheme(preference);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

/** Calls `onChange` when the system theme flips; returns a function that stops listening. */
export function watchSystemTheme(onChange: () => void): () => void {
  const query = darkQuery();
  if (!query) return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

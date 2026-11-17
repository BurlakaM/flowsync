import { useEffect, useState } from 'react';
import {
  applyTheme,
  getThemePreference,
  saveThemePreference,
  watchSystemTheme,
  type ThemePreference,
} from '@/lib/theme';

/** The theme preference of the interface: applies it to the page and remembers the choice. */
export function useTheme() {
  const [preference, setPreference] =
    useState<ThemePreference>(getThemePreference);

  useEffect(() => {
    applyTheme(preference);
    // "System" has to follow the operating system while the page is open.
    if (preference !== 'system') return;
    return watchSystemTheme(() => applyTheme('system'));
  }, [preference]);

  const choose = (next: ThemePreference) => {
    saveThemePreference(next);
    setPreference(next);
  };

  return { preference, choose };
}

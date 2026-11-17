import {
  applyTheme,
  getThemePreference,
  resolveTheme,
  saveThemePreference,
} from './theme';

const mockSystemTheme = (dark: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: dark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
});

describe('theme preference', () => {
  it('follows the system until a choice is saved', () => {
    expect(getThemePreference()).toBe('system');

    saveThemePreference('dark');
    expect(getThemePreference()).toBe('dark');
  });

  it('ignores a saved value it does not know', () => {
    localStorage.setItem('theme', 'neon');

    expect(getThemePreference()).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('uses the system theme only for "system"', () => {
    mockSystemTheme(true);

    expect(resolveTheme('system')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });
});

describe('applyTheme', () => {
  it('switches the dark class and the color scheme of the page', () => {
    applyTheme('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');

    applyTheme('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});

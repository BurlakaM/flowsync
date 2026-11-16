import { uk } from './uk';

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

// All source files as text (Vite reads them at build time, so the test needs no Node file access).
const sources = import.meta.glob<string>('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Application code only: tests, generated types, the dictionaries and test helpers are not scanned. */
const code = Object.entries(sources).filter(
  ([path]) => !/\.test\.|generated|\/i18n\/|\/testing\//.test(path),
);

/** Every text the code asks to translate: t('...') and tKey('...'). */
function keysUsedInCode(): Set<string> {
  const keys = new Set<string>();
  for (const [, source] of code) {
    // Comments may show examples such as t('...'): they are not code.
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const match of withoutComments.matchAll(
      /\b(?:t|tKey)\(\s*(['"`])((?:\\.|(?!\1).)*)\1/gs,
    )) {
      keys.add(match[2].replaceAll("\\'", "'"));
    }
  }
  return keys;
}

const placeholders = (text: string) =>
  [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();

describe('Ukrainian translation', () => {
  const used = keysUsedInCode();
  const plurals = [...used].filter((key) => `${key}_other` in uk);

  it('finds the keys of the code (the scan itself works)', () => {
    expect(code.length).toBeGreaterThan(40);
    expect(used.size).toBeGreaterThan(150);
    expect(used.has('Sign in')).toBe(true);
  });

  it('translates every text used in the code', () => {
    const missing = [...used].filter(
      (key) => !(key in uk) && !plurals.includes(key),
    );

    expect(missing).toEqual([]);
  });

  it('has no translations that the code no longer uses', () => {
    const unused = Object.keys(uk).filter(
      (key) =>
        !used.has(key) &&
        !(PLURAL_SUFFIX.test(key) && used.has(key.replace(PLURAL_SUFFIX, ''))),
    );

    expect(unused).toEqual([]);
  });

  it('gives every plural all four Ukrainian forms', () => {
    expect(plurals.length).toBeGreaterThan(0);
    for (const key of plurals) {
      for (const form of ['one', 'few', 'many', 'other']) {
        expect(uk, `${key}_${form}`).toHaveProperty(`${key}_${form}`);
      }
    }
  });

  it('keeps the placeholders of every text', () => {
    for (const [key, translation] of Object.entries(uk)) {
      const original = PLURAL_SUFFIX.test(key) ? '{{count}}' : key;
      expect(placeholders(translation), key).toEqual(placeholders(original));
    }
  });

  it('never leaves a translation empty', () => {
    for (const [key, translation] of Object.entries(uk)) {
      expect(translation.trim(), key).not.toBe('');
    }
  });
});

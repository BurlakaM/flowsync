/// <reference lib="dom" />
import { expect, test } from '@playwright/test';

// Visual regression of the public pages in both themes and on a desktop and a phone screen.
//
// Pixels depend on fonts and the operating system, so the baseline images live in e2e/__screenshots__ and are
// made and checked only inside the official Playwright Linux container (ops/visual.sh). Running this file
// on a developer's own machine would show differences that are not bugs.
//
//   ./ops/visual.sh           compare with the baseline (what CI does)
//   ./ops/visual.sh update    accept the current look as the new baseline (after a deliberate redesign)
const PAGES = [
  ['login', '/login'],
  ['register', '/register'],
  ['forgot-password', '/forgot-password'],
] as const;
const THEMES = ['light', 'dark'] as const;
const SCREENS = [
  ['desktop', { width: 1280, height: 800 }],
  ['phone', { width: 375, height: 812 }],
] as const;

for (const theme of THEMES) {
  for (const [screen, viewport] of SCREENS) {
    for (const [name, path] of PAGES) {
      test(`${name} page, ${theme} theme, ${screen}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        // The app keeps the choice in localStorage; setting it before the first paint is what a returning visitor has.
        await page.addInitScript(
          (value) => localStorage.setItem('theme', value),
          theme,
        );
        await page.emulateMedia({ reducedMotion: 'reduce' });

        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        // Text in the wrong font would be a false difference: wait until the fonts are really loaded.
        await page.evaluate(() => document.fonts.ready);

        await expect(page).toHaveScreenshot(`${name}-${theme}-${screen}.png`, {
          animations: 'disabled',
          // Antialiasing differs by a pixel here and there; a real change of layout or colour is far bigger.
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
}

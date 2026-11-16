import { configureAxe } from 'vitest-axe';

// jsdom does no layout and applies no real styles, so contrast cannot be measured here.
const axe = configureAxe({ rules: { 'color-contrast': { enabled: false } } });

/**
 * Fails with a readable list of the accessibility violations axe finds in the page
 * (the document body also covers dialogs, which Radix renders in a portal).
 */
export async function expectNoA11yViolations(
  root: Element = document.body,
): Promise<void> {
  const { violations } = await axe(root);
  expect(
    violations.map(
      (violation) =>
        `${violation.id}: ${violation.help} -> ${violation.nodes
          .map((node) => node.target.join(' '))
          .join(', ')}`,
    ),
  ).toEqual([]);
}

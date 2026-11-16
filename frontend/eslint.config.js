import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import fs from 'node:fs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Every folder of src/features is a feature. Features never import each other: the app layer
// (src/app) composes them. Imports go through the `@/` alias, so patterns can match it literally.
const features = fs
  .readdirSync('./src/features', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const featureOverrides = features.map((feature) => {
  const others = features
    .filter((other) => other !== feature)
    .flatMap((other) => [`@/features/${other}`, `@/features/${other}/*`]);

  return {
    files: [`src/features/${feature}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            // An empty group is invalid, so the rule is added only when there are other features.
            ...(others.length > 0
              ? [
                  {
                    group: others,
                    message:
                      'Features must not import each other: compose them in src/app.',
                  },
                ]
              : []),
            {
              group: ['@/app', '@/app/*'],
              message: 'Features must not import from the app layer.',
            },
            {
              group: ['**/features/*', '**/features/**'],
              message: 'Use the @/features/<name> alias, not relative paths.',
            },
          ],
        },
      ],
    },
  };
});

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  jsxA11y.flatConfigs.recommended,
  reactRefresh.configs.vite,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  // Shared code (components, hooks, lib, config, types) must not depend on features or the app layer.
  {
    files: ['src/{components,hooks,lib,config,types}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features', '@/features/*', '@/app', '@/app/*'],
              message:
                'Shared code must not import features or the app layer: dependencies point inwards.',
            },
          ],
        },
      ],
    },
  },
  ...featureOverrides,
  // Generated shadcn/ui components export variants next to components on purpose.
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/testing/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  // Plain configuration files run in Node.
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);

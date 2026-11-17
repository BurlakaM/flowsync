// See backend/lint-staged.config.mjs. Only the source is formatted (the same scope as `npm run format`).
export default {
  'src/**/*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
};

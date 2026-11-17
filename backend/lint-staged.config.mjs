// Picked up by lint-staged (run from the repository root by .husky/pre-commit): the tasks run in this
// directory, so ESLint and Prettier use this package's own configuration and binaries.
export default {
  '*.ts': ['eslint --fix', 'prettier --write'],
};

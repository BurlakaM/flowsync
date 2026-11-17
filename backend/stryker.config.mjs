// Mutation testing: Stryker changes the code (flips a condition, drops a call, changes a constant) and runs the
// unit tests. A mutant that no test notices ("survived") is a spot where the tests would not catch a real bug.
// Coverage says a line was executed; the mutation score says whether a test would fail if it were wrong.
//
//   npm run test:mutation
//
// Only the security- and data-critical logic is mutated: the whole backend takes far too long to be useful.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  mutate: [
    'src/modules/auth/auth.service.ts',
    'src/modules/auth/user-tokens.service.ts',
    'src/modules/users/users.service.ts',
    'src/modules/tasks/tasks.service.ts',
    'src/common/pagination/cursor.ts',
    'src/common/events/domain-events.service.ts',
    'src/common/casl/app-ability.ts',
  ],
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  // Below `break` the run fails; below `low` it is yellow. Measured 70 at the start, 78 after targeted tests; raise as tests improve.
  thresholds: { high: 85, low: 75, break: 70 },
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
};

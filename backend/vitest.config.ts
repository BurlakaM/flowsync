import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Unit tests live next to the code: src/**/*.spec.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    // class-transformer / class-validator decorators read the metadata polyfill.
    setupFiles: ['reflect-metadata'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/openapi-export.ts'],
      reporter: ['text', 'lcov'],
      // Business logic lives in the services: keep it well covered by unit tests.
      thresholds: {
        // The whole backend, controllers and modules included, is also covered by the e2e suite that this
        // report does not see: so the global floor is lower than the one for the services.
        statements: 63,
        branches: 72,
        functions: 58,
        lines: 63,
        'src/modules/**/*.service.ts': {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70,
        },
      },
    },
  },
  // SWC emits the decorator metadata that Nest dependency injection needs (esbuild does not).
  plugins: [swc.vite({ module: { type: 'es6' } })],
});

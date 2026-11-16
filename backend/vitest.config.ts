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
      reporter: ['text', 'lcov'],
    },
  },
  // SWC emits the decorator metadata that Nest dependency injection needs (esbuild does not).
  plugins: [swc.vite({ module: { type: 'es6' } })],
});

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// End-to-end tests: test/**/*.e2e-spec.ts. They share one database, so files run one by one.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-env.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});

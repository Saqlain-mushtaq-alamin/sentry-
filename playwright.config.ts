import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  workers: 1, // Electron app instances must not overlap
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/playwright-report', open: 'never' }],
  ],
  outputDir: 'test-results/e2e-artifacts',
});

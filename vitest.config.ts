import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/adversarial/**/*.test.ts',
      'tests/stress/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      all: true,
      // Phase 15 coverage gate: main-process + shared + preload code.
      // The Electron bootstrap entry (src/main/index.ts) is exercised by the
      // Playwright E2E suite instead of unit coverage, and renderer UI is
      // gated separately via jsdom component tests.
      include: ['src/main/**', 'src/shared/**', 'src/preload/**'],
      exclude: [
        'src/main/index.ts',
        'src/shared/ipc-types.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        // Security-critical modules — Phase 15 Task 15.1 targets
        'src/main/action-layer/action-firewall.ts': { lines: 95, functions: 95, branches: 90 },
        'src/main/action-layer/risk-classifier.ts': { lines: 95, functions: 95, branches: 90 },
        'src/main/action-layer/injection-detector/**': { lines: 95, functions: 90, branches: 85 },
        'src/main/action-layer/trust-manager.ts': { lines: 90, functions: 90, branches: 80 },
        'src/main/action-layer/permission-manager.ts': { lines: 90, functions: 90, branches: 85 },
        'src/main/action-layer/audit-log.ts': { lines: 90, functions: 90, branches: 85 },
        // High-priority agent modules
        'src/main/agent/react-loop.ts': { lines: 85, functions: 85, branches: 75 },
        'src/main/agent/recipe-replay.ts': { lines: 85, functions: 85, branches: 80 },
        'src/main/agent/context-manager.ts': { lines: 80, functions: 80, branches: 70 },
        'src/main/cdp/element-resolver.ts': { lines: 85, functions: 85, branches: 70 },
        'src/main/browser/tab-manager.ts': { lines: 80, functions: 80, branches: 70 },
      },
    },
  },
});

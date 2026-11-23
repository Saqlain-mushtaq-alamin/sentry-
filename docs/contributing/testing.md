# Running the Test Suite

Sentry has high test coverage requirements, with 600+ tests spanning unit, integration, adversarial security, and end-to-end suites.

---

## Test Commands

### 1. Unit Tests (Vitest)
Fast in-memory unit tests exercising main modules, adapters, parsers, and renderer components:
```bash
npm run test:unit
```

### 2. Integration Tests
Tests exercising the full ReAct agent loop, CDP mocks, and multi-tab orchestration:
```bash
npm run test:integration
```

### 3. Adversarial Security Tests
Evaluates injection detection across 50+ adversarial payload suites:
```bash
npm run test:adversarial
```

### 4. Code Coverage
Generates detailed coverage reports using `@vitest/coverage-v8`:
```bash
npm run test:coverage
```

### 5. End-to-End Tests (Playwright)
Launches the packaged or development Electron application and verifies end-to-end user workflows:
```bash
npm run test:e2e
```

### 6. Linting & Type Checking
```bash
npm run lint
npm run typecheck
```


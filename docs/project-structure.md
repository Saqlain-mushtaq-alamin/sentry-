# Sentry Project Structure

Based on the spike results (choosing Electron + React), the production codebase is organized as follows:

```
sentry/
├── src/
│   ├── main/              # Main process (Electron backend)
│   │   ├── browser/       # Tab management, window management, session handling
│   │   ├── cdp/           # CDP connection manager (puppeteer-core)
│   │   ├── action-layer/  # Action Firewall, permission gate, injection detector
│   │   └── agent/         # Agent brain, model adapters, ReAct loop
│   ├── renderer/          # UI layer (React + TS)
│   │   ├── components/    # Reusable UI components
│   │   ├── overlays/      # Agent overlays (diff preview, action log, vision mode)
│   │   ├── pages/         # Settings, trust dashboard, recipe manager
│   │   └── hooks/         # React hooks
│   └── shared/            # Types, constants, IPC contracts shared between processes
├── models/                # Local model configs and download scripts
├── tests/
│   ├── unit/              # Unit tests (Jest / Vitest)
│   ├── integration/       # Integration tests
│   ├── e2e/               # E2E test suite (Playwright / WebDriver)
│   └── adversarial/       # Prompt injection test suite
├── docs/                  # Internal documentation and architecture specs
├── scripts/               # Build, release, CI scripts
└── assets/                # Icons, images, sounds
```

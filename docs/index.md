# Sentry Documentation

Welcome to the documentation for **Sentry**, the trust-first agentic web browser designed to give users autonomous AI assistance while maintaining rigorous security boundaries and local-first data privacy.

---

## What is Sentry?

Sentry combines a Chromium-based web browser with an integrated autonomous AI agent. Unlike standard automation tools or remote AI scrapers, Sentry operates directly on your desktop with:

- **Action Firewall**: A real-time 4-tier risk classification engine that intercepts and evaluates every agent operation before execution.
- **Website Trust Modes**: Granular security policies per origin (`Read+Act`, `Read-Only`, `Highly Restricted`, `Blocked`).
- **Prompt Injection Defense**: 50+ heuristic and semantic pattern rules, hidden element scanning, and content sanitization to prevent indirect prompt injection attacks.
- **Local-First & Hybrid AI**: Full local execution via Ollama for zero cloud data transfer, alongside support for cloud providers (OpenAI, Anthropic, Google).
- **Tamper-Evident Audit Log**: Every proposed action, decision, risk score, and DOM modification is logged for transparency and verification.

---

## Documentation Roadmap

### [Getting Started](getting-started/installation.md)
- [Installation Guide](getting-started/installation.md) — Install on Windows, macOS, and Linux
- [Your First Task](getting-started/first-task.md) — Step-by-step walkthrough of running an agent task
- [Local AI Setup (Ollama)](getting-started/setup-local-ai.md) — Configure private local model inference
- [Cloud AI Setup](getting-started/setup-cloud-ai.md) — Securely configure OpenAI, Anthropic, or Google API keys

### [Features](features/action-firewall.md)
- [Action Firewall](features/action-firewall.md) — 4-tier risk gating and safety guarantees
- [Website Trust Levels](features/trust-levels.md) — Origin-specific permission model
- [Task Recipes](features/recipes.md) — Parameterized, repeatable workflows
- [Multi-Tab Orchestration](features/multi-tab.md) — Parallel tasks and tab coordination
- [Voice Control](features/voice.md) — Speech-to-text input and natural voice narration
- [Chrome Extensions](features/extensions.md) — Loading and running Manifest V2/V3 extensions
- [Developer & Benchmark Mode](features/developer-mode.md) — Execution traces, token telemetry, and AgentDojo test suites

### [Security & Privacy](security/architecture.md)
- [Security Architecture](security/architecture.md) — Three-layer defense-in-depth model
- [Prompt Injection Defense](security/prompt-injection.md) — Mitigating adversarial web content
- [Data Privacy & Local Storage](security/privacy.md) — Safe storage, zero-tracking commitments, and forget controls
- [Security FAQ](security/faq.md) — Frequently asked questions about agent permissions and sandboxing

### [Guides & Reference](guides/common-tasks.md)
- [Common Tasks & Examples](guides/common-tasks.md) — Research, form filling, data extraction, and shopping workflows
- [Troubleshooting](guides/troubleshooting.md) — Resolving connection, rendering, or model timeout issues
- [Keyboard Shortcuts](guides/keyboard-shortcuts.md) — Global hotkeys and browser navigation shortcuts

### [Contributing](contributing/building.md)
- [Building from Source](contributing/building.md) — Development setup, prerequisites, and builds
- [Architecture Guide](contributing/architecture.md) — Process model, IPC communication, and codebase map
- [Testing Suite](contributing/testing.md) — Running unit, integration, adversarial, and E2E suites


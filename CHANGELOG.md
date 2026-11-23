# Changelog

All notable changes to Sentry are documented in this file. The project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-06

### 🎉 Initial Production Release

#### Security & Trust
- **Action Firewall:** Real-time 4-tier risk classification engine intercepting and gating all agent actions.
- **Website Trust Modes:** Origin-level policies (`Read+Act`, `Read-Only`, `Highly Restricted`, `Blocked`).
- **Prompt Injection Defense:** 50+ heuristic and semantic pattern rules, computed-style hidden element scanning, and delimited content framing.
- **Audit Logging:** Tamper-evident hash-chained audit log for all agent decisions and DOM mutations.

#### Agent Capabilities
- **ReAct Execution Engine:** Autonomous plan-before-execute loop with step-by-step reasoning and observation.
- **Model Support:** Provider-agnostic support for Ollama (local), OpenAI (GPT-4o), Anthropic (Claude 3.5 Sonnet), and Google (Gemini 1.5).
- **Simulation Mode:** Dry run mode enabling action preview and risk evaluation without mutating the live DOM.
- **Task Recipes:** Parameterized workflow capture and deterministic replay for recurring tasks.

#### Browser
- **Chromium Foundation:** Tab management, history, bookmarks, downloads, and zoom controls.
- **Chrome Extensions:** Manifest V2/V3 unpacked extension support.
- **Multi-Tab Orchestration:** Parallel worker tab execution with dedicated live dashboard.
- **Background Execution:** Non-blocking task execution in worker tabs.

#### Privacy
- **Local-First AI:** Zero cloud data transfer when paired with Ollama local inference.
- **Encrypted Secrets:** OS-level key encryption using Electron `safeStorage` (DPAPI/Keychain).
- **Cloud Usage Indicator:** Real-time visual indicator distinguishing local vs. cloud execution.
- **Budget Controls:** Token and dollar spend limits per task and per month.
- **Granular Forget Controls:** Ability to clear site memory, purge logs, or perform full factory reset.

#### Accessibility
- **Voice Control:** Hands-free speech-to-text input via push-to-talk.
- **Speech Narration:** Natural text-to-speech audio narration of agent actions and task results.
- **Keyboard Navigation:** Full hotkey support including `Ctrl+Shift+Space` agent summon.
- **Screen Reader Support:** Accessible ARIA live regions and semantic markup.


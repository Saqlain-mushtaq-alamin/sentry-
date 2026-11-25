# Data Handling & Privacy

Sentry is built upon a fundamental principle: **your browsing data belongs to you**.

---

## Local vs. Cloud Data Handling

| Data Type | Local Model (Ollama) | Cloud Model (OpenAI / Anthropic / Google) |
|-----------|----------------------|-------------------------------------------|
| **Browsing History & Bookmarks** | Stored locally in SQLite / JSON | Stored locally; never sent to cloud |
| **Passwords & Secrets** | Encrypted with OS `safeStorage` (DPAPI/Keychain) | Encrypted locally; never sent in prompt payloads |
| **Page Text for Active Task** | Processed in RAM by local Ollama instance | Transmitted over TLS to chosen model provider API |
| **Telemetry & Metrics** | 100% Opt-In only (disabled by default) | 100% Opt-In only (disabled by default) |

---

## Granular Forget Controls

Sentry allows you to delete agent memory with granular control:
- **Forget This Site:** Erase all stored context, page snapshots, and action logs for a specific origin.
- **Clear Action Logs:** Erase execution history while keeping bookmarks and saved recipes.
- **Forget Everything:** One-click nuclear reset restoring Sentry to initial clean-slate state.


# Security Architecture Overview

Sentry employs a **three-layer defense-in-depth model** designed to keep autonomous AI agents safe when operating in untrusted web environments.

---

## The Three Layers of Defense

```
┌────────────────────────────────────────────────────────┐
│ Layer 1: Ingestion & Input Sanitization                │
│ • Hidden DOM scanner (opacity 0, display none)         │
│ • 50+ Pattern heuristic & semantic rules               │
│ • CSS offscreen / microscopic font stripper            │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Layer 2: Action Firewall & Risk Gating                 │
│ • 4-tier risk classification engine                    │
│ • Website Trust Level policies (Read-Only vs Act)      │
│ • Confirmation gating for sensitive state changes      │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Layer 3: Auditability & Local-First Storage            │
│ • Tamper-evident hash-chained audit log                │
│ • Encrypted credential store (safeStorage / DPAPI)     │
│ • Granular forget controls (clear site/domain memory)  │
└────────────────────────────────────────────────────────┘
```

---

## Sandboxed Process Model

Following standard security practices, Sentry isolates its components:
1. **Main Process (Node.js/Electron):** Runs CDP controllers, native file I/O, and firewall policies. Never executes unvetted web script directly.
2. **Preload Script:** Communicates strictly via typed IPC channels with `contextIsolation: true` and `nodeIntegration: false`.
3. **Renderer Process (Web/React):** Renders browser chrome UI and agent controls in an isolated sandbox.
4. **WebContentsView Pages:** Render user websites in separate sandboxed Chromium render processes.


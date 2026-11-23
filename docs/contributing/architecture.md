# Codebase Architecture Guide

A technical overview of the Sentry codebase layout and core subsystems.

---

## Directory Structure

```
src/
├── main/                       # Electron Main Process (Node.js)
│   ├── action-layer/           # Action Firewall, Risk Classifier, Trust Manager, Audit Log
│   │   └── injection-detector/ # Pattern matcher, hidden element scanner, content sanitizer
│   ├── agent/                  # Agent brain, ReAct loop, model adapters, recipe manager
│   │   ├── adapters/           # Ollama, Anthropic, OpenAI, Google adapter implementations
│   │   ├── benchmarks/         # AgentDojo and adversarial evaluation runners
│   │   └── prompts/            # System prompts and ReAct framing
│   ├── browser/                # Tab manager, storage manager, download manager, shortcuts
│   ├── cdp/                    # Chrome DevTools Protocol client, page observer, action executor
│   ├── extensions/             # Chrome extension loader and lifecycle
│   ├── telemetry/              # Performance profiler, token tracker
│   ├── updater/                # Production auto-updater (Phase 16)
│   ├── voice/                  # Audio transcription and TTS
│   └── index.ts                # Application entry point, window management, IPC dispatcher
├── preload/                    # Electron Preload Bridge (contextBridge)
├── renderer/                   # React 18 UI Application (Vite + TypeScript)
│   ├── components/             # Address bar, tab bar, command box, update notification
│   ├── hooks/                  # Custom React hooks (e.g. useHideNativeView)
│   ├── overlays/               # Action preview, injection alert, multi-tab dashboard
│   ├── pages/                  # Internal sentry:// pages (Settings, NewTab, Recipes, DevMode)
│   └── App.tsx                 # Main application component & layout orchestrator
└── shared/                     # Cross-process types, IPC channel constants, updater contracts
```

---

## Process Communication (IPC)

All communication between the renderer and main process is strictly typed and routed through `src/shared/ipc.ts`. 

- **Renderer to Main:** `window.sentry.<namespace>.<method>()` calls `ipcRenderer.invoke()`.
- **Main to Renderer:** `mainWindow.webContents.send(channel, payload)` broadcasts real-time events.
- **Context Isolation:** Enabled at all times. Direct Node.js access is barred from renderer scripts.


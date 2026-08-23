# Architecture & Technology Decision

## Summary
After running a spike with Electron and evaluating Tauri's constraints (specifically around Chromium extension support on Windows/macOS), the decision is to proceed with **Electron + React + Puppeteer Core**.

## Evaluation: Tauri vs. Electron

| Criterion | Electron | Tauri |
|-----------|----------|-------|
| Chromium/webview control | 5 (Full CDP access, session control) | 3 (Limited CDP on system webviews) |
| CDP access quality | 5 (Native CDP, <20ms latency) | 2 (Unreliable across OS system webviews) |
| Extension compatibility | 5 (Supports Chrome extensions via session) | 0 (No support for Chrome extensions on Windows/macOS) |
| Binary size & memory | 2 (Bloated, 100MB+ binary) | 5 (Small, <10MB binary) |
| Cross-platform build | 4 (Standardized Chromium behavior everywhere) | 4 (Uses OS native webview) |
| Ecosystem & community | 5 (Massive, well-documented) | 3 (Growing, but niche for complex browser shells) |
| Security surface | 2 (Bundles full browser, larger surface) | 4 (Smaller surface, but less consistent) |

### Spike Measurements (Electron)
- **Startup & Page Load**: ~215ms
- **CDP Connection**: Successful
- **Overlay Injection Latency**: ~1ms
- **DOM Extraction Latency**: ~1ms (DOM length ~800 bytes for basic page)
- **Accessibility Tree Latency**: ~6ms
- **Programmatic Click Latency**: ~13ms

## Conclusion & Justification
**Decision: Electron**
The critical requirement is Extension Compatibility (FR14: uBlock Origin, Password Managers) and deep CDP integration. Tauri uses the system webview (WebView2 on Windows, WebKit on macOS), which **does not support Chrome extensions**. This alone disqualifies Tauri for a fully-featured browser replacement. While Electron has a larger binary size and memory footprint, its maturity in CDP integration, cross-platform consistency, and extension support makes it the only viable choice for the Sentry agentic browser.

**CDP Library: puppeteer-core**
Puppeteer-core is lightweight and connects flawlessly to the running Electron instance's CDP endpoint. It provides the exact APIs needed for DOM extraction, accessibility tree building, and programmatic actions.

**Frontend Framework: React + TypeScript**
React will be used for the browser shell UI (tab bar, overlays, settings). The spike showed overlay injection latency is negligible (~1ms).

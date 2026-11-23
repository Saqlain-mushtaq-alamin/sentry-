# Multi-Tab Orchestration

Modern workflows frequently span multiple browser tabs. Sentry includes a dedicated **Multi-Tab Coordinator** capable of parallelizing tasks and aggregating results across separate pages.

---

## Capabilities

- **Parallel Data Gathering:** Scrape pricing or specs from 5 tabs simultaneously instead of sequentially.
- **Cross-Tab Verification:** Compare information in Tab A (e.g. shipping address in an email) with Tab B (order details).
- **Background Execution:** Let long-running tasks progress in non-active tabs while you continue reading or browsing in your foreground tab.

---

## Multi-Tab Dashboard

When an orchestrated multi-tab task is active:
1. Sentry opens a **Multi-Tab Dashboard** overlay showing the live status of each worker tab.
2. You can pause, resume, or abort individual worker tabs.
3. Automatic tab grouping organizes worker tabs with a distinct color tag so they do not clutter your daily browsing.


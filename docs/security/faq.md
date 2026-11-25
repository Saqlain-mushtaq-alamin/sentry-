# Security FAQ

### Can the agent purchase items or transfer money without my permission?
**No.** Any financial transaction, payment button, or checkout submit is classified by the Action Firewall as **Tier 4 (High Impact / Irreversible)**. Sentry will freeze execution and present an explicit confirmation prompt displaying the exact amount, merchant, and payload.

### Can a website access my API keys?
**No.** Web pages rendered in the browser run in isolated Chromium renderer processes. API keys reside exclusively in the Electron main process, encrypted on disk with operating system credentials (`safeStorage`). Web content has no direct access to Electron APIs or environment variables.

### What happens if an indirect prompt injection is found on a page?
Sentry halts task progress on that tab, flags the offending element, displays an **Injection Alert** overlay to the user with the suspicious text snippet, and asks whether you wish to abort or continue in Read-Only mode.

### Does Sentry track my browsing habits?
**No.** Sentry collects zero tracking telemetry by default. The optional beta metrics collector requires explicit user opt-in in **Settings → Privacy & Beta**, and only logs coarse aggregates (e.g. number of tasks completed) without URLs or page contents.


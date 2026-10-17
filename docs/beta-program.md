# Beta Program

Pre-launch beta for Sentry (Phase 15, Task 15.6). Target: **20–50 users**, catching real-world issues before public launch.

---

## Entry criteria

Beta builds ship only when all of the following hold:

- [ ] All E2E tests pass (`npm run test:e2e` — 6 workflows)
- [ ] No known critical (P0/P1) bugs — see `docs/bug-triage.md`
- [ ] Security audit passed (adversarial suite green, AgentDojo gates configured)
- [ ] Performance targets met (startup, memory, frame timing from Phase 14)
- [ ] Regression CI green on all three OS targets

Results as of the current build are tracked in `docs/beta-results.md`.

---

## Distribution pipeline

- **Build:** `npm run package:beta` → electron-builder with `-c.extraMetadata.channel=beta`.
- **Channel resolution:** `SENTRY_CHANNEL` env → `package.json` `channel` field → `stable`. Beta builds self-identify as `beta`.
- **Publish:** generic feed configured in `electron-builder.yml` (`https://updates.sentrybrowser.dev`, channel `beta`). QA/staging installs override with `SENTRY_UPDATE_URL`.
- **Auto-update:** `UpdateService` checks every 6 hours, auto-downloads, installs on quit; manual check/download/install exposed as `beta:*` IPC. Status events (`beta:update-status`) surface in the renderer.
- **Consent:** crash reporting starts only with user consent **and** `SENTRY_CRASH_REPORT_URL` set; telemetry only records when `betaTelemetryEnabled` is on.

Install flow for beta testers: download the beta installer from the invite link, opt into data sharing in the feedback dialog (opt-out by default), report issues via the titlebar **Feedback** button.

---

## Feedback collection

1. **In-app feedback form** (titlebar → Feedback): categories *Something went wrong* / *Suggestion* / *Compliment*, free-text message (max 4000 chars), optional contact email, optional diagnostic logs, telemetry + crash-reporting consent toggles. Submissions queue locally via `FeedbackService` for the beta report.
2. **Crash reports** — Electron `crashReporter` with system info (OS, version, channel) when consented and configured.
3. **Weekly check-in survey** (sent to beta testers every week):
   - How often did you use Sentry this week? (daily / a few times / once / never)
   - What worked well?
   - What didn't work?
   - Would you switch to Sentry from your current browser? Why / why not?

---

## Metrics tracked

`BetaMetricsCollector` persists per-day counters (consent-gated), exposed via `beta:get-metrics`:

| Metric | Source | Target |
|--------|--------|--------|
| Daily active users / sessions | `startSession()` per launch | 20+ actives during beta |
| Tasks started vs completed | `task-started` / `task-completed` events | completion rate > 80% |
| Task failures | `task-failed` | trending down week over week |
| Firewall confirmations accepted vs denied | `confirmation-accepted` / `-denied` | ratio observed, no target |
| Injection detections | `injection-detected` | false positive rate < 10% |
| Crashes per session | `recordCrash()` | < 0.1 (spec: < 1 per 10 sessions) |
| Startup time | `recordStartup()` | Phase 14 target maintained |
| Feature usage | `recordFeatureUse()` | identify least-used features |
| AgentDojo gates | `AgentDojoBenchmark.runSuite()` | attack < 5%, completion > 80%, FP < 10% |

---

## Rollout plan

| Wave | Size | Focus |
|------|------|-------|
| 0 | Internal (3–5) | Packaging, update feed, crash pipeline end-to-end |
| 1 | 10–15 invited | Core browsing + agent tasks on daily-driver sites |
| 2 | 20–35 total | Recipes, multi-tab, extensions, voice |
| 3 | up to 50 | Two-week soak before launch decision |

## Exit criteria → launch

- 20+ beta users completed the onboarding flow
- Crash rate < 1 per 10 sessions over the final week
- No open P0/P1 bugs
- Task completion rate > 80% and AgentDojo attack rate < 5% from collected data
- Feedback queue triaged; P2/P3 fixes landed or explicitly deferred

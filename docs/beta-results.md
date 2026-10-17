# Beta Test Results Report

**Phase 15 — Testing, QA & Pre-Release** · Status as of the current build (branch `development_wp`)

This report combines (a) the automated QA results that gate the beta entry criteria and (b) the running scoreboard for the live beta program (Task 15.6). Automated sections are refreshed by CI (`.github/workflows/regression.yml`); live-user sections update as beta waves report in.

---

## 1. Test suite summary

| Suite | Location | Files | Tests | Status |
|-------|----------|-------|-------|--------|
| Unit | `tests/unit/` | 45 | 546 | ✅ all pass |
| Integration | `tests/integration/` | 7 | 60 | ✅ all pass |
| Adversarial | `tests/adversarial/` | 2 | 59 | ✅ all pass |
| Stress | `tests/stress/` | 1 | 5 | ✅ all pass |
| E2E (Playwright) | `tests/e2e/` | 6 | 6 | ✅ 6/6 in ~17s |
| **Total** | | **61** | **676** | **✅ green** |

Deliverable check: integration 30+ ✅ (60), E2E 5+ ✅ (6 workflows: app launch, onboarding, agent task, recipe workflow, security injection, tab orchestration), adversarial 50+ ✅ (59 attack scenarios).

## 2. Coverage (Task 15.1)

`npm run test:coverage` — v8 provider over `src/main/**`, `src/shared/**`, `src/preload/**` (renderer gated via jsdom component tests; `src/main/index.ts` exercised by E2E):

| Scope | Lines | Functions | Branches | Gate |
|-------|-------|-----------|----------|------|
| **Overall** | **88.23%** | **84.04%** | **88.38%** | 80/80/75 ✅ |
| `action-firewall.ts` | 98.7% | — | 90.5% | 95/90 ✅ |
| `risk-classifier.ts` | 98.5% | — | 95.0% | 95/90 ✅ |
| `permission-manager.ts` | 100% | — | 100% | 90/85 ✅ |
| `audit-log.ts` | 97.9% | — | 96.6% | 90/85 ✅ |
| `trust-manager.ts` | 92.7% | — | 92.3% | 90/80 ✅ |
| `injection-detector/**` | gate met | — | gate met | 95/85 ✅ |
| `react-loop.ts` | 96.2% | — | 86.4% | 85/75 ✅ |
| `recipe-replay.ts` | 100% | — | 96.2% | 85/80 ✅ |
| `element-resolver.ts` | 100% | — | 100% | 85/70 ✅ |
| `tab-manager.ts` | 91.9% | — | 75.8% | 80/70 ✅ |

Per-path thresholds are enforced in `vitest.config.ts`; the coverage job exits non-zero on any regression. Security-critical modules clear the 95% target.

## 3. Security validation

- **Adversarial suite:** 59/59 defended (injection evasions, firewall bypass attempts, direct-IPC bypass, confirmation-race, risk-downgrade attempts).
- **AgentDojo benchmark:** `src/main/agent/benchmarks/agentdojo.ts` — 12 tasks (6 attack / 6 benign across banking, airline, travel, workspace) with strict gates: **attack < 5%, task completion > 80%, false positives < 10%**. Harness unit-tested (11 tests); full live runs require a reachable model (Ollama or cloud key) and are triggered via `agentService.runBenchmark('agentdojo')`.
- **Lint:** 126 errors — identical to the pre-Phase-15 baseline; no new violations from this phase's code.
- **Typecheck:** `npm run typecheck` clean (strict mode, main + renderer).

## 4. Beta pipeline delivery status (Task 15.6)

| Component | Status |
|-----------|--------|
| Beta channel builds (`npm run package:beta`, channel resolution env → package.json → stable) | ✅ |
| Auto-update (`UpdateService`, 6h checks, `beta:update-status` events, `SENTRY_UPDATE_URL` override) | ✅ |
| In-app feedback (titlebar → Feedback dialog: bug/suggestion/compliment, logs opt-in, consent toggles) | ✅ |
| Feedback queue with system info (`FeedbackService`, persists to beta-feedback.json) | ✅ |
| Metrics (`BetaMetricsCollector`, per-day persisted KPIs, consent-gated `metricsListener` on AgentService) | ✅ |
| Crash reporting (`startCrashReporter`, consent + `SENTRY_CRASH_REPORT_URL` required) | ✅ |
| Consent defaults | ✅ telemetry **off**, crash reporting **off** until opted in |

Unit coverage for the beta modules: **96.05% lines / 90.44% branches** (45 tests).

## 5. Beta entry criteria (Task 15.6.4)

- [x] All E2E tests pass — 6/6
- [x] No known critical bugs — no open P0/P1 (see §7)
- [x] Security audit passed — adversarial suite green, coverage gates enforced
- [x] Performance targets met — Phase 14 hardening metrics maintained; `recordStartup` instruments startup for beta observation
- [x] Regression tests run automatically in CI — `.github/workflows/regression.yml` (push/PR to main & release/*, daily 6 AM UTC, 3-OS matrix, coverage + E2E artifacts)

## 6. Live beta scoreboard (updated per wave)

Targets from `docs/beta-program.md`:

| KPI | Target | Current |
|-----|--------|---------|
| Beta users onboarded | 20–50 | Wave 0 (internal) — instrumentation ready |
| Crashes per session | < 0.1 | pending data collection |
| Task completion rate | > 80% | pending (in-app counter live) |
| Injection false positive rate | < 10% | pending |
| AgentDojo attack success | < 5% | harness gates configured; live run pending model access |
| Weekly survey responses | weekly cadence | first survey scheduled after wave 1 |

Data sources: `beta:get-metrics` (`BetaMetricsSnapshot`), queued feedback export, crash reports. Report this table weekly alongside the survey answers ("How often did you use Sentry this week? What worked? What didn't?").

## 7. Known issues ledger

All findings from Phase 15 QA, triaged per `docs/bug-triage.md`. **No P0/P1 open.**

| # | Priority | Component | Issue |
|---|----------|-----------|-------|
| 1 | P2 | firewall | `AuditLog.getEntries()` returns a shallow copy — callers can mutate stored entries |
| 2 | P2 | firewall | `RiskTier.CRITICAL` compared as raw string in audit-log (tier changes won't match) |
| 3 | P2 | browser | `sentry://newtab` views never call `loadURL`, so `debugger.attach` hangs (E2E works around via `about:blank`) |
| 4 | P2 | agent | `stop()` cancel message mostly unreachable — `TaskStateMachine.stop` transitions to FAILED first |
| 5 | P2 | firewall | 25 ms rate limiter can collide with recipe step timing (rapid-fire false positives) |
| 6 | P2 | agent | `agent:routing-decision` IPC serialization fails when the adapter object is included |
| 7 | P3 | browser | Tab-grouper `autoCloseOnComplete` setting is never read |
| 8 | P3 | browser | `secret-store.delete()` rewrites the file even when nothing matched |
| 9 | P3 | browser | cdp-manager attach/waitForLoad timing quirks under rapid navigation |

## 8. Exit criteria → launch

- [ ] 20+ beta users completed onboarding
- [ ] Crash rate < 1 per 10 sessions over the final week
- [ ] No open P0/P1 bugs
- [ ] Task completion > 80% and AgentDojo attack < 5% from collected data
- [ ] Feedback queue fully triaged; P2/P3 fixes landed or deferred with sign-off

---

### How to refresh this report

```bash
npm run typecheck && npm run lint   # baselines: 0 new type errors, 0 new lint errors
npm run test:coverage               # gates: 80/80/75 overall + per-path security gates
npm run test:e2e                    # requires npm run build first
```

CI runs the same steps on every push and nightly; artifacts (coverage HTML, Playwright results) upload per-OS.

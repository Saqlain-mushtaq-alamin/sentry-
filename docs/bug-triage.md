# Bug Triage Process

Structured bug handling for the Sentry beta and pre-release period (Phase 15, Task 15.7).

---

## Priority Levels

| Priority | Definition | Examples | Target fix |
|----------|-----------|----------|-----------|
| **P0** | Security vulnerability or data loss | Firewall bypass, credential exfiltration via injection, secret-store leak | Within **24 hours** |
| **P1** | Crash or feature completely broken | App crashes on launch, agent cannot execute any task, tabs never load | Within **3 days** |
| **P2** | Feature partially broken or major UX issue | Confirmation dialog misses an explanation, recipe replay skips a step | Within **1 week** |
| **P3** | Minor UX issue or cosmetic bug | Misaligned control, wrong hover state, truncated label | Before launch |
| **P4** | Enhancement or nice-to-have | New shortcut, cosmetic theme option | Post-launch |

Rules:

- When in doubt, triage **up**, not down. Downgrading requires triage sign-off.
- A P0 security report never waits for a scheduled triage slot.
- A crash that only occurs on one OS is still a P1 if it blocks that OS entirely.

---

## Components

Every report is tagged with a component so it reaches the right area quickly:

| Component | Scope |
|-----------|-------|
| `firewall` | Action firewall, risk classification, confirmations, audit log |
| `agent` | ReAct loop, planner, model router, recipes, multi-tab orchestration |
| `browser` | Tab manager, navigation, downloads, storage, CDP attach/detach |
| `security` | Prompt-injection detector, trust manager, permission manager |
| `extension` | MV3/MV2 bridge, capabilities |
| `ui` | Renderer components, onboarding, sidebar, notifications |
| `perf` | Startup, memory, unload/freezing, render performance |
| `packaging` | Build, installers, auto-update, beta channel |
| `voice` | Transcription, TTS, accessibility shortcuts |

---

## Bug Report Template

```markdown
## Bug Report
**Priority:** P?
**Component:** (Firewall / Agent / Browser / Extension / UI)
**Steps to reproduce:**
1. ...
2. ...
3. ...
**Expected behavior:** ...
**Actual behavior:** ...
**System info:** OS, RAM, GPU, Sentry version
**Screenshots/recordings:** (if applicable)
```

Additional context that helps:

- Model configuration (local Ollama / cloud / routing mode) for agent bugs
- Whether firewall confirmation appeared, and which tier was shown
- Injection detection banner content for security bugs
- Feedback ID from the in-app form (links to the queued feedback entry)
- `beta-metrics.json` / feedback export when reporting stability issues

---

## Workflow

1. **Report** — in-app feedback form, crash report, E2E/CI failure, or issue tracker.
2. **Triage** — assign priority + component using the tables above; duplicate-check against open reports.
3. **Reproduce** — write a failing test first whenever the bug can be expressed as one:
   - security/regression → `tests/adversarial/` or `tests/integration/`
   - logic → `tests/unit/`
   - user workflow → `tests/e2e/`
4. **Fix** — reference the test in the commit message; security fixes must add an adversarial case that fails before the fix.
5. **Verify** — `npm run test:coverage` and the regression workflow must be green; P0/P1 also require the relevant E2E spec.
6. **Close** — note root cause and whether a process change prevents recurrence.

### Cadence

- **During beta:** triage daily (queue sorted by priority, then age).
- **Pre-launch:** triage on every change to `src/main/action-layer/` or `src/main/agent/` regardless of schedule.
- **Exit rule:** no open P0 or P1 bugs is an entry criterion for launch (see `docs/beta-program.md`).

### Security reports (P0)

- Do not file publicly until a fix ships or an advisory is published.
- Attach the failing adversarial test in the fix PR; confirm `test:adversarial` fails without the patch.
- Re-run `AgentDojoBenchmark.runSuite()` gates (attack < 5%) after the fix.

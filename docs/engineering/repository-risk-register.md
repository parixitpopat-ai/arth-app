# Repository Risk Register

`Opened 2026-08-01`

Distinct from other artifacts:
- **Technical Debt** items get *paid down* — they're resolved by a specific change.
- **Bugs** get *fixed*.
- **EDL entries** explain *why a decision was made*.
- **Risk Register items** are *monitored*, not implemented — they span multiple modules and sprints, and typically only close when an entire phase of work (not a single ticket) resolves them.

| ID | Risk | Status | Evidence | Resolves when |
|---|---|---|---|---|
| RSK-001 | `App.jsx` monolith — 90%+ of app in one file | Active | ARCH-001, ARCH-002 | Extraction reaches Tier 5/6 completion (ARCH-005) |
| RSK-002 | No automated tests exist anywhere in the repo | **Partially addressed** (2026-08-03) | ARCH-001 §Testability (0/10 originally); TRX-002A introduced the first 4 tests, covering the new Application Layer plumbing only — `App.jsx`'s 16,349 lines remain at 0 coverage | A real test suite exists and covers at minimum the Transaction/Settlement domain (still open — TRX-002A covers plumbing, not business logic yet) |
| RSK-003 | Local state explosion — 596 `useState`, no store/Context, state duplicated across components | Active | ARCH-001, ARCH-005 (596 useState; 3 confirmed bugs from duplicated state this session) | A real state-ownership model exists (single-ledger direction per ADR-032, or equivalent) |
| RSK-004 | Git history decision pending on 3 removed backup files | Monitoring | SEC-001 | Product Owner decides + executes history rewrite, or explicitly accepts the exposure |

## Notes per item

**RSK-001** and **RSK-003** are related but distinct: RSK-001 is a *file organization* risk (everything in one place), RSK-003 is a *state management* risk (everything sharing one closure). Extracting `AddModal` into its own file (resolving part of RSK-001) doesn't automatically resolve RSK-003 unless the extraction also gives it real props/store access instead of just moving the same closure-coupled code to a new file that still imports everything it needs from a shared context object. Worth keeping these separate so one doesn't get marked resolved on the other's work.

**RSK-002** is the risk multiplier behind nearly every other finding in this project so far — it's why "the build succeeds" has never been sufficient evidence that a change is safe, and why every extraction tier in ARCH-005 carries a manual-verification requirement instead of an automated one.

**RSK-004** is explicitly not an engineering risk — SEC-001's engineering work is done. This stays open only because a governance decision is still pending.

## Review cadence

No formal cadence set yet. Suggested: revisit this register at the close of each `XXX-000` audit, since module audits are where new cross-cutting risks are most likely to surface.

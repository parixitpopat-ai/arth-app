# Budget v1.0 — Engineering Dashboard

**Purpose:** Track delivery, not design. Updates as PRs merge — not on any other cadence.

**Program status:** 🟢 Design Complete · Engineering Active. BUD-002 (Budget UX & Product Specification) frozen v1.0, 2026-08-06 — design stream closed, see `BUD-CLOSE-001`.

**CR-ACC-BUD-001 — Resolved** (was previously shown here as open; corrected 2026-08-06 — see the CR document's own header, which already said Resolved). Person Attribution fully closed; Category Attribution path recommended, non-blocking. WP-3 is no longer CR-gated — re-evaluate its actual readiness against WP-1/WP-2 completion alone.

```
WP-1  Allocation Engine Integration    ███░░░░░░░ PR-1 merged (adapter interfaces)
WP-2  Financial Calendar Integration   ░░░░░░░░░░ Not Started
WP-3  Budget Storage Migration         ░░░░░░░░░░ Not Started
WP-4  Budget UI Modernization          ░░░░░░░░░░ Not Started — unblocked by design; BUD-002 provides full spec
WP-5  Insights Migration               ░░░░░░░░░░ Not Started
WP-6  Legacy Cleanup                   ░░░░░░░░░░ Not Started
WP-7  Regression & Release             ░░░░░░░░░░ Not Started
```

| WP | Status | PRs Merged | Notes |
|---|---|---|---|
| WP-1 | In Progress | 1 (PR-1) | Adapter interfaces done, tests passing. PR-2 (household consumer migration) next. |
| WP-2 | Not Started | 0 | Unblocked — no longer gated on CR-ACC-BUD-001 |
| WP-3 | Not Started | 0 | **No longer CR-gated** (correction, 2026-08-06). Still needs WP-1 + WP-2 complete per BUD-001 §4 sequencing — that dependency is unchanged, only the CR block is lifted. |
| WP-4 | Not Started | 0 | Blocked on WP-1 (in progress) and UX-001 (Product/Design owns the Planning Allocation Editor's visual pass — BUD-002 Part D.2/Part E now give it a complete structural spec to design against) |
| WP-5 | Not Started | 0 | Blocked on WP-4 |
| WP-6 | Not Started | 0 | Blocked on WP-3 (full completion, not just started — per BUD-003 note) |
| WP-7 | Not Started | 0 | Blocked on all above |

**Bugs:** none logged.
**Change Requests:** CR-ACC-BUD-001 (Resolved) — see `CR-ACC-BUD-001-change-request.md`. No other CRs open against Budget.

---

*Updated on merge, not on schedule. Corrected 2026-08-06 to reflect CR-ACC-BUD-001's actual resolved status and BUD-002's freeze — both had drifted from this file.*

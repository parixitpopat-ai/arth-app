# Budget v1.0 — Engineering Dashboard

**Purpose:** Track delivery, not design. Updates as PRs merge — not on any other cadence.

**✅ CR-ACC-BUD-001 resolved** (2026-08-10 governance decision, see `CR-ACC-BUD-001-decision-memo.md`). WP-3 is unblocked from the CR, **contingent on the Planning Allocation aggregate (modeled on `Account`) being built before WP-3's storage migration proceeds** — the CR resolved *what* to build, not a substitute for building it. Category-dimension Attribution remains open but is explicitly non-blocking per the CR. WP-1 is complete and unaffected (read-only, no persistence touched).

```
WP-1  Allocation Engine Integration    ███░░░░░░░ PR-1 merged (adapter interfaces)
WP-2  Financial Calendar Integration   ░░░░░░░░░░ Not Started
WP-3  Budget Storage Migration         ░░░░░░░░░░ Not Started
WP-4  Budget UI Modernization          ░░░░░░░░░░ Not Started
WP-5  Insights Migration               ░░░░░░░░░░ Not Started
WP-6  Legacy Cleanup                   ░░░░░░░░░░ Not Started
WP-7  Regression & Release             ░░░░░░░░░░ Not Started
```

| WP | Status | PRs Merged | Notes |
|---|---|---|---|
| WP-1 | In Progress | 1 (PR-1) | Adapter interfaces done, tests passing. PR-2 (household consumer migration) next. |
| WP-2 | Not Started | 0 | — |
| WP-3 | **Unblocked — Planning Allocation aggregate prerequisite** | 0 | CR-ACC-BUD-001 resolved; blocked on WP-1/WP-2 completion and on building the Planning Allocation aggregate (§7) before storage migration proceeds |
| WP-4 | Not Started | 0 | Blocked on WP-1 (in progress), UX-001, and WP-3's aggregate prerequisite |
| WP-5 | Not Started | 0 | Blocked on WP-4 |
| WP-6 | Not Started | 0 | Blocked on WP-3 (full completion, not just started — per BUD-003 note) |
| WP-7 | Not Started | 0 | Blocked on all above |

**Bugs:** none logged.
**Change Requests:** CR-ACC-BUD-001 (resolved 2026-08-10) — see `CR-ACC-BUD-001-change-request.md` and `CR-ACC-BUD-001-decision-memo.md`.

---

*Updated on merge, not on schedule. This file — not a new document — is where WP-1's first PR moves the needle.*

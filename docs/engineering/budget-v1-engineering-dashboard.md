# Budget v1.0 — Engineering Dashboard

**Purpose:** Track delivery, not design. Updates as PRs merge — not on any other cadence.

**⚠️ CR-ACC-BUD-001 open.** WP-3 and beyond are paused pending reconciliation of Budget's implementation architecture against the real `AggregateRoot`/read-model patterns discovered in Accounts. WP-1 is complete and unaffected (read-only, no persistence touched). WP-2 may proceed only once confirmed read-only per the CR.

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
| WP-3 | **Paused — CR-ACC-BUD-001** | 0 | Blocked on WP-1/WP-2 AND on CR resolution — do not resume on WP-1/WP-2 completion alone |
| WP-4 | Not Started | 0 | Blocked on WP-1 (in progress), UX-001, and indirectly on WP-3's CR resolution |
| WP-5 | Not Started | 0 | Blocked on WP-4 |
| WP-6 | Not Started | 0 | Blocked on WP-3 (full completion, not just started — per BUD-003 note) |
| WP-7 | Not Started | 0 | Blocked on all above |

**Bugs:** none logged.
**Change Requests:** CR-ACC-BUD-001 (open) — see `CR-ACC-BUD-001-change-request.md`.

---

*Updated on merge, not on schedule. This file — not a new document — is where WP-1's first PR moves the needle.*

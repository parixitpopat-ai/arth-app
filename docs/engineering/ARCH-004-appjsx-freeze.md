# ARCH-004 — App.jsx Freeze

`Opened 2026-08-01` · Status: **Active (Frozen Governance Rule)** — signed off 2026-08-01

## Objective

Stop the monolith from growing while ARCH-002/003/005 and the module `-000` audits pay down the existing debt.

## Rule

**No new feature work may be added directly to `src/App.jsx`. New functionality must be introduced through extraction into the appropriate module.**

### Exceptions (permitted directly in App.jsx)

- Bug fixes
- Logging
- Telemetry
- Emergency production hotfixes

Everything else requires extraction. This keeps the freeze from blocking urgent production support while still stopping net-new feature surface area from landing in the monolith.

## Why now, not after ARCH-002/003

Every day this file grows before its module boundaries are mapped is a day where:
- ARCH-002's dependency graph goes stale before it's even finished
- New code gets written with the same shared-closure-state pattern that already produced 3 confirmed bugs in one debugging session (bill status, person totals, linked-transaction mirroring)

Freezing doesn't require finishing the audit first — it just requires agreeing not to make the underlying problem bigger while the audit happens.

## Enforcement (practical, not process-heavy)

Given there's no CI/lint rule for this yet (worth its own small ticket — a pre-commit check that fails if a diff adds >N lines to `App.jsx` without an accompanying extraction), enforcement today is manual: this rule applies to whoever is writing code (currently: sessions like this one) and should be restated at the start of any thread that touches feature work.

## Standing Procedural Rules

- **(EDL-005)** No repository-wide refactoring may occur while a module audit is in progress unless it addresses a Critical (P0) security, data integrity, or production issue.
- **(EDL-012, ADR-032)** No `TRX-001+`/`ACC-001+`/etc. ticket may introduce, duplicate, or relocate a financial business rule unless its canonical owner is already defined by a frozen ADR or existing Canonical Business Rules Register entry.

## Status tracking

| Ticket | Status |
|---|---|
| ARCH-001 — Repository Inventory | ✅ Approved & Closed |
| ARCH-002 — Dependency Mapping | ✅ Complete |
| ARCH-003 — Repository Standards Validation | Blocked until ARCH-002 |
| ARCH-004 — App.jsx Freeze | ✅ Active (Frozen Governance Rule) |
| ARCH-005 — Monolith Extraction Strategy | ✅ Complete |
| SEC-001 — Repository Data Sanitization | ✅ Engineering complete, High severity (history decision pending) |
| TRX-000 — Transaction Module Audit | Ready — next |
| TRX-001+ | Blocked until TRX-000 |

**Agreed sequence:** ARCH-001 ✅ → ARCH-002 ✅ → ARCH-005 ✅ → SEC-001 ✅ (executed, history-rewrite decision pending) → TRX-000 (ready, split A/B/C/D) → TRX-001+

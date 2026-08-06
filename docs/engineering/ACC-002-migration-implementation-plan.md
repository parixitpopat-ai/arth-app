# ACC-002 — Migration & Implementation Plan

`Opened 2026-08-04` · **Status: ✅ Approved (Frozen)** — signed off 2026-08-04, track structure and WP-08 gate finalized · Input: ACC-000 (Frozen), ACC-001 (Frozen), AQ-003 (Frozen)

Bridges frozen architecture to first code change. No implementation begins from this plan alone — each work package still needs its own `ACC-00X` execution ticket when started, mirroring how `TRX-002A–D` executed against `ADR-034`'s sequencing rather than this document authorizing code changes directly.

---

## 1. Work package decomposition

**Resequenced 2026-08-04**, per the migration discovery: WP-02a (migration design) and WP-02b (resolution UX, if needed) now precede WP-02 (wiring) — data model migration before code-path changes, same discipline applied throughout.

| ID | Work Package | Targets (from ACC-000's Mutation Census / component audit) |
|---|---|---|
| WP-01 | `Account` aggregate scaffolding — no behavior change | New `src/domain/accounts/Account.js`, mirroring `Transaction.js`/`AggregateRoot.js`. Nothing calls it yet. |
| **WP-02a** | **Legacy account migration** — deterministic `type`→`behavior`/`classification` transformation, per ADR-035 | New `src/domain/accounts/migrateLegacyAccount.js`. Built-in types (bank/cash/cc/debit/upi) map deterministically, High confidence. Custom/unmapped legacy types resolve to an explicit `NEEDS_BEHAVIOR` unresolved state — never guessed, never defaulted to `"bank"`. Records that map but fail another invariant (e.g. debit with no `linkedBank`) resolve to `INVALID_DATA`, distinct from a mapping ambiguity. |
| **WP-02b** | **Resolution UX for unresolved classifications** (if required) | Product decision, not architecture — a wizard, dialog, settings screen, or deferred notification, whichever product decides. Only needed if WP-02a finds any `NEEDS_BEHAVIOR`/`INVALID_DATA` records in real user data; scope determined empirically, not assumed. |
| WP-02 | Account command layer — create/update | Repoints mutation sites #8–12 (L6293–6297, `AddAccountModal`) and #15 (L12370–12376, `EditAccountModal`) through `Account.create()`/`Account.update()`. **Now explicitly gated**: only begins once every account entering the aggregate has a valid `behavior` — i.e., after WP-02a has run and any WP-02b resolution is complete for the accounts in scope. |
| WP-03 | Extract `ledgerRows` into a domain projection | `AccDetailModal` L6735–6775 → `domain/accounts/ledger.js`, mirroring `domain/cards/summaries.js`'s established parameterized-pure-function pattern |
| WP-04 | Consolidate create/update invariants | Closes the duplicate-invariant finding (ACC-000 §2/§6) — by WP-02's completion this should already be true as a side effect, not a separate rewrite; this WP is verification, not new code |
| WP-05 | Archive workflow | New `Account.archive()`/`unarchive()`, new `status` field, UI entry points (currently none exist) |
| WP-06 | Deletion orchestration with mandatory reassignment | `AccountDeletionService` per ACC-001 §4; repoints mutation site #13 (L6674, `ConfirmDeleteAccount`); needs the reassignment-picker UX (ACC-001 §5, still open) |
| WP-07 | Reconciliation unification | Per AQ-003's resolution — repoints mutation sites #7 (L3935, SMS sync) and #16 (L16044, Balance-check screen) through one entry point; fixes the `accountBalance`-vs-`effectiveAccountBalance` comparison bug |
| WP-08 | CC `outstanding` canonicalization | Per AQ-001/CR-005 (already registered in the Transactions Change Register as CR-002/003/005) — repoints mutation sites #1–6; **this work package doesn't originate here, it's the Accounts-side completion of a CR already open under Transactions' register.** Cross-referenced, not duplicated. |
| WP-09 | Remove duplicated UI mutation logic | Delete the now-dead inline `setAccounts` calls in `AddAccountModal`/`EditAccountModal`/`ConfirmDeleteAccount` once WP-02/03/06 have working replacements |
| WP-10 | Final cleanup and dead-code removal | Retire the confirmed-dead `account.outstanding` stored field (pending CR-005's decision on cache-vs-retire), remove any now-orphaned helper functions |

Site #14 (snapshot restore, L7210) is intentionally **not** a work package — ACC-000 §7 already classified it Compliant, nothing to migrate.

## 2. Execution tracks (revised — dependency-accurate, not linear)

The earlier presentation implied a mostly-linear chain for review clarity. The actual dependency graph doesn't support that, and governance should reflect the real graph, not an aesthetic one:

```
WP-01 (Foundation)
  ├── Track A (Domain):     WP-02 → WP-04 (verification), WP-03
  ├── Track B (Lifecycle):  WP-04 → WP-05 → WP-06 (WP-06 also needs the
  │                          external reassignment-picker UX decision)
  └── Track C (Independent):WP-07 (reconciliation, per AQ-003 — no
                              dependency on Track B at all)

Closeout (gated, see §6):
  WP-08 (CC outstanding canonicalization — gated on Transactions register)
  WP-09 (Remove duplicated UI mutation logic — needs WP-02/03/06 verified)
  WP-10 (Final dead-code removal — needs WP-08/09 complete)
```

Track A and Track C can run fully in parallel with Track B — WP-06 (the highest-risk package) proceeding independently means Track A/C's lower-risk work isn't blocked waiting on it or on the reassignment-picker UX. WP-09/WP-10 stay distinct from WP-07/WP-08 respectively — merging "reconciliation" into "remove duplicated UI logic," or "CC outstanding" into "final cleanup," would attach the wrong gate to the wrong package (WP-08's Transactions-register gate is specific to CC outstanding; WP-10 has no such external dependency).

## 3. Risk assessment

| Work Package | Risk | Reason |
|---|---|---|
| WP-01 — Aggregate scaffolding | Low | Additive, nothing calls it yet |
| WP-02 — Command layer (create/update) | Medium | Touches live create/edit flows; regression risk on the 5 type-branches and the previously-missing UPI-link field (ACC-000 §2) |
| WP-03 — `ledgerRows` extraction | Medium | Projection behavior, not mutation — but it's an 11-way branch (ACC-000 §5) and any sign/attribution error would silently misreport account history |
| WP-04 — Invariant consolidation | Low | Verification of WP-02's side effect, not new logic |
| WP-05 — Archive workflow | Medium | New lifecycle state + UX surface, no prior implementation to regress against, but low blast radius (doesn't touch historical data) |
| WP-06 — Delete orchestration | **High** | Historical data integrity — this is exactly the mutation ADR-033-style orchestration exists to get right; a bug here doesn't just misreport, it can corrupt the ledger's referential integrity in the direction this whole workstream exists to prevent |
| WP-07 — Reconciliation unification | Medium | Touches two live user-facing flows (SMS sync, Balance-check) and changes what number SMS sync compares against — real behavior change for anyone currently relying on the (buggy) current comparison |
| WP-08 — CC outstanding canonicalization | Medium | Shared risk surface with Transactions' CR-002/003/005 — coordinate timing with whoever owns that register, don't schedule independently |
| WP-09 — Remove duplicated UI logic | Low | Refactor only, contingent on WP-02/03/06 already verified working |
| WP-10 — Final cleanup | Low | Dead-code removal, no behavior change |

## 4. Acceptance criteria

- No business logic remains in `AddAccountModal` or `EditAccountModal` — both call `Account` aggregate commands exclusively
- `EditAccountModal` uses the same command path as `AddAccountModal` (closes the duplicate-invariant finding for good, not just for the fields currently covered)
- `ledgerRows` is produced entirely by `domain/accounts/ledger.js`, zero attribution logic left in `AccDetailModal`
- All 16 census mutation sites route through either the `Account` aggregate, `AccountDeletionService`, or the reconciliation entry point — none remain as raw inline `setAccounts` calls, except site #14 (correctly infrastructure-boundary, excluded by design)
- No orphaned account references can exist — `AccountDeletionService` enforces ACC-001's frozen invariant in code, not just in the UI warning dialog
- Archive and Delete are separate commands with separate entry points
- SMS balance sync compares against `effectiveAccountBalance`, matching what's displayed

## 5. Test strategy

Mirroring what the Transactions workstream established:

- **Unit tests** for `Account` aggregate commands (create/update/archive/delete) — invariant violations should throw, mirroring `TransactionValidationError`'s pattern
- **Projection tests** for `ledgerRows`/`domain/accounts/ledger.js` — cover all 11 branches found in the current inline logic, including the linked-debit/linked-UPI special cases
- **Integration tests** for create/edit/archive/delete end-to-end
- **Migration tests** for reassignment — specifically, a transaction's `accId`/`fromAccId`/`toAccId` correctly updates and no orphan remains after a reassign-then-delete sequence
- **Regression tests** for balance calculations — `accountBalance`/`effectiveAccountBalance`/`accountReconciliationGap` before and after WP-07, since that work package is a genuine behavior change, not a pure refactor

## 6. Accounts Change Register (new — mirrors `CHANGE-REGISTER-transactions.md`'s schema)

| ID | Type | Source | Target | Governing Decision | Status | Implemented In |
|---|---|---|---|---|---|---|
| ACR-001 | Duplicate | Account create/update invariants — 2 locations (`AddAccountModal` L6293–6297, `EditAccountModal` L12370–12376) | `Account` aggregate | ACC-001 | Proposed | WP-02 |
| ACR-002 | New capability | No canonical owner today — feature doesn't exist | `Account.archive()`/`unarchive()` | ACC-001 §4 | Proposed | WP-05 |
| ACR-003 | Duplicate + gap | Account deletion, no-cascade defect (`ConfirmDeleteAccount` L6674) | `AccountDeletionService` | ACC-001 §4 (frozen invariant) | Proposed | WP-06 |
| ACR-004 | Duplicate | Reconciliation, 2 independent writers (L3935, L16044) | Accounts reconciliation entry point | AQ-003 | Proposed | WP-07 |
| ACR-005 | *(Cross-referenced, not owned here)* | CC `outstanding`, 6 sites | `Payable` | AQ-001, tracked as CR-002/003/005 in `CHANGE-REGISTER-transactions.md` | Tracked externally — **WP-08 gated, see below** | WP-08 |

**WP-08 engineering gate (explicit completion criterion, not a coordination note):**

> WP-08 may begin only after the owner of the Transactions Change Register confirms that all shared compatibility work tracked under CR-002, CR-003, and CR-005 has been completed or superseded.

This replaces the earlier, weaker "needs to weigh in" framing with a measurable precondition — WP-08 is blocked, full stop, until that confirmation exists, not merely "coordinated."

## 7. What this does not decide

- The reassignment-picker UX (still open, blocks WP-06's start, not this plan's sequencing)
- Whether Archive behaves differently for `cc` accounts (still open per ACC-001 §5, evidence-gathering deferred to WP-05's actual implementation, not speculated here)
- Exact timing coordination with the Transactions Change Register for WP-08/ACR-005 — needs whoever's driving that register, not decided unilaterally in this document

## 8. Implementation backlog (all 10 work packages preserved, organized by track)

1. **WP-01** — Account Aggregate scaffolding *(Foundation, no dependencies)*
2. **WP-02** and **WP-03** — begin in parallel *(Track A — Domain)*
3. **WP-04** and **WP-05** — lifecycle implementation, sequential within Track B
4. **WP-06** — Delete orchestration *(Track B, once the reassignment-picker UX is available)*
5. **WP-07** — Reconciliation unification *(Track C, fully parallel with Track B — no shared dependency)*
6. **WP-09** — Remove duplicated UI mutation logic *(Closeout, once WP-02/03/06 are verified working)*
7. **WP-08** — CC outstanding canonicalization *(Closeout, gated per §6's explicit criterion)*
8. **WP-10** — Final dead-code removal *(Closeout, after WP-08/09 complete)*

---

**Frozen 2026-08-04.** Track structure (§2) and the explicit WP-08 gate (§6) incorporated per review before freezing.

## 9. Work Package Log

| WP | Status | Behavioral Impact | Regression | Aggregate | Production Code Paths Routed |
|---|---|---|---|---|---|
| WP-01 | ✅ **Completed** 2026-08-04 | None | 95/95 (74 existing + 21 new) | Introduced (`Account`, additive only) | 0 |
| WP-02a | ✅ **Completed** 2026-08-04 | None — pure function, no call sites wired yet | 109/109 (74 existing + 24 account + 11 migration) | N/A — migration utility, not aggregate-owned | 0 |

## 10. Migration Notes — Behavior vs. Classification (ADR-035 amendment, 2026-08-04)

**WP-02a is complete** — `src/domain/accounts/migrateLegacyAccount.js`, deterministic, tested against every row of the migration decision table:

| Legacy state | New behavior | New classification | Confidence |
|---|---|---|---|
| Built-in Bank (any classification, e.g. Savings/Salary) | `bank` | Preserved from `accountTypeId`/`typeLabel` | High |
| Cash | `cash` | Preserved | High |
| Credit Card | `cc` | Preserved | High |
| Debit | `debit` | Preserved | High — but see `INVALID_DATA` below |
| UPI | `upi` | Preserved | High |
| Legacy custom type with no behavior mapping (Crypto, BNPL, etc.) | **Not assigned** | Preserved as label only | **Requires user decision — `NEEDS_BEHAVIOR`** |
| Built-in-type record failing another invariant (e.g. debit, no `linkedBank`) | **Not assigned** | N/A | **Data problem, not ambiguity — `INVALID_DATA`** |

**No guessing, by design and by test** (`account.test.js`/`migrateLegacyAccount.test.js` both assert this explicitly): an unresolved record is never coerced into `"bank"`, never inferred from its label. It's returned as `{ status: "unresolved", migrationState, legacy, ... }` — no `Account` instance is constructed for it, consistent with ADR-035's added principle that a classification without a behavior is a valid migration state, not a valid steady state.

**`WP-02b` is scope-pending, not yet started** — whether it's needed at all depends on whether any real user data actually contains `NEEDS_BEHAVIOR`/`INVALID_DATA` records once `migrateLegacyAccounts()` runs against real stored `accounts` arrays (not yet done — WP-02a built and tested the transformation function itself, running it against production-shaped data and deciding the UX for any unresolved records is WP-02b's job).

**WP-02's gate:** does not begin until every account entering the aggregate has a valid `behavior` — i.e., WP-02a has run and any WP-02b resolution is complete for the accounts in scope.

## Status

- ✅ AQ-003 — Frozen
- ✅ ACC-000 — Frozen
- ✅ ACC-001 — Frozen
- ✅ ACC-002 — Frozen

Accounts modernization transitions to **Active Implementation**, at the same governance maturity Transactions reached before its own implementation phase began.

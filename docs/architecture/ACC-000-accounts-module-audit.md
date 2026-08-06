# ACC-000 — Accounts Module Audit

`Opened 2026-08-04` · **Status: ✅ Frozen** — signed off 2026-08-04, AQ-003 approved · Method: `engineering-method-ownership-driven-modernization.md`

Renumbered from the original `ACC-001` per the established `XXX-000` audit-phase convention (TRX-000 precedent). `ACC-001` is reserved for CBR Reconciliation.

All line numbers verified against `src/App.jsx` (16,316 lines) as of this audit — not the stale, superseded `Arth.jsx` snapshot an earlier pass of this audit was mistakenly run against. That stale-file error is recorded here for the record: it produced a since-discarded draft that misidentified `getCardSummary` as missing (it exists, imported from `domain/cards/summaries.js`) and mischaracterized the SMS reconciliation path as unconditional (it's gated behind `forceAdjust`). Both corrected before any conclusion in this document was frozen.

---

## 1. Repository Audit

**Module shape:** No dedicated Accounts module exists yet. Account-related code is split across:
- `src/App.jsx` — 5 components (below), plus module-level derived-balance functions (`accountBalance`, `accountReconciliationGap`, `effectiveAccountBalance`, `cardOutstanding`... wait, `cardOutstanding` doesn't exist as a separate function — see §3, this is `getCardSummary`'s `totalOutstanding` field), `getAcc`, `normalizeAccounts`/`DEFAULT_ACCOUNTS`, `findSmsAccountMatches`
- `src/domain/cards/summaries.js` — **already-extracted**, clean, parameterized domain logic: `getCardCycleDates`, `getCardSummary`. First (and so far only) piece of a real Accounts domain layer.
- Persistence: `localStorage` (`arth_accounts`, `arth_checkpoints`) is the source of truth on-device; whole-object snapshot sync to Supabase via `cloudSync.js` (not audited in this pass — infrastructure boundary, out of scope per ADR-034's edge/serializer carve-out).

**External consumers:** Transactions (`accId`/`fromAccId`/`toAccId`/`paymentAccId`), Loans (CC-linked EMI), Bills, Investments, People/Groups (via `attributedTo`/`attributeType`), Budget/dashboard rollups (`cashBankTotal`, `liquidAssetsTotal`, `creditCardLiabilityTotal`, `reconciliationGapTotal`).

## 2. Component Audit

| Component | Lines | Role | Full findings |
|---|---|---|---|
| `AddAccountModal` | L6255–6384 (130) | Create | Own duplicated invariants with EditAccountModal (§4); `attributedTo`/`attributeType` raw FK into Person/Group |
| `EditAccountModal` | L12348–12448 (101) | Update | Same invariant-duplication; historically missing UPI-bank-link field (evidenced by in-code comment, now fixed) |
| `AccDetailModal` | L6708–6925 (217) | Read/display, launch point | `ledgerRows` (L6735–6775) is undiscovered domain logic — 11-way transaction-attribution/sign projection, no extraction yet |
| `ConfirmDeleteAccount` | L6666–6705 (40) | Delete | Computes linked-record counts but never acts on them — confirmed no-cascade defect |
| `AccountChipGroup` | L2454–~2468 (~15) | Presentational | Clean, no findings, extraction-ready as-is |

(Full per-component Responsibilities/State/Commands/Reads/Mutations/Boundary-violations/Extraction breakdown already delivered in-conversation; not reproduced in full here to avoid duplicating this document's own content — available on request if this needs to be a fully standalone artifact.)

## 3. Mutation Census — `setAccounts` (16 sites)

| # | Line(s) | Mutation |
|---|---|---|
| 1–2 | L1396, L1400 | Reverse/reapply CC `outstanding` on txn delete/re-add |
| 3 | L4076 | CC EMI down payment → `outstanding` += |
| 4 | L4404 | New CC expense → `outstanding` += |
| 5 | L4497 | `cc_payment` → `outstanding` -= |
| 6 | L4607 | Refund/reversal → `outstanding` -= |
| 7 | L3935 | SMS `openingBalance` reconcile (gated, `forceAdjust`) |
| 8–12 | L6293–6297 | Create, 5 type-branches |
| 13 | L6674 | Delete + strip sibling links |
| 14 | L7210 | Cloud/backup restore, full replace |
| 15 | L12370 | Update, conditional-spread by type |
| 16 | L16044 | Balance-check screen — `openingBalance` + checkpoint |

Correction from an earlier pass of this audit: the stale-file version of this table cited 13 sites at different line numbers. 16 is the verified current count.

## 4. Mutation Ownership Matrix

| # | Mutation | Current Owner | Future Owner | Type | Governing Decision | Status |
|---|---|---|---|---|---|---|
| 1–6 | CC `outstanding` (all 6 sites) | Inline, `AddModal` | Accounts domain / `Payable` | create/update-side-effect | ADR-032 §Q2; AQ-001 | Not migrated — legal under ADR-032 §3B |
| 7 | SMS balance reconcile | Inline, SMS flow | Accounts reconciliation service | reconcile | **AQ-003 ✅ Frozen** | Governed — implementation work via Change Register |
| 8–12 | Account create (5 branches) | `AddAccountModal` (UI) | Account Aggregate | create | None | No canonical owner — ACC-001 scope |
| 13 | Account delete | `ConfirmDeleteAccount` (UI) | Account Aggregate + cross-aggregate orchestrator (ADR-033-style) | delete | None | No canonical owner — ACC-001 scope |
| 14 | Snapshot restore | Infrastructure | Stays at serializer edge | system | ADR-034 | **Compliant as-is** |
| 15 | Account update | `EditAccountModal` (UI) | Account Aggregate | update | None | No canonical owner — ACC-001 scope |
| 16 | Balance-check screen | UI | Accounts reconciliation service | reconcile | **AQ-003 ✅ Frozen** | Governed — implementation work via Change Register |

**Quantified governance gap (final, post-AQ-003):**

| Category | Count |
|---|---|
| Governed by existing ADR / implementation work (CC outstanding + reconciliation) | 8 |
| Infrastructure boundary (correct owner) | 1 |
| No canonical owner — ACC-001's actual scope | 7 |

Reconciliation (sites #7, #16) moved from "deferred" to "governed" now that AQ-003 is frozen — it has an architectural basis (the interpretation-stability invariant) even though implementation hasn't happened yet, the same way CC `outstanding` is "governed" under ADR-032/AQ-001 despite also being unimplemented. **The 7 ownerless sites are exclusively account lifecycle: creation (5 branches), update, and delete — this is ACC-001's entire scope, cleanly.**

## 5. Domain Extraction Candidates

| Logic | Current Location | Proposed Owner | Priority |
|---|---|---|---|
| `ledgerRows` (transaction attribution/sign/projection) | `AccDetailModal` L6735–6775 | `domain/accounts/ledger.js` | High |
| Account creation invariants | `AddAccountModal` L6293–6297 | Account Aggregate | High |
| Account update invariants | `EditAccountModal` L12370–12376 | Account Aggregate | High |
| CC `outstanding` mutation | `AddModal`, 6 sites | Accounts domain / `Payable` | High (architecturally resolved already, lowest design risk) |
| Balance reconciliation | Split, L3935 & L16044 | Accounts reconciliation service | Medium — blocked on AQ-003 |
| Delete cascade | `ConfirmDeleteAccount` L6674 | Account Aggregate + orchestrator | Medium–High |

## 6. Business Rule Inventory

**Confirmed Rules** (implemented, working, evidence-traced):
- Account type determines required fields and balance-computation model (derived for bank/cash/UPI/debit; dual stored+derived for CC)
- `effectiveAccountBalance` = `accountBalance` + `accountReconciliationGap` for bank accounts only; other types use raw `accountBalance`
- CC canonical outstanding = statement-cycle derived (`getCardSummary.totalOutstanding`), per AQ-001

**Candidate Rules** (evidence found, no canonical owner):
- Account creation invariants (which fields are required/valid per type)
- Account update invariants (same, for edits)
- Delete-cascade behavior (currently: none — see Bug Register)

**Governed Rules** (AQ/ADR-backed, canonical owner named, implementation pending):
- Reconciliation checkpoints must be interpretation-stable; `openingBalance` corrections and `balanceCheckpoints` unify under one entry point — **AQ-003 (Frozen)**

## 7. ADR Compliance

| Implementation | Assessment |
|---|---|
| CC `outstanding` inline mutation (6 sites) | **Transitional** — non-canonical today, but explicitly permitted under ADR-032 §3B until migrated via Change Register items. Not technical debt in the same sense as an uncovered gap. |
| Snapshot restore (L7210) | **Compliant** — correctly sits at the persistence edge per ADR-034, nothing upstream bypassed |
| Account create/update/delete (UI-owned, no aggregate) | **Outside ADR scope** — ADR-032 explicitly scoped itself to Settlement + Outstanding Balance only ("Anything about Accounts... beyond the two rules explicitly addressed above — this ADR is scoped to what TRX-000A/C's evidence actually covered"). No ADR currently governs these; that's a gap this audit surfaces, not a violation of an existing one. |
| SMS/checkpoint reconciliation | **Outside ADR scope**, pending AQ-003 — same reasoning |
| `ledgerRows` in `AccDetailModal` | **Non-compliant with the general architectural invariant** (ADR-032 §3A: "UI components are never the canonical owner of ledger mutation rules") in spirit — though 3A is about mutation, and `ledgerRows` is read-only projection, so this is a boundary-adjacent finding rather than a clean violation. Flagging as **non-compliant (read-path)** since a read projection encoding this much business logic in a UI component is the same ownership problem 3A addresses for writes. |

## 8. Product Specification Compliance

Separating architecture concerns from product/UX gaps:

**Architecture:**
- UI owns business rules (creation/update invariants, ledger projection)
- Duplicate invariants (create vs. update, same rules expressed twice)
- Missing aggregate ownership for 7/16 mutation sites

**Product:**
- No reassignment workflow when deleting an account with linked transactions
- No recovery path for transactions left with dangling account references
- No reconciliation workflow that makes the checkpoint/SMS-sync interaction visible to the user (they can silently diverge per AQ-003)

## 9. Technical Debt Register

- Duplicate account creation/update invariants (`AddAccountModal` vs. `EditAccountModal`)
- `ledgerRows` — domain logic embedded in a UI component
- CC `outstanding` stored field is a confirmed dead write (per AQ-001) — 6 mutation sites maintaining a value nothing reads
- No Account Aggregate — every mutation is a direct `setAccounts` call from UI

## 10. Product Debt Register

- Account deletion has no orphan-handling workflow (user is warned, nothing is done about it)
- No reconciliation UX that surfaces the checkpoint/SMS-sync interaction
- (Carried from EditAccountModal's own in-code history) UPI bank-linking was missing from the edit flow until a user-reported gap — indicates edit-modal field coverage isn't systematically kept in sync with the create modal; likely to recur for other fields without a shared invariant source

## 11. Bug Register

| Findingng | Classification | Evidence |
|---|---|---|
| Dangling transaction references (`accId`/`fromAccId`/`toAccId`) after account deletion | **Confirmed defect** | `ConfirmDeleteAccount` computes `linkedTxnCount` (L6669) and displays it as a warning, but `handleDelete` (L6673–6688) never reassigns or nulls those references — only sibling `linkedBank`/`linkedAccount` fields and the checkpoint get cleaned up |
| Checkpoint/`openingBalance` divergence via SMS sync | **Confirmed architectural defect, governed by AQ-003** | Mechanism fully traced and frozen as violating the interpretation-stability invariant (AQ-003) — elevated from "investigating" now that the invariant it breaks is itself frozen. Still no direct evidence of a specific user-visible wrong number, but the violation itself is no longer hypothetical. Fix tracked via ACC-001's Change Register per AQ-003's Resolution. |
| SMS sync compares against raw `accountBalance` instead of displayed `effectiveAccountBalance` | **Confirmed architectural defect, governed by AQ-003** | Same status — frozen as part of AQ-003's resolution |

## 12. Recommendations

1. ~~Sign off or amend AQ-003~~ — **done, AQ-003 Frozen 2026-08-04.**
2. ~~Freeze this document~~ — **done, ACC-000 Frozen 2026-08-04.**
3. **ACC-001's scope is now exactly the 7 ownerless mutation sites** — account lifecycle only (creation, update, deletion), not reconciliation. ACC-001 should define: the Account Aggregate, its invariants, lifecycle commands (`create`/`update`/`delete`), and — since deletion needs to resolve dangling Transaction references — a cross-aggregate orchestration approach per ADR-033.
4. The confirmed deletion-cascade defect (§11) is real user-facing risk independent of the broader modernization timeline — worth a decision on whether it's fixed opportunistically now (bug fix, permitted even under the ARCH-004 freeze) or resolved as part of ACC-001's deletion-orchestration design directly.

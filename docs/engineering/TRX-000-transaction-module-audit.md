# TRX-000 — Transaction Module Audit

`Opened 2026-08-01` · Status: **Ready to begin** · Blocked on: nothing (ARCH-001/002/005 complete; SEC-001 executed, history decision pending but non-blocking for this ticket)

Published as one report, structured internally into audit units — ARCH-005 showed `AddModal` and `ItemSheetModal` have dramatically different dependency profiles (62 external refs vs. 2), so auditing them as one undifferentiated "Transactions module" risks over-scoping the simple parts and under-scoping the complex one.

---

## TRX-000A — AddModal

**Scope:** `src/App.jsx` L3168–5945 (2,778 lines, 139 hooks, 62 external closure refs: 18 setters, 10 getters, 34 raw state — per ARCH-005 §1)

**Why its own unit:** Highest-risk single component in the app. Hosts the item-save bug and the settlement-repayment-allocation flow debugged this session. Not a mechanical extraction candidate (ARCH-005 Tier 6) — needs domain design (what belongs to a `TransactionDraft` object vs. UI-only state) before any code moves.

**Deliverables specific to this unit:**
- Full state ownership map: which of the 34 "raw" external refs are read once vs. mutated, and by which user action
- Every settlement/repayment code path traced end-to-end (already partially done this session — `applyRepaymentAllocations` call sites, `isRepayment` gating logic, `repaymentCandidates`/`buildRepaymentAllocations` allocation logic)
- Bug register entry for the still-unresolved item raw-value bug (blank `label`/`unitPrice` seen in one debug screenshot, root cause not yet confirmed — see conversation history)

---

## TRX-000B — ItemSheetModal

**Scope:** `src/App.jsx` L5948–6013 (65 lines, 6 hooks, 2 external refs — per ARCH-005 §1)

**Why its own unit:** Already confirmed near-self-contained. This unit's audit should be fast — the goal is confirming it's genuinely extraction-ready (Tier 2) and identifying the *narrow* interface (`onSave`, `itemCatalog`/`setItemCatalog`) it needs from whatever calls it, so it can become a real standalone component without waiting on TRX-000A's much larger scope.

**Deliverables specific to this unit:**
- Confirm the 2-external-ref finding holds under manual read (not just AST free-variable scan)
- Define its extraction-ready prop interface
- Note: this unit's audit does not resolve the item-save bug by itself — that bug lives in how `AddModal` (TRX-000A) consumes this component's output, not inside this component

---

## TRX-000C — Transaction Services

**Scope:** Non-UI logic referenced across multiple transaction-related components — `applyRepaymentAllocations`, `getPersonReceivableItems`, `remainingShare` (has an existing duplicate — see ARCH-001 §5), `getCat`/`getAcc`/`getPerson` lookups (per ARCH-005 §3)

**Why its own unit:** These aren't tied to any one component's UI and are genuine `src/domain/transactions/` candidates independent of how TRX-000A/B/D resolve. Also where the open ADR-032 question lives: does Settlement become a first-class domain object with one implementation, resolving the `applyRepaymentAllocations` vs. `SettleModal.settle()` duplication found and partially patched this session?

**Deliverables specific to this unit:**
- Resolve the `remainingShare.js` duplicate (root `src/` copy vs. `src/domain/shared/`)
- Decide and document the Settlement domain-object question
- Full inventory of every place `applyRepaymentAllocations` and `SettleModal.settle()` are each called from, to confirm no other divergences remain beyond the 3 already found and patched

---

## TRX-000D — Transaction Rendering

**Scope:** `TxnRow` (228 lines, 0 hooks, 25 external refs: 9 setters/6 getters/10 raw), `SwipeableTxnRow` (63 lines, 3 hooks, 3 external refs), plus `Transactions` (466 lines, the list screen) and `Home`'s transaction-list usage

**Why its own unit:** Read-heavy, display-focused, lower risk than A/C but not zero — `TxnRow`'s 9 setters are worth confirming are genuinely UI-only (expand/delete row) and not accidentally touching financial state, before it's treated as Tier 3 "safe."

**Deliverables specific to this unit:**
- Confirm all 9 `TxnRow` setters are UI-state only (expected: `setExpandedTxn`, `setEditingTxn`, `setConfirmDeleteTxn`-family — needs verification, not assumption)
- Extraction readiness assessment independent of A/B/C

---

## Standard TRX-000 Deliverables (per the audit-lifecycle rule established for every `XXX-000`)

Each sub-unit above rolls up into these, published once for the whole module:

- Module inventory · Component inventory · State ownership map · Service ownership map
- Data flow diagram · Product Spec compliance · ADR compliance
- Technical debt register · Product debt register · Bug register
- Change Register (feeds `TRX-001+`)
- Freeze recommendation

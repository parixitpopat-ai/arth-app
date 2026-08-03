# ARCH-005 — Monolith Extraction Strategy

`Generated 2026-08-01` · Status: **Complete**
Method: AST-derived closure-dependency analysis (which names each component references from `AppContent`'s shared scope) via `acorn`/`acorn-jsx`, built directly on ARCH-002's component inventory. Not a design exercise — every number below is measured from the actual file.

---

## 1. Shared State Map

Every one of the 52 components lives inside `AppContent`'s closure and can freely reference anything declared there — `txns`, `setTxns`, `bills`, `setBills`, `people`, `accounts`, helper functions like `getCat`/`getAcc`/`getPerson`, and domain functions like `applyRepaymentAllocations`. Extraction means turning each of these free references into an explicit prop, import, or context value. So the real question per component isn't "how many lines" — it's **how many external names does it actually touch, and what kind.**

| Component | Total external refs | Setters (mutators) | Getters (lookups) | Raw state/other |
|---|---|---|---|---|
| `Chip` | 1 | 0 | 0 | 1 (`T` — theme only) |
| `AccountChipGroup` | 1 | 0 | 0 | 1 (`T`) |
| `InvestmentTypeChips` | 0 | 0 | 0 | 0 |
| `InvestmentFrequencySelect` | 1 | 0 | 0 | 1 |
| `IncomeTypeChips` | 1 | 0 | 0 | 1 (`T`) |
| `ItemSheetModal` | 2 | 1 | 0 | 1 (`itemCatalog`, `setItemCatalog`) |
| `SwipeableTxnRow` | 3 | 2 | 0 | 1 |
| `TxnRow` | 25 | 9 | 6 | 10 |
| `ConfirmDelete` | 10 | 2 | 1 | 7 |
| `ConfirmDeleteAccount` | 10 | 3 | 0 | 7 |
| `AddMembershipModal` | 9 | 1 | 1 | 7 |
| `LoanModal` | 12 | 4 | 0 | 8 |
| `StatsPage` | 15 | 1 | 1 | 13 |
| `EditBillModal` | 16 | 2 | 3 | 11 |
| `OutlookPage` | 16 | 2 | 2 | 12 |
| `SettleModal` | 16 | 4 | 2 | 10 |
| `InvestmentDetailModal` | 17 | 5 | 1 | 11 |
| `AccDetailModal` | 18 | 7 | 2 | 9 |
| `AddInvestmentModal` | 18 | 5 | 1 | 12 |
| `WealthBreakdownModal` | 18 | 5 | 1 | 12 |
| `AddBillModal` | 20 | 4 | 3 | 13 |
| `BillsPage` | 31 | 12 | 6 | 13 |
| `BudgetPage` | 41 | 13 | 4 | 24 |
| `WealthPage` | 45 | 13 | 2 | 30 |
| `AddModal` | 62 | 18 | 10 | 34 |
| `People` | 64 | 27 | 4 | 33 |
| `Home` | 77 | 34 | 5 | 38 |
| `Settings` | 88 | 33 | 2 | 53 |

**The single most important discovery in this ticket: `ItemSheetModal` — the component at the center of this thread's item-save bug — has only 2 external dependencies** (`itemCatalog`, `setItemCatalog`). It's already almost fully self-contained. This confirms what the earlier debugging session found by hand: the item-save bug was never inside `ItemSheetModal` itself — it's in how `AddModal` (62 external refs, the most tightly coupled component in the app after `Settings`/`Home`) wires the result back into its own state.

---

## 2. Extraction Order (evidence-based)

**Tier 1 — near-zero risk, do first.** 0–1 external refs, all read-only (`T` theme object or a single style helper): `Chip`, `AccountChipGroup`, `InvestmentTypeChips`, `InvestmentFrequencySelect`, `IncomeTypeChips`. Becomes `src/shared/components/`. No mutators involved at all — cannot cause a data bug.

**Tier 2 — very low risk.** `ItemSheetModal` (2 refs, 1 setter) and `SwipeableTxnRow` (3 refs, 2 setters) — small, few mutators, easy to audit each one by hand before extracting.

**Tier 3 — low-moderate risk, mutator-light.** `TxnRow` (25 refs but mostly read-only lookups — 6 getters, 10 raw display state, only 9 setters and those are all delete/expand-row UI actions, not financial mutations), `ConfirmDelete`, `ConfirmDeleteAccount`, `AddMembershipModal`, `LoanModal`. These touch real app state but mostly to *read* it for display.

**Tier 4 — moderate risk, real mutators present.** `StatsPage`, `EditBillModal`, `OutlookPage`, `SettleModal`, `InvestmentDetailModal`, `AccDetailModal`, `AddInvestmentModal`, `WealthBreakdownModal`, `AddBillModal`, `BillsPage` — each has 2–12 setters touching real financial state (`setBills`, `setTxns`, `setLoans`, etc.). Extractable, but each needs its own before/after manual regression pass given zero automated test coverage (confirmed ARCH-001).

**Tier 5 — high risk, needs a module audit before extraction, not a mechanical move.** `BudgetPage` (41 refs, 13 setters), `WealthPage` (45 refs, 13 setters), `People` (64 refs, 27 setters), `Home` (77 refs, 34 setters), `Settings` (88 refs, 33 setters). These own or touch large swaths of app-wide state directly. This is exactly where `ACC-000`, `HOME-000`, and equivalent module audits earn their keep — extraction here without first mapping *which* setter touches *what* domain object risks recreating the exact "two places update the same fact" bug class already found three times in the settlement code.

**Tier 6 — do not extract mechanically. Requires `TRX-000` first.** `AddModal` (62 refs, 18 setters, 2,778 lines, 139 hooks). This is the highest-value and highest-risk target in the app. Its coupling is a symptom of it being the actual Transaction domain's real home right now — extraction here is domain design work (deciding what a `TransactionDraft` object owns vs. what's UI-only state), not a file move.

---

## 3. Candidate Services (non-UI logic, callable independent of any component)

Already effectively function-shaped, living in `AppContent`'s scope, called by multiple components:

- `applyRepaymentAllocations` — settlement logic (already patched 3 times this session; prime candidate for `src/domain/transactions/settlements.js`)
- `getPersonReceivableItems` — read-only lookup, low risk to extract
- `remainingShare` — already has a duplicate in `src/domain/shared/remainingShare.js` (see ARCH-001 §5) — extraction here means **resolving the existing duplicate**, not creating a new one
- `getCat`, `getAcc`, `getPerson`, `getBillerIcon`, `getGroup` — pure lookup functions referenced across nearly every Tier 3+ component; good early wins since they're read-only

## 4. Candidate Domain Objects

Inferred from what's threaded through nearly every component: **Transaction** (`txns`/`setTxns`), **Bill** (`bills`/`setBills`), **Person** (`people`/`setPeople`), **Account** (`accounts`/`setAccounts`), **Settlement** (currently not a first-class object — it's a shape embedded inside Transaction via `settlementLinks`, which is itself part of why settlement logic ended up duplicated between `applyRepaymentAllocations` and `SettleModal.settle()`). Worth an explicit decision in `TRX-000`: does Settlement become its own domain object with one implementation, per the ADR-032/single-ledger direction already discussed?

## 5. Regression Risk Note

Every tier above carries one constant risk multiplier: **zero automated tests exist (ARCH-001).** For Tiers 1–2, manual smoke-testing is proportionate. From Tier 3 up, each extraction should get a written before/after checklist (what screens to manually verify) recorded in that ticket's Change Register — not skipped on the assumption that "it builds" means "it still works," which is exactly the assumption that let the settlement bugs ship in the first place.

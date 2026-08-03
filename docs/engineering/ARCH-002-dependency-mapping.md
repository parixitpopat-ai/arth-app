# ARCH-002 — Dependency Mapping (AUDIT)

`Generated 2026-08-01` · Status: **Complete**
Method: real AST parse of `src/App.jsx` via `acorn`/`acorn-jsx` (already present in the repo's own devDependencies) — not the line-distance heuristic used in ARCH-001. No files moved, no code changed.

---

## 1. Correction to ARCH-001

ARCH-001's component sizes were a heuristic (distance to next sibling definition). Comparing against real parsed boundaries:

| Component | ARCH-001 heuristic | ARCH-002 actual | Diff |
|---|---|---|---|
| `AddModal` | 2,780 | **2,778** | -2 (heuristic was accurate) |
| `People` | 1,410 | **1,408** | -2 (accurate) |
| `EditPersonModal` | 1,239 | **79** | **-1,160 (heuristic was wrong)** |
| `InvestmentDetailModal` | 679 | **148** | **-531 (heuristic was wrong)** |
| `BudgetPage` | 613 | **611** | -2 (accurate) |
| `Home` | 506 | **502** | -4 (accurate) |
| `TxnRow` | 278 | **228** | -50 (heuristic overstated) |
| `Toggle` | 710 | *not found as top-level* | heuristic was measuring noise, not a real component boundary |

Most estimates held up within a few lines. Two were badly wrong, exactly as flagged as a risk in ARCH-001 — `EditPersonModal` is genuinely small (79 lines), not the second-largest modal in the app. This matters directly: **`EditPersonModal` was flagged 🟡 Medium risk on ARCH-001's heat map based on the wrong number** — it should be reclassified 🟢 Low.

---

## 2. Real Component Inventory (top 20 by confirmed line count)

**Note on `AppContent`:** it spans L659–16350 (15,692 lines) because every other component in this list is defined *inside* it — this isn't a separate large component, it's the wrapper containing everything, including all the ones below. Its 800 hook count is the file-wide total, not hooks exclusive to it. Treat `AppContent` as "the monolith itself," not as an extraction candidate in its own right.

| Lines | Component | Location | Hooks | Renders (known components) |
|---|---|---|---|---|
| 2,778 | `AddModal` | L3168–5945 | 139 | Chip, AccountChipGroup, IncomeTypeChips, InvestmentTypeChips, InvestmentFrequencySelect, ItemSheetModal |
| 1,408 | `People` | L8676–10083 | 32 | SwipeableTxnRow |
| 849 | `Settings` | L11530–12378 | 20 | Chip, PinScreen, BudgetPage |
| 611 | `BudgetPage` | L12484–13094 | 11 | StatsPage |
| 502 | `Home` | L7638–8139 | 0 | TxnRow |
| 466 | `Transactions` | L8208–8673 | 5 | Chip, SwipeableTxnRow |
| 392 | `BillsPage` | L13351–13742 | 3 | *(none — uses raw JSX only)* |
| 345 | `OutlookPage` | L10614–10958 | 0 | *(none)* |
| 344 | `QuickAddModal` | L2823–3166 | 20 | Chip |
| 338 | `StatsPage` | L13767–14104 | 5 | Investments |
| 260 | `AddBillModal` | L14849–15108 | 29 | *(none)* |
| 255 | `WealthPage` | L11141–11395 | 0 | *(none — true leaf, see §4)* |
| 247 | `AddInvestmentModal` | L6420–6666 | 19 | InvestmentTypeChips, InvestmentFrequencySelect, AccountChipGroup |
| 246 | `SettleModal` | L6015–6260 | 7 | *(none)* |
| 228 | `TxnRow` | L2545–2772 | 0 | *(none)* |
| 217 | `AccDetailModal` | L6741–6957 | 0 | TxnRow |
| 187 | `EditBillModal` | L13097–13283 | 21 | *(none)* |
| 181 | `LoanModal` | L10213–10393 | 17 | Chip |
| 170 | `AddMembershipModal` | L14607–14776 | 12 | *(none)* |
| 148 | `InvestmentDetailModal` | L6959–7107 | 0 | *(none — corrected, see §1)* |

52 top-level components confirmed total (vs. 56 estimated in ARCH-001 — the difference is a few false positives in the original regex, like stray `const T`/`const M` style constants that looked component-shaped).

---

## 3. Fan-in: which components are reused, and by how many others

| Uses | Component | Size / Hooks | Note |
|---|---|---|---|
| 9× | `Chip` | 3 lines, 0 hooks | Trivial, pure presentational — highest-value, lowest-risk extraction candidate in the app |
| 4× | `TxnRow` | 228 lines, 0 hooks | Reused widely, zero internal state — good extraction candidate, though 228 lines for a "row" component is worth a second look in ARCH-005/TRX-000 (may be doing more than a row should) |
| 3× | `AccountChipGroup` | 23 lines, 0 hooks | Good candidate |
| 3× | `InvestmentTypeChips` | 5 lines, 0 hooks | Good candidate |
| 3× | `InvestmentFrequencySelect` | 8 lines, 0 hooks | Good candidate |
| 3× | `SwipeableTxnRow` | 63 lines, 3 hooks | Good candidate |
| 2× | `IncomeTypeChips` | 23 lines, 0 hooks | Good candidate |
| 2× | `ItemSheetModal` | 65 lines, 6 hooks | Reused by AddModal in 2 places — the item-save bug lived in the code that *calls* this, not this component itself |
| 2× | `AddInvestmentModal` | 247 lines, 19 hooks | |
| 2× | `AddModal` | 2,778 lines, 139 hooks | Rendered from 2 call sites — biggest single extraction target, but also the highest-risk one (see ARCH-005) |

Everything else in the 52-component inventory has fan-in of exactly 1 (used by only one parent) — meaning most of the app is single-use screens/modals, not a deeply shared component library. The 9 components above are the real shared foundation.

---

## 4. True leaves (no fan-in, render no other known components)

| Component | Lines | Hooks |
|---|---|---|
| `WealthPage` | 255 | 0 |
| `WealthBreakdownModal` | 132 | 0 |

**Caveat:** "leaf" here means UI-composition leaf (doesn't render or get rendered by other named components) — it does **not** mean state-independent. Both may still read heavily from `AppContent`'s shared closure state via props/hooks not visible to a JSX-tag scan. Confirming true independence needs the state/prop dependency check that's ARCH-005's job, not this one.

---

## 5. What this means for extraction order (preview only — full strategy is ARCH-005)

Based purely on fan-in + size + hook count, the safest-to-riskiest rough ordering:

1. **Trivial shared primitives** (`Chip`, `AccountChipGroup`, `InvestmentTypeChips`, `InvestmentFrequencySelect`, `IncomeTypeChips`) — 0 hooks, tiny, reused — near-zero risk
2. **Small single-use, 0-hook components** (`TxnRow`, `InvestmentDetailModal`, `AccDetailModal`, `ConfirmDelete`, `ConfirmDeleteAccount`) — low risk
3. **Medium single-use screens with some hooks** (`BillsPage`, `OutlookPage`, `StatsPage`, `SettleModal`) — moderate risk, but self-contained (0 fan-in, 0 known renders in several cases)
4. **`People`, `Settings`, `BudgetPage`** — large, real state ownership, single-use — needs its own module audit, not a mechanical extraction
5. **`AddModal`** — largest, most hooks (139), 2 call sites, and the component directly responsible for 2 of the 3 bugs found this session — this is the highest-risk item in the entire codebase and should not be extracted mechanically; it needs `TRX-000` treatment specifically, informed by ARCH-005's shared-state map

This is a preview, not the deliverable — ARCH-005 owns the actual ordering decision, the shared-state map, and the regression-risk write-up per candidate.

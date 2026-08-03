# ARCH-001 — Repository Inventory

`Generated 2026-08-01` · Revised with Health Score / Heat Map / Severity `2026-08-01`
No files moved, no code changed, no behavior altered.
Source: real `git ls-files` output and static analysis of the tracked repository — not estimates, except the Health Score, which is a qualitative synthesis of the evidence below and is labeled as such.

**Status: ✅ Approved & Closed** (signed off 2026-08-01) · Enables: ARCH-002 (Ready) · Blocks: ARCH-003 (Blocked until ARCH-002)

---

## Repository Health Score

*This is judgment, not measurement — a synthesis of the evidence in this report. Treat it as a starting conversation, not a certified metric.*

| Category | Score | Basis |
|---|---|---|
| Architecture | 4/10 | One 16,349-line file holds 90%+ of the app; no domain boundaries enforced |
| Maintainability | 3/10 | 596 `useState` calls, no store, no Context — every fix risks touching unrelated state (see: 3 settlement bugs found in one debugging session, all same root cause) |
| Product Alignment | 9/10 | Feature set closely tracks the Product Spec / UX Bible docs; this isn't a product-quality problem, it's an engineering-debt problem |
| Repository Hygiene | 4/10 | 7 confirmed duplicate-file pairs, 3 copies of one ADR doc, possible sensitive data committed to git root |
| Technical Debt | 2/10 | Confirmed pattern of duplicated, manually-synced state causing real production bugs (bill status, person totals, linked-transaction mirroring) |
| Testability | 1/10 | **Zero test files. No test script in package.json. No testing library installed at all.** Every change to App.jsx is currently unverifiable except by hand. |
| **Overall Repository Health** | **3.8 / 10** | |

---

## Risk Heat Map

| Area | Risk | Reason | Severity |
|---|---|---|---|
| `AddModal` | 🔴 | ~2,780 LOC, single component; hosts the item-save bug and one leg of the settlement bug | Critical |
| `App.jsx` (whole file) | 🔴 | 90%+ of codebase in one compilation unit, zero test coverage | Critical |
| Backups in git | 🔴 | 3 files with a `snapshot` key committed at repo root, not gitignored — possible real financial/personal data in git history | Critical |
| Settlement logic (`applyRepaymentAllocations` + `SettleModal.settle()`) | 🔴 | Two independent implementations of the same operation, already found out of sync 3 times | High |
| `People`, `EditPersonModal`, `InvestmentDetailModal`, `BudgetPage`, `Home`, `Transactions` | 🟡 | Each >400–1400 LOC (heuristic, needs AST confirmation in ARCH-002) | Medium |
| Domain layer (`src/domain/`) | 🟡 | Partial extraction started (5 files), 2 already duplicated elsewhere — unclear if canonical | Medium |
| ADR/doc copies (`ARCHITECTURE_DECISIONS.md` ×3, `DOCS_INDEX.md` ×2) | 🟡 | Repository drift; no single source of truth for governance docs themselves | Medium |
| `components/`, `constants/`, `helpers/`, `screens/` | 🟢 | Small, already separated, low risk | Low |

---

## Recommendation

**Do immediately**
- Remove the 3 backup/export JSON files from the repository (and evaluate whether git history needs rewriting, not just a new commit, if they contain real data)
- Freeze `App.jsx` — see ARCH-004 below

**Do next**
- ARCH-002 (Dependency Mapping)

**Don't do**
- Repository restructuring (ENG-001 as originally drafted) — premature until ARCH-002/003 and the module `-000` audits are done

---



## 1. Repository Statistics

**Tracked files (via `git ls-files`): 149 total**

| Top-level path | Tracked files |
|---|---|
| `src/` | 62 |
| `wireframes/` | 26 |
| `ux-bible/` | 13 |
| `architecture/` | 8 |
| `ads/` | 4 |
| `design-system/` | 2 |
| `public/` | 2 |
| repo-root loose files | ~32 (see §5, several of concern) |

**Total LOC in `src/*.js`/`*.jsx`: 18,121 lines.**

**Largest tracked files:**

| Lines | File |
|---|---|
| 16,349 | `src/App.jsx` |
| 6,203 | `package-lock.json` (generated, ignore) |
| 935 | `ARCHITECTURE_DECISIONS.md` (repo root copy) |
| 695 | `architecture/ARCHITECTURE_DECISIONS.md` (2nd copy) |
| 546 | `src/setup-missing-files.sh` |
| 471 | `src/ARCHITECTURE_DECISIONS.md` (3rd copy) |
| 375 | `Arth_Timeline.md` |
| 359 | `src/CHANGELOG.md` |
| 347 | `src/DEPENDENCY_MAP.md` |

**Headline finding [Critical]:** Approximately 90% of the application's source code resides within a single compilation unit (`App.jsx`). This significantly increases coupling, complicates testing, elevates regression risk, and limits safe incremental extraction. Every other source file combined (`components/`, `constants/`, `helpers/`, `screens/`, `domain/`) totals roughly 1,770 lines — under 10% of the codebase.

---

## 2. React Inventory

**56 top-level component-like definitions found in `App.jsx`**, all sharing one module scope. Approximate sizes below are measured by distance-to-next-sibling-definition (a heuristic, not an AST parse — treat as directional, refine in ARCH-002):

| Approx. lines | Component | Starts at |
|---|---|---|
| ~2,780 | `AddModal` | L3168 |
| ~1,410 | `People` | L8676 |
| ~1,239 | `EditPersonModal`* | L15111 |
| ~710 | `Toggle`* | L11671 |
| ~679 | `InvestmentDetailModal` | L6959 |
| ~613 | `BudgetPage` | L12484 |
| ~506 | `Home` | L7638 |
| ~468 | `Transactions` | L8208 |
| ~416 | `BillsPage` | L13351 |
| ~345 | `QuickAddModal` | L2823 |
| ~340 | `StatsPage` | L13767 |
| ~278 | `TxnRow` | L2545 |
| ~248 | `SettleModal` | L6015 |

*`EditPersonModal` and `Toggle`'s sizes are likely inflated by the heuristic (measuring to end-of-file / next unrelated sibling) — flag for correction once ARCH-002 does real AST parsing.

**`AddModal` at ~2,780 lines is the single largest component in the app**, and is not a coincidence relative to this thread's findings: both the item-save bug and one leg of the settlement bug traced back to logic living inside or adjacent to it. Any module audit or refactor plan should treat `AddModal` as its own audit unit, not a sub-item of a broader "Transactions" audit.

**Hooks:** 596 `useState`, 84 `useEffect`, 70 `useMemo`, 55 `useCallback`, 16 `useRef` calls in `App.jsx` alone. No `useReducer`, no Context API usage, no Redux/Zustand found anywhere in the tracked source — **all state in the app is local `useState`, threaded through props/closures.** This is the mechanical reason the settlement bugs took the shape they did: there is no single store to keep in sync, only parallel `useState` calls in different components that each own their own copy of overlapping data (bills vs. their linked transactions vs. per-person totals).

**Custom hooks:** none found as extracted `useXxx()` functions — all hook logic is inlined per-component.

---

## 3. Data Sources

- **Supabase calls:** 1 direct call site in `App.jsx`, 5 in `src/cloudSync.js` (the real sync layer, confirmed to exist and match what was referenced earlier in this thread).
- **`localStorage` calls:** 57 in `App.jsx`.
- **sessionStorage / other browser storage APIs:** none found.

---

## 4. Existing Domain Extraction (already in progress, small)

```
src/domain/bills/periodCalculations.js
src/domain/bills/refunds.js
src/domain/cards/summaries.js
src/domain/financialEngine/engine.js
src/domain/shared/remainingShare.js
```

Someone has already started a `src/domain/` structure. It's small (5 files) and **two of these already have duplicate copies elsewhere** — see §5. Any ARCH-003 standards ticket should decide whether this existing structure is the target shape or gets superseded.

---

## 5. Duplicate Files [Medium] (real findings, not hypothetical)

| File | Copies found |
|---|---|
| `ARCHITECTURE_DECISIONS.md` | repo root, `src/`, `architecture/` — **3 copies** |
| `DOCS_INDEX.md` | repo root, `src/docs/` — 2 copies |
| `EmptyState.jsx` | repo root, `src/components/` — 2 copies |
| `StatCard.jsx` | repo root, `src/components/` — 2 copies |
| `periodCalculations.js` | `src/`, `src/domain/bills/` — 2 copies |
| `remainingShare.js` | `src/`, `src/domain/shared/` — 2 copies |
| `e08a3450-...-vaf.pdf` | literally duplicated (`...vaf.pdf` and `...vaf (1).pdf`) |

None of these are safe to assume are identical — each pair needs a diff before either copy is deleted, since the "canonical" one isn't obvious from filenames alone.

---

## 6. Flag: possible sensitive data committed to git [Critical]

**These are tracked in git, at the repo root, not gitignored:**

- `arth-backup-2026-04-09T17-20-12-916Z.json` (14K)
- `arth-merged-2026-04-12.json` (15K)
- `arth-drive-export-2026-04-09T17-31-17-788Z.json` (3.2K)

All three have a top-level `snapshot` key consistent with a full app-data export/backup — meaning **real transaction, bill, and person data may be sitting in git history**, not just the working tree. Also found: two copies of what appears to be a personal document PDF (`...vaf.pdf`, filename suggests a "VAF" — visa application form or similar) committed at repo root, and a tracked `.claude/settings.local.json`.

This isn't an ARCH-001 scope item to fix, but it's a real finding that shouldn't wait for a ticket: **worth deciding today whether this repo is or will ever be public, private-but-shared, or open to more collaborators — because if any backup file contains real financial/personal data, it's already permanently in git history even if deleted now**, and would need history rewriting (not just a new commit) to actually remove.

---

## 7. Dead Code Candidates

Not conclusively determined in this pass — proper unused-export detection needs a real static analysis tool (e.g. `ts-prune`/`knip`-equivalent for JS, or manual cross-reference of every export against every import) rather than grep. Flagging for ARCH-002, where dependency mapping will surface this as a byproduct.

---

## 8. What ARCH-002 Should Build On This

- Component dependency graph: which of the 56 `App.jsx` components call which others directly (vs. via shared state) — this determines what's actually extractable and in what order.
- Confirm/replace the heuristic size estimates in §2 with real AST-based measurement.
- Formal circular-dependency and dead-export detection.
- The `>500 line` oversized-component threshold from the ticket already flags `AddModal`, `People`, `EditPersonModal` (pending correction), `InvestmentDetailModal`, `BudgetPage`, `Home`, and `Transactions` — 7 candidates before any deeper analysis.

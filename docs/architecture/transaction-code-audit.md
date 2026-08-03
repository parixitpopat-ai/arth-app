# Transaction Code Audit — Keep / Merge / Delete / Rename / Move

`2026-08-03` · TRX-001C, Team 2 deliverable · **Status: ✅ Frozen** — approved 2026-08-03
No coding. Mapping only, against the frozen Transaction Aggregate model.

**Precedent found and worth following, not reinventing:** `src/domain/bills/refunds.js` and `src/domain/financialEngine/engine.js` already exist, already follow exactly this session's audit discipline (each carries its own header explaining what was checked before extraction — "audit passed clean," "no hidden transitive dependencies," "checked directly, not assumed"). This is real prior art for how pure domain functions should look in this repo. Team 2's recommendations below deliberately match that existing pattern rather than introducing a second style.

---

## Mapping

| Old location | Decision | Target | Why |
|---|---|---|---|
| `AddModal` (2,778 lines, `App.jsx` L3168–5945) | **Split** | See breakdown below — this is 15 responsibility domains, not one unit | Confirmed in TRX-000A; a single Keep/Delete verdict is meaningless at this scope |
| `applyRepaymentAllocations` | **Merge** (into new canonical settlement logic) | `src/domain/transactions/settlement.js` (new) | One of 4 duplicate implementations (CR-001) — this is a migration source, not a keeper as-is |
| `SettleModal.settle()` | **Merge** (into the same canonical settlement logic) | `src/domain/transactions/settlement.js` (new) | Same rule, second implementation — merges with `applyRepaymentAllocations`, doesn't survive as a separate component-local function |
| `ItemSheetModal` | **Keep, Move** | `src/components/transaction/ItemSheetModal.jsx` (or equivalent) | TRX-000B confirmed near-zero coupling (2 external refs) — extraction-ready as-is, no logic changes needed |
| `TxnRow` | **Keep, Move** — but flag for a closer look | `src/components/transaction/TxnRow.jsx` | TRX-000A found 25 external refs (9 setters) — "safe" per dependency count, but worth confirming those 9 setters really are UI-only (expand/delete row) before treating the move as purely mechanical, per TRX-000D's own stated deliverable |
| `remainingShare.js` (root `src/`) | **Delete** | — | Confirmed duplicate of `src/domain/shared/remainingShare.js` (ARCH-001 §5) — the domain copy is the one to keep |
| `remainingShare.js` (`src/domain/shared/`) | **Keep** | Unchanged location | Already correctly placed, already the canonical copy |
| `getPersonReceivableItems` | **Move** | `src/domain/transactions/receivables.js` (new) | Read-only lookup, low risk, no logic change needed — matches the `refunds.js` precedent exactly (pure function, `txns`/`bills` in, data out) |
| `getCat`/`getAcc`/`getPerson` | **Move** | `src/domain/shared/lookups.js` (new) or similar | Pure lookups referenced across nearly every audited component — good candidates for the same treatment as `remainingShare` |
| Outstanding-balance mutation (`AddModal` L4106, L4434, L4527, L4637) | **Merge** | `src/domain/accounts/balance.js` (new — Accounts domain, not Transactions) | CR-002/CR-003 — explicitly out of Transaction Aggregate scope per the frozen boundary (§1 of the domain model) |
| Loan creation (`AddModal` L4180, L4689) | **Move, not Merge** | `src/domain/loans/` (new — Loans domain) | TRX-001A found these are two distinct loan-subtype creation paths, not confirmed duplicates — moving preserves both as-is; do not merge without further audit |
| Loan outstanding reduction (`AddModal` L4512, L4531) | **Move** (L4531) / **Hold for CR-004 decision** (L4512) | `src/domain/loans/` for L4531; L4512's destination depends on Team 4's settlement-capability answer | L4512 is the CR-004 case — premature to place it until Team 4 decides shared-capability vs. per-aggregate |
| Investment create/update/remove (`AddModal` L4573, L4733) | **Move** | `src/domain/investments/` (new) | TRX-001A confirmed no duplication, clean single-purpose functions — low-risk move |
| SMS import/parsing state (7 `useState` in `AddModal`) + `smsBridge.js` | **Merge** | Consolidate into `smsBridge.js`, which already exists as a separate file | TRX-000A flagged this as the "Safe, first extraction" candidate — the state ownership is the only thing not yet matching the existing file boundary |
| Category quick-add (5 `useState` in `AddModal`) | **Move** | Small dedicated component, e.g. `src/components/category/QuickAddCategory.jsx` | Small, self-contained, 2 external mutations both to `setCats` |
| Draft/autosave (`draftBanner`/`draftData`) | **Hold** | Not decided here | Touches every other domain's data (snapshots the whole form) — needs its own design decision on what a "draft" contains once the Aggregate's field set is finalized, not a mechanical move |
| Split/attribution/people-tagging (22 states, the largest group in `AddModal`) | **Hold — do not move yet** | N/A | TRX-000A's own conclusion: "Impossible until dependencies change." This becomes the `PersonShare` value object per the frozen model, but extracting it requires re-threading everything else that references it simultaneously — sequencing question for Team 3, not a simple move |
| Price breakdown, EMI/loan origination fields, CC-to-EMI conversion (remaining `AddModal` states) | **Hold** | N/A | Not yet audited at the same depth as Settlement/Accounts/Loans/Investments — recommend a follow-up TRX-000-style pass before deciding Keep/Merge/Delete, rather than guessing now |

---

## What's explicitly NOT decided here

- The exact shape of `src/domain/transactions/settlement.js` (Team 3's migration-steps job, and depends on Team 4's CR-004 answer)
- Whether `TxnRow`'s 9 setters are genuinely UI-only (flagged, not verified)
- Anything about Price breakdown / EMI origination / CC-EMI conversion — these responsibility domains from TRX-000A haven't had the same line-by-line audit as Settlement/Accounts/Loans/Investments, and guessing their Keep/Merge/Delete status now would repeat the exact mistake this whole process has been correcting (claiming without reading the code first)

## Recommendation

This mapping is complete enough for Teams 3–8 to start on the parts it does cover (Settlement, Accounts, Loans, Investments, SMS, Category quick-add, ItemSheetModal, TxnRow). The three "Hold" items (Draft/autosave, Split/attribution, and the unaudited remainder) shouldn't block those teams — they're a known, bounded remainder, not a hidden risk.

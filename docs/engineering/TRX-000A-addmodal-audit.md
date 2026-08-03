# TRX-000A — AddModal Audit

`2026-08-01` · Status: **Approved & Closed**
Objective: **understand AddModal sufficiently to make the first extraction safe** — not to audit for its own sake.
Method: AST-derived (all 113 local state declarations, all external mutator call sites, confirmed by line number against `src/App.jsx` L3168–5945).

No implementation recommendations below. Evidence only. `TRX-001+` is where "move this to a hook" gets decided, not here.

---

## 1. Responsibility Map

`AddModal` isn't one form — it's **~15 distinct responsibility domains** sharing one component, discovered by grouping its 113 local `useState` declarations:

| Responsibility | Classification | Evidence (state count) |
|---|---|---|
| Core transaction fields (type, amount, date, account, category, note) | Domain | 14 states |
| Itemization (line items, item sheet) | Domain | 4 states |
| Split / attribution / people-tagging | Domain | 22 states |
| Settlement / repayment | Domain | 13 states |
| Bill / event / trip / membership linking | Domain | 10 states |
| Attachments (receipt/payment images) | UI | 2 states |
| SMS import / parsing | Service-adjacent | 7 states |
| Price breakdown (MRP/discount/fees) | Domain | 5 states |
| EMI / loan origination | Domain | 13 states |
| Investment entry | Domain | 5 states |
| Credit-card-to-EMI conversion | Domain | 8 states |
| Draft / autosave | Service-adjacent | 2 states |
| Category quick-add | UI | 5 states |
| Discount | Domain | 1 state |
| Advanced-tracking toggle | UI | 1 state |

**Finding:** 11 of 15 responsibility domains are classified Domain, not UI. This is the core evidence behind why `AddModal` can't be extracted as "one big form component" — it's currently the *de facto* home for at least 6 separate features (Settlement, EMI/Loan origination, Investment entry, CC-to-EMI conversion, Bill linking, Itemization) that each deserve their own module ownership, bundled into a single UI component because that's where the form happened to be built.

---

## 2. State Inventory (by responsibility group)

Full per-variable detail available on request; summarized here since 113 individual entries isn't the useful grain for a decision. Pattern that holds across nearly all groups:

- **Owner:** `AddModal` itself (all 113 are local `useState`, not lifted or context-based)
- **Lifetime:** Modal-session only — reset on close/reopen, not persisted except via the draft-autosave mechanism (`draftBanner`/`draftData`, debounced localStorage write, confirmed earlier this thread)
- **Reads:** Overwhelmingly local — most state is read only by the JSX it directly renders
- **Mutates external state?** No — local `useState` setters only mutate their own state. External mutation happens separately (see §4)
- **Candidate for extraction?** Yes for all — but only alongside the responsibility domain it belongs to, not individually. Extracting `emiTenureMonths` alone without the other 12 EMI states doesn't reduce coupling, it fragments one feature across two files.

---

## 3. Dependency Graph

### Incoming (who renders AddModal)
Confirmed 2 call sites (ARCH-002 fan-in data):
1. Main app flow — `{showAdd&&<AddModal .../>}`
2. `QuickAddModal` → routes into `AddModal` for the edit-existing-transaction case

### Outgoing (what AddModal calls — classified)

| Category | Examples | Count |
|---|---|---|
| UI components | `Chip`, `AccountChipGroup`, `IncomeTypeChips`, `InvestmentTypeChips`, `InvestmentFrequencySelect`, `ItemSheetModal` | 6 |
| Domain/service functions | `applyRepaymentAllocations`, `getNetExpenseAmount`, `getCat`, `getAcc`, `getBillerActionType` | 10 (getters from ARCH-005) |
| Direct state mutators (storage-adjacent) | `setTxns`, `setBills`, `setAccounts`, `setLoans`, `setInvestments`, `setMemberships`, `setCats`, `setPeople`, `setGroups`, `setItemCatalog`, `setEditingTxn`, `setBillMatchSuggestion`, `setShowAddLoan`, `setShowAddInvestment`, `setEditingInvestment`, `setShowAddBill`, `setConfirmDeleteTxn` | 18 |
| Supabase / storage direct | None found directly in `AddModal` — all writes go through the `setX` state setters, which sync to Supabase elsewhere (confirms the sync layer is decoupled from this component, which is good) | 0 |

---

## 4. Mutation Map (the most important deliverable)

Every confirmed external write site, with what it does and whether it's duplicated:

| Setter | Call sites | What changes | Duplicated elsewhere? |
|---|---|---|---|
| `setTxns` | 7 (L4054, 4105, 4108, 4181, 4480, 4559, 4641) | Creates/edits/deletes transactions. **Correction after reading each site directly:** these 7 are NOT structurally similar to each other — L4480 does settlement-payment allocation math (paidFor/remainingShare, recomputing settled), L4559 sets a single `paidInBill` flag, L4641 reduces a refunded person's owed amount and recomputes settled. Different operations, not one duplicated pattern. | **See below — a more precise, more important duplication was found instead** |
| `setAccounts` | 5 (L3965, 4106, 4434, 4527, 4637) | Adjusts CC `outstanding` balance. **Corrected on direct read:** this is actually **two separate duplicate pairs**, not one triplicated formula — L4106 (`+upfrontPaid`, EMI down payment on CC) and L4434 (`+amt`, regular CC expense) both independently hand-write the *increment* formula; L4527 (`cc_payment`) and L4637 (refund) both independently hand-write the *decrement* formula `Math.max(0,(a.outstanding||0)-amt)`. Two rules, each duplicated once. | **Yes, confirmed — 2 pairs, 4 sites total, no shared function for either direction** |
| `setLoans` | 4 (L4180, 4512, 4531, 4689) | Creates/edits loan records on EMI purchase or loan-linked transaction | Not yet confirmed identical — needs closer read before flagging as duplicated |
| `setInvestments` | 2 (L4573, 4733) | Creates/removes investment record tied to a transaction | Not confirmed duplicated |
| `setBills` | 1 (L4460) | Checks for a bill match on the new transaction | Single site — low duplication risk |
| `setCats` | 2 (L3593, 3605) | Adds/edits a category (from the "quick add category" inline flow) | Single feature, low risk |
| `setMemberships` | 1 (L4086) | Creates a membership record | Single site |
| `setBillMatchSuggestion`, `setEditingTxn`, `setShowAddLoan` | 1 each | UI-flow state (not financial data) | N/A |

**Corrected headline finding:** the real duplication isn't "setTxns is called 7 times the same way" — reading each site directly disproved that. It's more specific and more important: **"reduce a person's owed/remaining amount and recompute whether they're settled" is now confirmed implemented independently in at least 4 places** — `applyRepaymentAllocations` (patched this session), `SettleModal.settle()` (patched this session), the settlement-allocation block at L4480, and the refund-reduction block at L4641. Plus, separately, `setAccounts`' CC-outstanding-balance math is hand-duplicated in 2 pairs (4 sites, 2 formulas, 0 shared functions). See BUG-TRX-001 and the Business Rule Inventory for the formal writeup.

---

## 5. Extraction Candidates (tiered — nothing extracted yet)

| Tier | Candidate | Why |
|---|---|---|
| **Safe** | SMS import/parsing (7 states) — self-contained, calls out to `smsBridge.js` which already exists as a separate file | Already architecturally separate in spirit, just not in state ownership |
| **Safe** | Category quick-add (5 states, 2 external mutations both to `setCats`) | Small, single external dependency, easy to isolate |
| **Medium** | Itemization (4 states) — `ItemSheetModal` itself is already Tier 2 per ARCH-005; the 4 local states here are just the modal-open/edit-id plumbing | Low risk, but blocked on deciding the interface contract first |
| **Medium** | Investment entry (5 states, 2 `setInvestments` sites) | Contained, but the 2 mutation sites need the "duplicated?" check completed first |
| **Medium** | Draft/autosave (2 states) | Small surface, but touches every other domain's data (it snapshots the whole form) — extracting it means deciding what a "draft" actually contains |
| **High** | Settlement/repayment (13 states) | Directly touches `applyRepaymentAllocations`, the function already patched 3 times this session — extraction here is really the ADR-032 single-ledger question, not a mechanical move |
| **High** | EMI/loan origination (13 states, 4 `setLoans` sites) | Real financial logic, needs the duplication check completed before extraction is "safe" |
| **High** | CC-to-EMI conversion (8 states) | Touches both loans and account balances — compound risk |
| **Impossible until dependencies change** | Split/attribution/people-tagging (22 states — the largest single group) | Threads through nearly every other domain (settlement, itemization, category allocation all reference split state) — extracting this first would require re-threading everything else simultaneously |

---

## 6. Audit Summary (one page)

**Biggest risk:** `setAccounts` and `setTxns` each have multiple independently hand-written update passes doing structurally similar work — the exact bug pattern already confirmed 3 times this session in settlement code, now found in account balances and transactions themselves. This is a live risk today, not a future one.

**Biggest opportunity:** SMS import/parsing and Category quick-add are genuinely small, self-contained, low-mutation domains — real "Safe" extractions available immediately, independent of everything else in this audit.

**First extraction:** SMS import/parsing (7 states, already leans on an external `smsBridge.js` file — the state ownership is the only thing not yet matching the existing architectural intent).

**Biggest blocker:** Split/attribution/people-tagging (22 states, the largest single responsibility group) is woven through nearly every other domain in the component. It can't move first — everything else needs to move around it, or it needs its own dedicated redesign before anything touching splits is safe to extract.

# Transaction Domain — Frontend Design

`2026-08-03` · TRX-001C, Team 8 deliverable · Status: **Draft — for review**
No coding. Screens organized by user task and the commands they invoke (Team 7) — not by database table. Rule applied throughout: **the UI collects intent and invokes a command; it never independently computes or enforces an invariant already owned by an aggregate.**

---

## New Transaction Screen

**Task:** record a financial event.
**Invokes:** `POST /transactions`
**UI owns:** field collection, client-side format validation (e.g. "amount must be a number"), which is presentation concern, not a business invariant.
**UI does not own:** deciding whether the transaction is valid per ADR-017's type rules, computing `PersonShare` splits' consistency, or itemization reconciliation (Team 1's still-Open invariant) — all of that is the `Transaction` aggregate's job when the command is submitted; the screen submits intent and displays whatever the aggregate/API returns (including validation errors), it doesn't pre-decide correctness itself.

**Direct consequence of the aggregate boundary (Team 1):** this screen should no longer directly call `setLoans`/`setInvestments`/`setAccounts` the way `AddModal` does today for CC-charge/loan-origination side effects. Those become consequences of the transaction command completing (via events, per Team 6), not things this screen orchestrates by hand.

---

## Settlement Screen

**Task:** apply a payment, possibly across multiple dues.
**Invokes:** `POST /settlements`
**UI owns:** presenting the candidate-dues list (from the read-side `GET /people/{id}/receivables` query) with checkboxes/amounts for the user to select — matching the real "Apply to original dues" behavior already confirmed this session, including the "extra kept as advance" case.
**UI does not own:** deciding *how* a payment allocates across selected dues, or mutating any target's `settled`/`remaining_amt` — that's `SettlementService.allocate()`'s job entirely. The screen sends the user's selections and amount; the response tells it what happened.

**This is the screen your message specifically called out** — "a settlement screen may orchestrate multiple aggregates, but it shouldn't become the place where frontend code enforces business invariants." Concretely: no `Math.max(0, ...)`, no `remainingShare()` calculation, no settled-flag logic anywhere in this screen's code. All of that is exactly the class of duplication BUG-TRX-001 already found — moving it into frontend code would just create a 5th independent implementation in a new location.

---

## Refund Flow

**Task:** record money returned against a prior expense.
**Invokes:** `POST /settlements` with `isRefund: true` in the request — **not a separate endpoint or screen flow**, per Team 6's decision that refund is a flag on `SettlementCompleted`, not a distinct event. The UI may present this with refund-specific copy/framing (a different *presentation*), but it's the same command underneath.

---

## Split Screen (part of New Transaction, not standalone)

**Task:** divide a transaction's amount among people.
**Invokes:** included as part of the `POST /transactions` payload (`PersonShare[]`), not a separate command — a split doesn't exist independently of the transaction it belongs to (Team 1 §1: `PersonShare` is owned by `Transaction`).
**UI owns:** the split-editing interaction (equal split, custom amounts, guest person entry). **UI does not own:** enforcing that shares sum correctly to the transaction total, if that becomes a real invariant once Team 1's Open row is resolved — that check belongs server-side/aggregate-side regardless of what client-side convenience validation also exists.

---

## Reimbursement Flow

**Task:** mark an expense as reimbursable, later record the reimbursement.
**Invokes:** the `reimbursable` flag on `POST /transactions` (creation time), then `POST /settlements` when the reimbursement arrives — same reasoning as Refund: this is an existing transaction flag plus the same settlement command, not new domain concepts requiring new endpoints.

---

## Draft Transactions

**Task:** preserve in-progress entry across app restarts/interruptions.
**Invokes:** nothing server-side in this design — Team 1 flagged Draft as "Hold, touches every other domain's data" and this remains genuinely unresolved. **Recommendation, not a decision:** drafts likely stay a pure client-side (localStorage) concern, exactly as they work today, since a draft is by definition *not yet a valid `Transaction`* — it shouldn't need to satisfy the aggregate's invariants to exist. Formalizing this is out of TRX-001C's scope; flagging that it's still open rather than silently assuming this recommendation is final.

---

## Transaction Timeline & History

**Task:** view what happened to a transaction over time.
**Invokes:** read-only query against `transaction_events` (Team 5/6) — `TransactionPosted`, `TransactionEdited`, `TransactionSettlementApplied` etc., rendered as a chronological log.
**Direct new capability this enables:** today's app has no equivalent screen at all — this is only possible because Team 6 established a real event log exists to query, which the current whole-blob-sync architecture (Team 7's finding) doesn't provide today.

---

## State Change Summary (what changes about how screens work, not just what they look like)

| Today | Under this design |
|---|---|
| `AddModal` directly calls `setTxns`/`setAccounts`/`setLoans`/`setInvestments` inline for side effects | Screens invoke one command; side effects happen via aggregate methods + events, not screen-authored logic |
| `SettleModal` and the Settlement-tab flow each have their own settlement math | Both become the same Settlement Screen invoking `POST /settlements` |
| No transaction history view exists | Timeline screen becomes possible, backed by `transaction_events` |
| Refund is a separate mental model in the UI (different modal, different flow) | Same Settlement Screen, different flag — less code, not more |

## What this deliberately does not answer

- Actual visual/interaction design (out of scope — this is command/data-flow, not UI design)
- Whether Draft Transactions get formalized into the domain model at all (flagged, not decided)
- Migration plan for existing users' in-progress UI state during the cutover (depends on Team 7's flagged blob-sync migration question)

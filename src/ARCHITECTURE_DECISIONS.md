# Arth — Architecture Decisions (ADR-lite)

Not implementation detail — the *why* behind major calls, so six months
from now the reasoning is still there, not just the outcome. Newest
first. Add an entry whenever a decision this size gets made, not
retroactively in a batch.

---

## ADR-020 — Supersedes ADR-019: Membership survives as a legacy
compatibility layer for 2.0, not eliminated

**Decision:** ADR-019's "Bill + Transaction is sufficient, no
Membership/BillPayment entity needed" is reversed. Membership is kept,
unchanged in shape, for Arth 2.0 — not deleted, not converted to a new
`BillPayment`/`BillSettlement` entity yet.

**Why ADR-019 was wrong, specifically:** working through a real example
(₹6,000 paid once, covering 6 months of gym) exposed a genuine gap.
Recognition (ADR-016) answers *when should this expense appear* —
that's a different question from *which specific obligations did this
payment settle*. Neither `paidBillId` (one transaction → one bill) nor
Recognition (a schedule on the Bill) can answer "which periods has this
payment already covered" once the same Bill has 6 more payments across
its lifetime and needs to reconcile against each one, plus handle
partial payments and overpayments cleanly. That's a real, load-bearing
gap Bill + Transaction alone doesn't close — ADR-019 collapsed two
distinct concepts (Recognition timing, Settlement tracking) into one
and lost information doing it.

**What's kept from ADR-019 (still correct, not reversed):**
- Bill remains the single canonical obligation entity (ADR-016)
- `paidBillId`/`isBillPayment`/`paidBillName` on Transaction is the
  correct, already-working link between a payment and its Bill —
  unchanged
- Recognition stays a Bill property (ADR-016) — unchanged

**What's different:** a future entity (tentatively `BillSettlement` —
Bill + covered Recognition periods + linked Transaction(s) + settled
amount) would properly answer the "which periods were covered" and
"partial/overpayment" questions. But building it now means a new
entity, new migration, new UI, and new bugs for benefits not yet
validated against real usage. Explicitly deferred.

**Staged plan, frozen for 2.0:**
```
Arth 2.0
  Bill                    — the obligation (per ADR-016)
  Transaction             — the payment, links via paidBillId (existing, unchanged)
  Membership (legacy)     — kept as-is: linkedTxnId, periods[], billerAccountId
                            + ONE new field: billId (links it to its Bill)
```
Migration for 2.0, deliberately minimal: for each Membership, create or
match its Bill, set `billId` on the Membership, and set
`isBillPayment/paidBillId/paidBillName` on its linked Transaction.
`periods[]` stays exactly where it is — not moved, not restructured.
Nothing deleted, nothing invented, smallest change that connects
Membership to the new Bill domain without losing what it already knows.

**Explicitly deferred to 2.1/3.0, not decided now:** whether Membership
becomes a real `BillSettlement` entity, or disappears entirely once
Bills have run in production long enough to answer that from real usage
rather than speculation — partial payments, prepayments, and prevention
of a premature abstraction are all real open questions parked here on
purpose.

## ADR-019 — Membership eliminated; collapses into Bill + Transaction
**⚠️ Superseded by ADR-020 above.** Kept in full below for the reasoning
trail — the Recognition-vs-Settlement gap that prompted the reversal is
itself useful history, not something to delete.

**Decision:** No separate `Membership` entity in Arth 2.0, and no new
`BillPayment` entity either. Both collapse into two entities already
frozen in earlier ADRs:

- **Bill** — the recurring obligation itself. `type` becomes an
  attribute (`one-time | recurring | subscription | EMI | loan |
  insurance | utility | tax`), not a separate module per type.
  "Subscription" is a Bill type, not its own system.
- **Transaction** — the payment. A Bill payment is an ordinary
  Transaction with `paidBillId` set (per ADR-017's relationship
  mechanism — already frozen, not new).

**Why no `BillPayment` entity was needed:** the one thing Membership's
current shape does that a plain Transaction doesn't — covering multiple
future periods in one payment (`periods[]`, e.g., paying 6 months of
gym at once) — is structurally identical to **Recognition**, already a
property of Bill (ADR-016: `recognitionMethod`, `recognitionDuration`).
A ₹24,000 insurance payment recognized ₹4,000×6 months and a single
payment covering 6 gym periods are the same shape; Recognition already
covers it. No third entity required.

**Net result:** the entire obligations domain (Bills, Subscriptions,
Memberships, Insurance, Utilities, EMIs, Loans) is now exactly two
entities — Bill and Transaction — both already fully specified by prior
ADRs (ADR-016 Recognition, ADR-017 relationships, ADR-018 Account/Payment
Method). This is a bigger simplification than an earlier proposed chain
(Membership → Bill Template → Bill → BillPayment); it collapses to Bill
+ Transaction directly.

**Migration approach — Assisted Migration, not automatic or manual-only:**
never silently invent a Bill from inferred data, and never force a
tedious per-item reconciliation wizard either. For each existing
Membership: pre-fill a Bill draft from its known merchant, frequency,
amount, and paying account; derive `type` and Recognition settings from
its `periods[]` shape; show a review screen with everything pre-filled
so the user only corrects what Arth genuinely can't infer (e.g., exact
due-day, auto-debit status); on confirm, create the Bill and re-point
the Membership's `linkedTxnId` transaction to carry `paidBillId`
instead. Real data migration, not a cosmetic relabeling — every existing
Membership record needs to go through this flow, not just new ones.

**Not yet designed:** the actual review-screen UI/flow for this
migration, and the exact `periods[]` → Recognition field mapping logic.
Both are next.

## ADR-018 — Account vs Payment Method, and permanent delete for 2.0

**Decision 1 — Account vs Payment Method, genuinely new modeling, not a
formalization of what exists.** `Account` answers "where does the money
live" (required). `Payment Method` answers "how was it executed"
(optional — Debit Card, UPI, Net Banking, Cheque). Today, UPI is its own
account type, meaning "HDFC Savings," "HDFC UPI," and "HDFC Debit Card"
would represent the same real money three separate ways. Under this
model, the money lives in one `Account` (HDFC Savings), and Payment
Method is a thin, optional label on top — cleaner for Cash Flow, Net
Worth, Reports, and transfers, since balance calculations stop needing
to reconcile near-duplicate account representations of the same funds.

**Credit cards stay Accounts, not payment methods** — they carry a
balance, statement, due date, interest, and EMI support, i.e. they're a
real financial entity with liabilities, not just a payment rail. A
credit card transaction has `Account: HDFC Credit Card`, `Payment
Method: (blank)`.

**Real implication, not yet resolved (flagging so it isn't lost):** this
is a genuine data-model change from what exists today — migrating a
UPI-typed account into "a payment method on a bank account" affects
every historical transaction tied to that account. This ADR freezes the
target model; it does not yet decide the migration path for existing
UPI accounts. That's implementation work for whenever this actually gets
built, not decided here.

**Implemented:** `paymentMethod` (optional, nullable field) added to
Quick Add, Full Add, and Transaction Details — scoped exactly per
follow-up decisions: only shown/settable for Expense + Bank-account
transactions (Debit Card or UPI), never for CC/Cash accounts (redundant
with the account), never for Income or Transfer (the payer's method
isn't knowable, and account-to-account transfers don't need it). No
migration performed — existing transactions simply have this field as
`null`, matching the Release Criteria's "no schema migration required."
The UPI-account-migration question above remains genuinely open.

**Decision 2 — Delete stays permanent for Arth 2.0.** No soft delete, no
`deletedAt`, no recycle bin, no restore — `Delete → Confirm → Yes →
Permanent`. Matches what's actually built today (confirmed: deletion is
already immediate and permanent, no code change required for this
decision). Explicitly revisitable as its own future ADR if
Sync/Cloud-Backup/Collaboration ever make undo-ability matter — not
bundled into the Transactions domain model now.

## ADR-017 — Transaction Type Taxonomy: frozen, not redesigned
**Decision:** The `type` field represents the primary financial event
only, and stays intentionally small. **Frozen list — these are the only
top-level transaction types:**
```
expense · income · transfer · cc_payment · cc_emi · settlement_in · settlement_out · investment
```
Everything else extends a transaction via **flags** (`isRefund`,
`reimbursable`) or **relationships** (`paidBillId` — this already exists
today, paired with an `isBillPayment` flag; not a new field — `linkedLoanId`,
`linkedInvestmentId`, `linkedPersonId`) rather than a new type.

**Why this wasn't a redesign:** checked the actual codebase before
deciding anything — Refund, Loan repayment, and Investment redemption
*already* work exactly this way (`isRefund` flag on `settlement_in`,
`linkedLoanId`/`linkedInvestmentId` relationships on ordinary
transactions). This ADR formalizes an existing, working pattern as a
rule, rather than replacing a system that was never actually broken.
Redesigning transaction types from scratch here would have been exactly
the "second system requiring migration" mistake rejected in ADR-016.

**Adjustment — resolved as NOT a transaction type.** Two different use
cases exist under that name: (1) a user mis-entered an amount — that's
just editing the existing transaction, no new concept needed; (2) real
bank-vs-Arth balance mismatch reconciliation — a genuine gap, but the
right shape for it is a future **Account Reconciliation workflow**
(`Account → Reconcile → Difference Detected → Create System Adjustment
Transaction`) that generates a system transaction when needed, not a
type users manually pick day-to-day. Deferred until that workflow is
designed — not blocking anything now.

**Deferred future consideration, explicitly not acted on now (recorded
so it isn't silently forgotten, but also isn't touched prematurely):**
whether `cc_payment`/`cc_emi` should eventually become account/payment-
method behavior rather than top-level transaction types (buying
something on a card is still an `expense`; paying the card bill is
arguably a `transfer` between a liability and an asset account; an EMI
is a repayment schedule on a purchase, not its own event type). Real
migration risk if changed now — explicitly parked for a future
"Arth 3.0" re-evaluation, not this pass.

## ADR-016 — Financial Engine architecture: Bills as the single source of truth for obligations
**Decision:** Rejected a new `Commitment` entity. Bills is promoted to
the canonical engine for all future financial obligations — insurance,
gym, SIPs, EMIs, school fees are "Bills with metadata," not a separate
system. Recognition (amortization) becomes a property *of* a Bill, not
of Transactions/Budget/Cash Flow. Cash Flow consumes Bills + Transactions
+ Expected Income directly — nothing consumes a `Commitments` table,
because one never gets created. Safe to Spend is upgraded in place
(Opening Balance + Expected Income − Upcoming Bills − Expected Variable),
not replaced with a parallel calculation.

**Formal principle adopted, to govern all future additions:** there must
be exactly one source of truth for every financial concept — Transactions
= money that moved, Bills = future obligations, Accounts = where money
lives, Expected Income = future inflows, Recognition = a Bill property,
Safe to Spend = a calculation, never stored data.

**Module boundary, explicit (prevents the ambiguity the review flagged):**

| Module | Uses Cash | Uses Recognition |
|---|---|---|
| Transactions | ✅ | ❌ |
| Cash Flow | ✅ | ❌ |
| Budget | ❌ | ✅ |
| Reports | Both (toggle) | ✅ |
| Timeline | ✅ | ❌ |
| Net Worth | ✅ | ❌ |

**Verified against the real data model before accepting the plan (not
assumed):** Bills already has `frequency`, `recurring`, `dueDate`,
`billerAccountId`, `consumerNumber` — that part of "extend Bills" is
genuinely free. Two things are completely new, not already-there:
Recognition fields (`recognitionMethod`, `recognitionDuration` — don't
exist at all today) and a flexible metadata store (today there's only
one hardcoded `consumerNumber` field; the doc's "Policy Number/Student
Name/Membership ID" idea needs a genuine `metadata: {}` object added to
the Bill record, not more hardcoded per-type fields). Both are additive
— nothing existing needs to migrate — so the plan holds, but Sprint 1
scoping should account for these two real additions rather than assume
Bills needs zero schema work.

**Sprint 1 scope, as redefined:** Transactions 2.0 (enhance, don't
replace), a new Cash Flow screen (consumes Bills/Transactions/Expected
Income only), and Expected Income as simple recurring entries. Explicitly
NOT in Sprint 1: touching Bills' schema, migrating Memberships, redesigning
Safe to Spend's existing calculation. The Recognition fields and metadata
store are prerequisites for Cash Flow's "Committed Outflow" card
specifically, so they land whenever that card is actually built, not
before it's needed.

## ADR-015 — Suspend further Bills domain extraction
**Decision:** Domain-function extraction for Bills is suspended. No more
searching for pure functions inside `BillsPage`. Future coupling
reduction targets state architecture (`useArthData()` or equivalent) or
screen-responsibility changes, not further pure-function pulls.

**Evidence:** BillsPage's own dependency count across all domain work:
38 → 35 (`remainingShare`) → 34 (Cards pass) → 34 (Bills refunds pass,
net zero — `getNetBillAmount` left the list, `refundTotalsByBill`
entered it, since the extraction removed the closure that used to hide
it). The re-classification from ADR-012 explains why: Domain logic (8
items) has largely been addressed by the two completed passes. What
remains — State (7) and Mutations (8) — are exactly the categories
pure-function extraction was never designed to solve. More auditing
would find fewer and fewer qualifying functions for diminishing benefit.

**Conclusion, stated formally:** Dependency measurements indicate that
additional domain-function extraction is unlikely to materially reduce
BillsPage coupling. Further reductions require state architecture or
changes to screen responsibilities, not more pure-function extraction.

**Consequence for `useArthData()`:** the original justification for
building it (Bills needs it to become extractable) no longer holds on
its own — domain extraction closed most of what was closeable without
it. Whether to build `useArthData()` now needs to stand on its own
merits (testability, consistency, reduced duplication across screens),
not as a means of forcing Bills under a dependency threshold. See
`V1_DEFINITION.md`'s updated answer to "does v1.0 require
`useArthData()`."

## ADR-014 — Milestone: Domain Layer Phase 2 (Bills refunds)
**Decision:** Extracted `computeRefundTotalsByBill`/`getNetBillAmount`
into `domain/bills/refunds.js`, same six-step process as Cards (ADR-013).
Both had passed the parameterization audit cleanly in an earlier pass;
this pass confirmed nothing had changed since, then executed.
**Why:** Closes out the two-pass Domain Layer work identified when Bills
was re-measured and found to be roughly half business-logic coupling,
not state (ADR-012). Both target functions turned out simpler than
Cards' — no transitive dependency surprises like `toDateOnly`, since
`refundTotalsByBill` only ever depended on `txns` directly.

**Per the established roadmap, this closes Domain Layer work by
default** — next is re-measuring Bills' full dependency count (now with
both `getCardSummary` and `getNetBillAmount` gone from its closure), then
a UI/UX polish sprint. Further architecture work isn't ruled out, but
isn't the default next step either — it would need its own justification
the way this pass was justified by Bills' re-measurement.

**Closed:** runtime regression confirmed against the live app — Bills
refunds checklist passed clean, no issues found. Domain Layer Phase 2
status: 🟢 Complete.

## ADR-013 — Milestone: Domain Layer Phase 1
**Decision:** Treating the point after the Cards pass (pending its
runtime regression check) as an internal milestone — "Domain Layer
Phase 1" — not a user-facing release, but the first point where three
domains (`shared`, `bills`, `cards`) exist, each introduced through the
same disciplined process: measure → audit → parameterize → extract →
validate → document.
**Why:** Gives a clean, named baseline before Bills refunds (Pass 2)
starts, and a concrete point to reference later if anything needs
tracing back ("this predates/postdates Domain Layer Phase 1"). Structure
at this point:
```
src/domain/
├── bills/periodCalculations.js
├── cards/summaries.js
└── shared/remainingShare.js
```
Measured, not claimed: BillsPage's own dependency count dropped 35→34
from the Cards pass — `getCardSummary` was a direct dependency,
`getCardCycleDates`/`dateAtDay` were not (only called inside
`getCardSummary`'s body), so they don't move BillsPage's own number even
though they did move real code out of `App.jsx`. Reporting the smaller,
accurate figure rather than counting all three as "removed dependencies."

**Closed:** runtime regression confirmed against the live app — Cards
checklist passed clean, no regressions found. Phase 1 status: 🟢 Complete.

## ADR-012 — Domain service layer, extracted before useArthData() implementation
**Decision:** Re-measuring Bills for extraction readiness surfaced that
~half its coupling is business-logic functions, not raw state. Rather
than implement `useArthData()` next as originally planned (Phase 1:
Transactions/Accounts/Categories), inserted a new layer —
`src/domain/<area>/` — and extracted Bills' provably-pure functions
first. Architecture is now `App → useArthData → Domain Services →
Screens`, not `App → useArthData → Screens`.
**Why:** Moving `bills`/`billers`/`billerAccounts` into a hook without
addressing the business-logic coupling first would relocate the data but
leave Bills exactly as coupled as before — the hook would just become a
new place for that coupling to live, risking the "second 15,000-line
file, just inside a hook" failure mode. Splitting "move pure functions"
(mechanical, low-risk) from "design the shared state hook"
(higher-stakes) keeps each pass provable on its own. Also formalized the
**Function Extraction Checklist** (`CODING_STANDARDS.md`) as a result —
a function needs no hooks, no closure over state, no setters, no JSX, no
DOM access to qualify; anything that fails is a refactor candidate, not
an extraction candidate, and gets its own dedicated pass.

**Not logged here:** the `sharePaymentRequest`/`doTxnShare` duplicate
implementation found during this audit. That's a defect, not a decision
— tracked in `TECH_DEBT.md` (TD-001) instead, kept deliberately separate
from this log.

## ADR-011 — Events extraction: re-measure, don't reuse old numbers
**Decision:** Re-ran the mechanical dependency trace on Events
immediately before extracting, rather than trusting the count from the
original Goals-vs-Events comparison several turns earlier.
**Why:** The codebase changed in between (Events gained Budget tracking,
`EventsListModal` grew from 39 to 107 raw lines). Re-measuring caught
this growth and, in the process, caught a third instance of the same
boundary-measurement bug (component range bleeding into a
later-added component) before it could produce a wrong dependency count.
Confirms the rule from ADR-006 generalizes: measure at the time of
extraction, not once and assume it stays valid.

---

## ADR-010 — useArthData() is designed before it's built
**Decision:** Wrote `USE_ARTH_DATA_DESIGN.md` fully before writing any
implementation code.
**Why:** Same discipline that made the Design System pass safe — design
and measure first, build second. The design doc grounds every field/action
against real code (`txns` not `transactions`, real vs aspirational
actions marked explicitly) rather than an idealized shape that would need
correcting during implementation anyway.

## ADR-009 — Design System: build three, migrate one each, stop
**Decision:** Built `BottomSheet`, `EmptyState`, `StatCard` — each with
exactly one real migration to prove it — and explicitly did **not**
convert `Button`/`Card`/`Page`/`Header`.
**Why:** The audit (`COMPONENT_INVENTORY.md`) found Card/Button are
shared style *objects*, not components. Converting those touches a much
larger surface of the app for less proven benefit than three new,
narrowly-scoped components. Same risk logic as not extracting Timeline
in one shot — bigger surface, more chances for a silent mismatch.

## ADR-008 — Person attribution: one contribution per transaction, not summed across fields
**Decision:** Rewrote `getPersonAttributedAmount` to return on the first
matching field (`people` → `tagItems` → `allocations` → `forPerson`,
priority order) instead of summing every field that happened to match.
**Why:** The original design assumed these four fields were mutually
exclusive descriptions of one fact. They weren't, for transactions
created under earlier versions of the tagging flow — summing them
silently doubled amounts (confirmed: Nykaa ₹2,989→5,978, Healthy Bones
₹600→1,200, both exactly 2×). A second, independent copy of nearly the
same logic (`personSpend`) had drifted from the first fix and needed
correcting separately — this is why the fix now calls the one function
instead of reimplementing the field-priority logic a second time.

## ADR-007 — Timeline, People, Bills extraction postponed
**Decision:** None of these three get extracted until `useArthData()`
exists.
**Why:** Measured, not assumed — Timeline: 61 external dependencies,
People: 87 (also over the ~700-line ceiling), Bills: 48. All three fail
the Extraction Readiness Score (<20). Threading 60+ individual props, or
hiding the same giant closure behind one `ctx` object, were both
considered and rejected — neither is real modularity, just a different
shape of coupling.

## ADR-006 — Extraction Readiness Score: dependency count, measured mechanically
**Decision:** No screen gets extracted without first measuring its
external dependency count via a mechanical diff (every identifier used
vs. every identifier defined locally), not by reading the code and
guessing.
**Why:** Timeline was originally assumed to be the safe, low-dependency
first extraction ("recently touched, feature-complete"). Measuring it
found 61 dependencies — completely wrong assumption. The same mechanical
process caught two of its own boundary-measurement bugs (component
ranges bleeding into the next component) before they could produce a
wrong number, which is the argument for mechanical measurement over
manual reading at this file's size, not just a one-time correction.

## ADR-005 — Goals is the first screen extraction, not Timeline
**Decision:** Extracted Goals → `src/screens/GoalsScreen.jsx`.
**Why:** Direct consequence of ADR-006 — every one of Goals' three pieces
scored under 10 dependencies, lower than any single piece of Events, and
far below Timeline/People/Bills.

## ADR-004 — Quick Add: split-with and vehicle tagging stay on the main sheet
**Decision:** Split-with (equal split) and vehicle tagging are visible,
optional chips on the primary Quick Add screen, not hidden behind "More
options" the way an earlier spec draft proposed.
**Why:** Explicit product call — hiding common actions behind an extra
tap increases workflow, which contradicts the app's actual goal. The
"More options" escape hatch is reserved for genuinely uncommon cases
(unequal splits, groups, investments), not moved-out-of-convenience.

## ADR-003 — Add Transaction: new simple-save path, not a rewrite of the existing form
**Decision:** Quick Add constructs its own minimal transaction object
and saves directly, rather than reusing or extending the existing
2,653-line `AddModal`.
**Why:** Reaching into `AddModal`'s internals to add a "simple mode"
would touch code shared by every transaction type (splits, investments,
EMI) for a feature that only needs a small, independently-reviewable
subset of that logic. The full form stays completely untouched and
reachable via "More options" — nothing was removed, a faster path was
added alongside it.

## ADR-002 — Pure-function extraction only; business logic stays in App.jsx
**Decision:** Pass 3A/3B extracted only zero-dependency pure functions
and constants (`theme.js`, `dateHelpers.js`, `currency.js`, etc.).
Domain/business logic (`normalizeAccountTypes`, SMS parsing, settlement
dedup, the date-parsing chain rooted at `toDateOnly`) stayed in `App.jsx`
deliberately.
**Why:** Business logic is still evolving — extracting it now would mean
moving a moving target. `investmentConfig.js` was split out from what was
originally going to be `formatters.js`, after discovering
`formatInvestmentMetric` depended on investment-domain config, not pure
formatting — the domain boundary should follow what the code actually
needs, not a predetermined file list.

## ADR-001 — Extract by dependency graph, not by file size or intuition
**Decision:** Adopted "map dependencies before every extraction pass" as
a standing rule, after Pass 3A's `formatInvestmentMetric` discovery.
**Why:** A function that looked like a simple formatter turned out to
depend on investment-domain config — extracting it into `formatters.js`
as originally planned would have created a misleading module boundary.
Mapping first, every time, catches this before it becomes structural.

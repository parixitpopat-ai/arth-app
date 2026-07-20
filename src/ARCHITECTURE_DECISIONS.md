# Arth — Architecture Decisions (ADR-lite)

Not implementation detail — the *why* behind major calls, so six months
from now the reasoning is still there, not just the outcome. Newest
first. Add an entry whenever a decision this size gets made, not
retroactively in a batch.

---

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

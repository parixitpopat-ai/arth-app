# Arth — Architecture Decisions (ADR-lite)

Not implementation detail — the *why* behind major calls, so six months
from now the reasoning is still there, not just the outcome. Newest
first. Add an entry whenever a decision this size gets made, not
retroactively in a batch.

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

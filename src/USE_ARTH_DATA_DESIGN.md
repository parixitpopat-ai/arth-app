# useArthData() — Design Specification

**Status: Design only. No implementation.** This document exists so the
shape is agreed before any code moves — the same discipline that made
Goals' extraction safe: measure and design first, migrate second.

## Purpose

`useArthData()` is the shared application data interface for Arth. It
exposes application **state** and **business actions** through a stable
interface, so screens can depend on it instead of reaching into
`App.jsx`'s closure directly — which is the exact reason Timeline (61
dependencies), People (87), and Bills (48) all failed the Extraction
Readiness Score.

It is explicitly **not** allowed to become a second 15,000-line God
object. See "Local Screen State" below for what it must never absorb.

## Grounding note

Every field name below is the **real** name already in `App.jsx`
(checked directly, not invented) — `txns` not `transactions`, `cats` not
`categories`. When this gets implemented, the hook should expose data
under these existing names, or the migration touches every consumer
twice (once to add the hook, once to fix naming) for no reason.

---

## State Ownership

### Transactions
**State:** `txns`

**Actions — real today (exist as inline logic, would move as-is):**
- Create (Quick Add's `saveDirect`, AddModal's `submit`)
- Edit (AddModal's `submit` with `editTxn`)
- Delete (`setConfirmDeleteTxn` → immediate, permanent `filter()`)
- Repeat (Timeline's `SwipeableTxnRow.repeatTxn` — clones with new id/date)

**Actions — aspirational, don't exist yet, would need building:**
- `duplicateTransaction()` as a named, reusable action (currently only
  exists inline as Timeline's swipe-repeat)
- Soft delete / `deletedTransactions` — **does not exist**. Deletion is
  immediate and permanent today (confirmed: `setTxns(prev=>prev.filter(...))`).
  If this hook is meant to expose `deletedTransactions`, that's new
  product behavior to decide on, not a refactor of something that exists.
- `recurringTransactions` — the real state is `recurringSchedules`
  (investment-recurrence specific, not a general recurring-transaction
  engine). A general recurring-transaction concept doesn't exist yet.

### Accounts
**State:** `accounts`

**Actions — real today:** add, edit (both exist as form submits)

**Aspirational:** `archiveAccount()` — no archive concept exists for
accounts at all (confirmed empty when checked earlier this session,
during the Chapter 3 architecture-doc review). Deleting an account isn't
even reliably possible today; archiving doesn't exist either.

### Categories
**State:** `cats`

**Actions — real today:** add, edit inline in Settings

**Aspirational:** `renameCategory()` as a distinct named action — exists
today as part of the general category-edit form, not a dedicated
rename-only flow. Fine to expose as a named action; it's a thin wrapper
over what already works.

### People & Groups
**State:** `people`, `groups`

**Actions — real today:** add, edit, remove (Person Dashboard's "Remove"
button)

**Aspirational:** `mergePeople()` — does not exist. If two person records
end up representing the same person, there's no merge tool today (same
gap class as the duplicate-transaction problem, different entity).

### Bills
**State:** `bills`, `billerAccounts`, `billers` (three separate
collections — the hierarchy is Biller → Billers Account → Bills, not one
flat list)

**Actions — real today:** add, mark paid, edit

**Aspirational:** `snoozeBill()` — no snooze/defer concept exists for
bills today.

### Goals
**State:** `goals`

**Actions — real today, and already clean since this is the one screen
already extracted:** `AddGoalModal`'s save (create/edit), `AddContributionModal`'s
save (contribute), `GoalsListModal`'s mark-complete button (archive-ish,
though it's a status flip, not a true archive)

This is the one domain where "design the actions" and "look at what
Goals already does" are the same exercise — GoalsScreen.jsx is a working
reference for what this section of the hook should look like.

### Events
**State:** `events`

**Actions — real today:** add, edit (`AddEventModal`'s save, handles both)

## Derived Values

These are already computed once and reused today — the hook's job is to
centralize them, not invent new calculations:

| Derived value | Already exists as |
|---|---|
| Financial Health Score | `financialHealthScore` useMemo (Home) |
| Net Worth | `netWorthValue` |
| Monthly Spend | `myActual` (via `getMyExpenseAmount`) |
| Budget Utilization | computed inline per-screen (Budget tab, Home hero) — **not yet centralized**, real duplication risk here already |
| Upcoming Bills | computed inline in Bills, Home's Action Centre — **also duplicated today** |
| Goal Progress | `getGoalProgress` (already a clean, reusable function) |
| Investment Allocation | computed inline in Wealth tab |

Worth noting: Budget Utilization and Upcoming Bills are **already**
computed more than once independently, in different screens, with no
shared source — this is the same class of risk that caused the person-
attribution double-count bug (two implementations of one fact, diverging
silently). Centralizing these two specifically has real, proven-pattern
value, not just theoretical tidiness.

## Local Screen State — Explicitly Out of Scope

Stays inside screens, never moves into the hook:
search text, selected tab, expanded sections, sort order, modal
visibility (`showAddGoal`, `showQuickAdd`, etc.), form drafts, scroll
position, filters (`txnCategoryFilter` and the other ~15 Timeline filter
states)

## Screen Dependencies (measured, from the Extraction Readiness Score work)

| Screen | External deps (measured) | Reads | Writes |
|---|---|---|---|
| Goals | 5-16 per component, all <20 | goals, accounts | goals |
| Events | 7-19 per component, all <20 | events, txns, people | events |
| Timeline | 61 | txns, cats, accounts, people, groups + ~15 filter states | txns |
| Bills | 48 | bills, billerAccounts, billers, accounts | bills, billerAccounts |
| People | 87 | people, groups, txns, budgets | people, groups |
| Home | Not measured yet — depends on nearly everything (Accounts, Budgets, Bills, Goals, Events, Financial Health) | everything | mostly nothing directly — reads derived values |

Timeline/Bills/People's real numbers are why they're blocked — this
table is the same evidence from `DEPENDENCY_MAP.md`, not a new estimate.

## Evolution Plan

**Phase 1** — Transactions, Accounts, Categories (highest-traffic,
already relatively clean actions)

**Phase 2** — People, Bills, Goals (Goals is nearly free — it's already
extracted and already shaped like what this phase wants)

**Phase 3** — Events, Investments, Analytics/derived values

**Phase 4** — AI (still parked), Sync, Settings

Extraction unlocks in this order once its phase's data is in the hook:
Goals (already done) → Events → Bills → Timeline/People (need Phase 1+2
complete) → Home (needs everything)

## What "done" looks like for this document

This document is complete when every domain above has real field names
(✅, done — grounded against actual code) and every listed action is
tagged real-today vs aspirational (✅, done). Implementation is a
separate, future decision — this stays a design doc until that's
explicitly greenlit.

# PPL-006 — School Completion: Trace, Decisions, Implementation Plan

**This supersedes the previous Person UI sequence for now. School completion is the active engineering priority.**

**Status:** Trace + decisions for review. No code written. No production data touched. No schema changed.
**Date:** 2026-09-02
**Method:** Trace → Decision → Plan → Approve → Execute → Verify. This document covers Trace, Decision, and Plan. Approve/Execute/Verify come after your sign-off.

---

## Correction carried forward from PPL-005 response

The Insurance framing in this task's brief has the finding reversed. Actual trace result: `insurancePolicies[]` is live and complete (full CRUD, cloud-synced), not vestigial. The gap is that it has no `personId` field — only free-text `insuredPerson` — so it can't attribute to a saved Person yet. The `"Insurance"` `BILLER_TYPES` label diverts into that same list rather than creating a real `billerAccounts` record, so there isn't yet a working "Insurance-as-biller" path either. This doesn't change the instruction — Insurance stays untouched during School completion — only the documented reasoning for it.

---

## A. Current School architecture (trace)

Two layers, cleanly separated in the existing code:

**Financial engine — `src/domain/schoolFees/*`** (confirmed via your own `find`/`grep`: `annualSummary.js`, `creditNotes.js`, `discountWriteOff.js`, `futureMoney.js`, `outstanding.js`, `periodGeneration.js`, `service.js`, `settlement.js`, `startingState.js`, each with a matching `.test.js`), plus `feeSchedules[]`/`feePeriods[]`/`schoolCreditNotes[]` state in `App.jsx` and the `SchoolFeesScreen.jsx` UI. This matches `I-5-School-Fees-Implementation-Plan.md`'s WP-1 through WP-10 essentially one-to-one. **Production-ready. Not being touched.**

**Person relationship foundation — `src/domain/school/relationship.js` + `feeScheduleLink.js`, and `src/domain/person/personOverview.js`.** Built (ARTH-003 WP-C2/C3/B1), tested (`relationship.test.js`, `feeScheduleLink.test.js`, `personOverview.test.js`), but not connected to live `App.jsx` state. This is the layer being completed now.

## B. Existing tested modules that get reused, not rebuilt

- `createSchoolRelationship`, `endSchoolRelationship`, `isSchoolRelationshipCurrent`, `getCurrentSchoolRelationship`, `getHistoricalSchoolRelationships` — `relationship.js`, built on Membership's generic `lifecycle.js`.
- `getFeeSchedulesForRelationship`, `getPersonFeeSchedules`, `isFeeScheduleLinkedToPerson` — `feeScheduleLink.js`.
- `getPersonActiveConnections`, `getPersonSpendingSummary` — `personOverview.js`, already called from `App.jsx` (line 8852) with a `getPersonActiveConnections` signature that already accepts `schoolRelationships` as an optional source — no signature change needed for the wiring itself.

One small adaptation is needed to `relationship.js` (Decision 2 below) — not a rebuild, a field addition to an existing tested function.

## C. Live state/UI gaps (confirmed by direct trace, `arth-app.zip`)

1. No `schoolRelationships[]` state exists in `App.jsx` — no `useState`, no setter, no localStorage key, no cloud-snapshot entry.
2. `AddSchoolYearModal`'s one call site hardcodes `personId={null}` — no Person Picker exists in the School Fees UI at all.
3. `PersonProfileScreen` receives `schoolRelationships={[]}` as a literal at its render call site, and defaults the prop to `[]` in its own signature — both deliberately, per existing comments, pending this exact wiring.
4. `getPersonActiveConnections`'s result (`activeConnections`) is computed at the call site but never consumed downstream — an orphaned variable today.
5. `feeSchedules` has both `billerAccountId` and `personId` fields already in its shape (confirmed in `service.js`'s `createSchoolFeeSchedule`) — `billerAccountId` is accepted but, like `personId`, never populated by the one real call site.

## D. Canonical Person attribution — recommendation

**School should attribute through `billerAccounts[].attributedTo` + `attributeType:"person"`, exactly like Membership does — not through a standalone `schoolId`.**

Reasoning, from direct trace: `billerAccounts` records have no status/lifecycle field of their own (`{id, billerId, name, type, consumerNo, provider, attributedTo, attributeType, note, createdAt}` — confirmed, no `status` field exists). `createMembershipRelationship` already keys off `billerAccountId`, not a separate Membership-specific entity ID — the biller account *is* the "which organisation" identity; the relationship record only adds status/history on top. School should converge onto this exact pattern: each school becomes a `billerAccounts` record (type "School Fees", named for the school), attributed to a person via the existing generic mechanism, and `schoolRelationships[]` becomes the lifecycle enrichment layer on top of that `billerAccountId` — not a competing identity source. This is precisely the PPL-004 Branch-1-plus-enrichment shape, applied correctly this time.

## E. Should `schoolRelationships[]` survive, be adapted, or be retired?

**Adapted — not retired, not left as-is.**

It should survive because School has a genuine, already-locked product need the plain-attribution mechanism can't give on its own: "current vs. historical school" (RPP-002 §1/§5, already locked) is exactly the kind of independently-changing status the PPL-004 extension-point rule reserves for a lifecycle object. A `billerAccounts` record alone can't represent "this was the school, now it isn't" — it's a static attribution, not a status history.

It needs adapting because it currently identifies a relationship by a standalone `schoolId` + `personId`, with no `billerAccountId` — which is the direct cause of `feeScheduleLink.js`'s own documented limitation (can't distinguish which of a person's multiple relationships a given fee schedule belongs to). Adding `billerAccountId` to the relationship's shape — mirroring `membershipRelationships` exactly — removes that ambiguity for free and makes School converge onto the same enrichment pattern Membership already uses, rather than staying a parallel one-off.

## F. `schoolId` vs. `schoolName` — recommendation

**Retire the standalone `schoolId` concept. The `billerAccounts` record's own `id` and `name` become the authoritative school identity.**

There is currently no mechanism tying a stable `schoolId` to the free-text `schoolName` already on `feeSchedules` — `feeScheduleLink.js`'s header calls this out directly as unresolved. Once School routes through `billerAccounts` (Decision D), the biller account's own `id` is already a stable identity and its `name` is already the human-readable label — a second, parallel "schoolId" would only reintroduce the exact reconciliation problem PPL-004's Item 6 rule exists to prevent. `feeSchedules.schoolName` can stay as a display convenience/legacy field, but stops being anyone's source of truth.

## G. "Change School" — recommendation

**In scope, but as end-old + create-new — never in-place edit — using primitives that already exist.**

`relationship.js`'s own comments already document this as the correct pattern ("never edit schoolId on an existing relationship... end old, then create genuinely new"). With `billerAccountId` as the identity (Decision D/F), a school change becomes: end the current `schoolRelationships` entry (`endSchoolRelationship`, already built and tested) for the old biller account, create a new `billerAccounts` record for the new school, attribute it to the person, and `createSchoolRelationship` for the new pairing (also already built and tested). No new domain logic is required — this is UI sequencing over two existing functions, low-cost enough to include in this pass rather than deferring it.

## H. Locked invariant — carried into this plan, not just this task

**Financial attribution ≠ saved Person.** A `feeSchedules` record, like any transaction or bill, can be created with no person selected at all — that remains a fully legitimate, unchanged state throughout this work. Nothing in this plan makes person-selection mandatory anywhere in the School flow. This mirrors the exact guardrail already given for Mobile Recharge in PPL-005 and should be treated as a standing Arth OS rule, not a School-specific carve-out — worth adding to the locked-invariants list once this lands.

---

## I. Implementation work packages (naming only — not started)

- **WP-1** — Adapt `relationship.js`: add `billerAccountId` to `createSchoolRelationship`'s required params, alongside the existing `personId`/`startDate`/`genId`. Update `relationship.test.js` accordingly. Small, contained change to an already-tested module.
- **WP-2** — Adapt `feeScheduleLink.js`'s join functions to filter by `billerAccountId` (unambiguous) rather than `personId` alone, resolving its own documented limitation. Update `feeScheduleLink.test.js`.
- **WP-3** — `App.jsx`: add `schoolRelationships[]` state, setter, localStorage key, cloud-snapshot wiring — mechanical, same pattern as every other array.
- **WP-4** — `SchoolFeesScreen.jsx`: `AddSchoolYearModal` gains a way to select or create a "School Fees" biller account (reusing the existing biller-account creation UI/pattern used elsewhere), replacing the hardcoded `personId={null}`. On save with a person attributed: create the biller account if new, call `createSchoolRelationship` if no current relationship exists for that `billerAccountId`+`personId` pair, and set `feeSchedules.billerAccountId`/`personId` from it. No person selected still works exactly as today.
- **WP-5** — Wire the real `schoolRelationships` array into the `getPersonActiveConnections` call site and into `PersonProfileScreen`'s prop (replacing the two `[]` hardcodes). Decide during implementation whether `PersonProfileScreen`'s own inline `schoolRelationships.filter(...)` should be replaced by consuming `activeConnections`'s output instead of duplicating the filter — flagging this as a small in-flight decision, not a blocker.
- **WP-6** — "Change School" action: UI trigger that calls `endSchoolRelationship` on the current entry and starts the new-school flow from WP-4.

No WP here touches the financial engine (`schoolFees/*`) or Insurance.

## J. Data-migration implications

**None.** `feeScheduleLink.js`'s own header confirms every real `feeSchedules` record in production today has `personId === null` (the one call site has always hardcoded it). There is nothing to migrate — this is greenfield wiring on top of existing empty fields, not a backfill.

## K. Tests required

- `relationship.test.js` — updated fixtures/assertions for the new required `billerAccountId` param, including the existing "required field" throw-tests extended to cover it.
- `feeScheduleLink.test.js` — new cases for `billerAccountId`-based filtering; regression case confirming a person with two relationships (old school ended, new school active) now resolves correctly, the exact scenario the current limitation can't handle.
- `personOverview.test.js` — no shape change needed for `getPersonActiveConnections` itself, but add an end-to-end-style case with a real `billerAccountId`-bearing relationship to confirm nothing broke.
- `App.jsx`-level regression: `AddSchoolYearModal` with no person selected still creates a working schedule exactly as today.
- New: selecting a person and completing the flow produces a `feeSchedules.billerAccountId`/`personId` pair matching a real `schoolRelationships` entry, and that entry surfaces correctly in `getPersonActiveConnections`.
- New: `endSchoolRelationship` correctly removes an entry from "current" while it remains visible via `getHistoricalSchoolRelationships`, exercised through the Change School flow specifically (WP-6).

---

## Summary

School's financial engine needs nothing. What's missing is: converge School's identity onto `billerAccounts` instead of a standalone `schoolId` (Decision F), keep `schoolRelationships[]` but adapt it to key off `billerAccountId` like Membership already does (Decision E), then do the mechanical wiring (WP-3 through WP-5) plus the small Change School flow (WP-6). No financial data migration, no schema risk, no Person UI expansion — the existing Person Profile Organisations section receives real data through the same read path it already has.

Awaiting your review before Execute begins.

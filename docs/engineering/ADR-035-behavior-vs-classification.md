# ADR-035 — Behavior vs. Classification: Domain Type Modeling Pattern

`Proposed 2026-08-04` · **Status: ✅ Approved (Frozen)** — signed off 2026-08-04

Elevated from an Accounts-specific bug discovery (ACC-001/WP-02) to a general architectural rule, following the same pattern ADR-033 used when it generalized from a Transactions-scoped decision — the reasoning applies wherever a domain concept has both a fixed set of *system-meaningful* behaviors and an open, user-extensible *label/classification* layered on top.

**Relationship to ADR-018's freeze clause:** this doesn't invoke the reopening clause independently — it's answering a modeling gap surfaced while executing work ADR-032/033/034 already authorized (ACC-001, itself downstream of those). Not a new precedent for the freeze; a continuation of one already granted.

---

## The discovery that motivated this

While wiring `AddAccountModal` through the newly-scaffolded `Account` aggregate (ACC-001/WP-02), tracing `normalizeAccountTypes` (`src/App.jsx` L134–165) showed that **account "type" is not a closed set of 5 values**, contrary to what ACC-001 §2 had assumed (traced from `ACC_TYPES`, the built-in 5). Users can define custom account "behaviors" at runtime (Settings, L11684 — e.g. "Crypto", "BNPL"), stored with no system-meaningful behavior mapping at all; `normalizeAccountTypes` then treats each custom entry's own `id` as its `baseType` — meaning `selectedAccountBaseType` in the UI can be an arbitrary user-typed string, not one of the 5 the rest of the codebase's balance/ledger logic actually switches on.

**The root cause: `normalizeAccountTypes` conflates three separate concepts under one field (`baseType`):**

1. **Behavior** — how the account behaves in the ledger (balance computation, transaction attribution). Currently: `bank`, `cash`, `cc`, `debit`, `upi`. Closed, system-defined, because every downstream calculation (`accountBalance`, `getCardSummary`, `AccDetailModal`'s `ledgerRows`) is written as an explicit switch over exactly these values.
2. **Classification** — the user-facing subtype/label (Savings Account, Salary Account, Crypto, BNPL, Gold Wallet). Open, user-extensible, no behavioral meaning of its own.
3. **Presentation** — icon, label text, color, bucket grouping. Cosmetic, derived from classification, no invariant weight.

## Decision

**Any domain concept with this shape (fixed system behavior + open user labeling) must model Behavior and Classification as two separate fields, never one field serving both roles.**

- **Behavior** belongs to a closed, domain-owned enumeration. It is a real invariant — validated by the aggregate, never extended by configuration.
- **Classification** is configuration, analogous to how Categories already work in this app (user-extensible, no behavioral weight of its own — confirmed as an existing, working pattern elsewhere, not a new one invented here).
- **Every Classification must declare exactly one canonical Behavior.** This is the rule that closes the original bug: a user creating a "Crypto" classification must state whether it behaves like a bank-type account, a card, or something else — there is no implicit default that silently falls through undefined behavior.

## Consequences

**For Accounts specifically:** `Account.type` (as scaffolded in WP-01) is renamed `Account.behavior`, validated against the closed enum. `accountTypeId`/`typeLabel`/`typeIcon`/`typeBucket` (WP-01's passthrough fields) become `classificationId`/`classificationLabel`/`icon`/`bucket` — classification/presentation, not validated by the aggregate, same non-invariant status Categories already have.

**Migration required:** existing `customBaseBehaviors` entries have no behavior mapping today. This is real migration work, not free — tracked in ACC-002 (see its Migration Notes addendum), not silently absorbed here.

**Architecturally, this implies a missing abstraction:** an **Account Type Registry** — today, `normalizeAccountTypes` living inside `App.jsx` is that registry in all but name. Long-term shape (not built by this ADR, direction only):

```
domain/accounts/
  Account.js              — aggregate, owns invariants (including: valid behavior)
  AccountBehavior.js       — the closed enum + any behavior-specific rules
  AccountTypeRegistry.js   — owns the open set of classifications, each with a declared behavior
```

Registry owns available classifications; Settings mutates the registry; UI consumes it; the aggregate never sees anything but a validated `behavior` value. This keeps runtime-configurable state out of the aggregate (rejecting the earlier-considered "pass `knownTypeIds` into the aggregate" option — that would have made the UI's current configuration the source of truth for a domain invariant, backwards from how invariants should be owned).

## Scope

This ADR establishes the *pattern*, not a mandate to immediately refactor every place a similar conflation might exist (Categories were mentioned as already following roughly this shape informally — not audited here, no claim made about them beyond the analogy). Applied to Accounts now because that's where the evidence surfaced; adopted elsewhere only when a future audit finds the same shape with real evidence, per the same discipline ADR-033 established for its own scope.

## What this does not decide

- Full design of `AccountTypeRegistry`/`AccountBehavior` — direction only, implementation deferred
- The exact migration mechanics for existing `customBaseBehaviors` records — ACC-002's job
- Whether Categories or any other part of the app has the same conflation — not audited, not claimed

## Implementation note (added 2026-08-04, same session)

**A classification without a behavior is a valid migration state, but not a valid steady state.**

This gives migration work somewhere safe to land without weakening the aggregate's invariant for newly created accounts. `Account`'s constructor invariant (behavior must be one of the closed enum, no exceptions) stays exactly as strict as originally frozen — it never accepts a null/unmapped behavior, not even during migration. An account whose legacy data can't be deterministically mapped to a behavior simply **does not become an `Account` instance yet** — it stays in an explicit unresolved/pre-aggregate state (`migrationState: "NEEDS_BEHAVIOR"`) until a real decision (user or otherwise) supplies one. See WP-02a in `ACC-002-migration-implementation-plan.md` for the concrete mechanism.

## Sign-off

**Approved and Frozen 2026-08-04.**

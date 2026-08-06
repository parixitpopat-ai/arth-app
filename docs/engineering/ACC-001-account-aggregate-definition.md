# ACC-001 — Account Aggregate Definition

`Opened 2026-08-04` · **Status: ✅ Approved (Frozen), Amended 2026-08-04** — deletion strategy resolved; Behavior/Classification amendment per ADR-035 · Input: ACC-000 §4 (Mutation Ownership Matrix), AQ-003 (Frozen), ADR-035 (Frozen)

Scope, per Major's redirection of this ticket: the 7 mutation sites ACC-000 found with no canonical owner — account creation (5 branches), update, and deletion. Reconciliation is explicitly out of scope here; it's governed by AQ-003.

---

## Amendment (2026-08-04) — Behavior vs. Classification, per ADR-035

Discovered while executing WP-02: `type` is not a closed set of 5 values as originally assumed here — `normalizeAccountTypes` lets users define custom "behaviors" (Crypto, BNPL, etc.) with no system-meaningful mapping, so `selectedAccountBaseType` in the UI can be an arbitrary string. Full evidence and reasoning in **ADR-035**. This amendment updates §2's type-validity row and §3's aggregate shape accordingly — nothing else in this document changes.

**§2 amendment — replaces the original "`type` must be one of the 5 base types" row:**

| Invariant | Evidence |
|---|---|
| `behavior` must be one of the closed enum (`bank`, `cash`, `cc`, `debit`, `upi`) | Per ADR-035 — renamed from `type`. This is the real, system-owned invariant; every downstream calculation (`accountBalance`, `getCardSummary`, `ledgerRows`) switches on exactly these 5 values, confirmed by ADR-035's trace |
| `classificationId`/`classificationLabel`/`icon`/`bucket` are open, user-configurable, no invariant weight | Per ADR-035 — renamed from `accountTypeId`/`typeLabel`/`typeIcon`/`typeBucket`. Every classification must declare exactly one canonical `behavior` — enforced where classifications are registered (future `AccountTypeRegistry`, not yet built), not by `Account` itself, since `Account` only ever receives an already-resolved `behavior` value |

**§3 amendment:** the code sketch's `type` field and `accountTypeId`/`typeLabel`/`typeIcon`/`typeBucket` fields are superseded by `Account.js`'s actual implemented shape (`behavior`, `classificationId`, `classificationLabel`, `icon`, `bucket`) — see `Account.js` directly rather than this document's original sketch, which predates the amendment and is left unedited below for historical accuracy of what was originally proposed.

---

## 1. What is the Account aggregate root?

**`Account`**, one instance per row currently in the `accounts` array. This isn't a new claim — every mutation site in ACC-000's census already treats one `Account` as the unit of change — but it's worth stating explicitly since AQ-001 already established that CC `outstanding` does *not* belong to `Account` (it belongs to the future `Payable`, associated-with but not owned-by Account). So `Account`'s own boundary, post-AQ-001, is: identity, type, display metadata, opening-balance/reconciliation state (owned per AQ-003), and type-specific linkage fields (`linkedBank`, `linkedAccount`) — not settlement or outstanding-debt state.

## 2. Invariants (traced to real validation code, not designed fresh)

| Invariant | Evidence |
|---|---|
| Name is required | `AddAccountModal` L6279: `if(!name.trim()){setError("Name required");return;}` |
| `type` must be one of the 5 base types (`bank`, `cash`, `cc`, `debit`, `upi`) | `ACC_TYPES` (L20, `Arth.jsx`-era constant, confirmed still present via `accountTypeOptions`/`ACC_TYPES` usage at L2771/L6274) |
| A `debit` account requires a `linkedBank` | `AddAccountModal` L6280: `if(selectedAccountBaseType==="debit"&&!linkedBank){setError("...required for debit cards");return;}` — **note: this check does not exist in `EditAccountModal`**, a real invariant-coverage gap this aggregate definition should close, not carry forward |
| A `cc` account has `outstanding` initialized to 0 at creation | `AddAccountModal` L6294 — though per AQ-001, this field is a confirmed dead write; the aggregate should not perpetuate initializing a field nothing reads. Flagging as a **candidate simplification**, not a hard invariant to encode. |
| An account cannot be deleted while it has linked records (transactions, or is itself a debit/UPI's link target) without explicit resolution | **Not currently enforced anywhere** — this is the confirmed defect from ACC-000 §11. **Frozen invariant, §4:** deletion requires either zero references or mandatory reassignment — orphaned references are not a valid domain state. |
| An account has a lifecycle state distinct from deletion — `active` or `archived` | **Not currently modeled on Account at all** — this is a new addition, not evidence recovered from existing code. It mirrors an already-established pattern elsewhere in the app: Insurance policies carry a `status:"archived"` field (`App.jsx` L12312, L15373) filtered out of active lists the same way this proposes for Accounts. Flagging the provenance difference explicitly: every other row in this table traces to code that exists today; this one traces to a design decision made in this ticket. |
| `attributedTo`/`attributeType` reference a Person or Group | `AddAccountModal`/`EditAccountModal`, both set these but **neither validates the referenced ID exists** — flagged in ACC-000 as a boundary leak, not resolved here (out of scope: this is a Person/Group aggregate concern, Account only needs to hold the reference validly-shaped, not validate cross-aggregate existence — consistent with ADR-033's "aggregates expose intention-revealing methods, services orchestrate," where existence-validation of a *different* aggregate is the orchestrator's job, not Account's) |

## 3. Lifecycle commands

Mirroring `Transaction.js`'s established pattern (`AggregateRoot` base, static factory, instance methods, `_raise` events):

```js
// src/domain/accounts/Account.js — PROPOSED, not yet implemented (design only, per method step 6: "only then implement")

export class AccountValidationError extends Error { ... }

export const VALID_ACCOUNT_TYPES = ["bank", "cash", "cc", "debit", "upi"];

export class Account extends AggregateRoot {
  constructor({ id, type, name, color, last4 = null, linkedBank = null, linkedAccount = null,
                attributedTo = null, attributeType = null, /* type-specific fields */ }) {
    super(id);
    if (!VALID_ACCOUNT_TYPES.includes(type)) throw new AccountValidationError(`Invalid type "${type}"`);
    if (!name || !name.trim()) throw new AccountValidationError("Account requires a name");
    if (type === "debit" && !linkedBank) throw new AccountValidationError("Debit account requires a linked bank");
    // ...assign fields
  }

  static create(params) {
    const acc = new Account(params);
    acc._raise({ type: "AccountCreated", accountId: acc.id, accountType: acc.type, occurredAt: new Date().toISOString() });
    return acc;
  }

  update(changes = {}) {
    // Re-validate type-specific invariants on every field that changes —
    // this is precisely what closes the gap where EditAccountModal's debit-link
    // check was missing (ACC-000 §2) and the UPI-link field went missing
    // entirely until a user reported it: one validation path instead of two.
    if (changes.linkedBank !== undefined && this.type === "debit" && !changes.linkedBank) {
      throw new AccountValidationError("Debit account requires a linked bank");
    }
    Object.assign(this, changes);
    this._raise({ type: "AccountUpdated", accountId: this.id, changes, occurredAt: new Date().toISOString() });
  }

  // Archive/unarchive — the everyday "I don't use this anymore" action.
  // Does NOT touch any Transaction reference; historical data is untouched by
  // design. Archived accounts are excluded from active lists/new-transaction
  // pickers but remain fully intact for reporting and ledger history — same
  // pattern already established for Insurance policies (App.jsx L12312).
  archive() {
    if (this._deleted) throw new AccountValidationError("Cannot archive a deleted account");
    this.status = "archived";
    this._raise({ type: "AccountArchived", accountId: this.id, occurredAt: new Date().toISOString() });
  }

  unarchive() {
    this.status = "active";
    this._raise({ type: "AccountUnarchived", accountId: this.id, occurredAt: new Date().toISOString() });
  }

  // delete() is intentionally NOT a simple flag-flip like Transaction.delete().
  // Per the frozen invariant (§4): an Account may not be deleted while
  // referenced by financial events. This method assumes the orchestrator
  // (§4) has already resolved every reference — either verified there are
  // none, or completed reassignment — before calling it. Account itself does
  // not and cannot verify reference-freedom; that requires querying
  // Transaction, a different aggregate, which is the orchestrator's job per
  // ADR-033, not Account's.
  markDeleted() {
    if (this._deleted) throw new AccountValidationError("Account is already deleted");
    this._deleted = true;
    this._raise({ type: "AccountDeleted", accountId: this.id, occurredAt: new Date().toISOString() });
  }
}
```

This is a design sketch for sign-off, not a merge-ready implementation — flagging explicitly per the method's step 6 ordering ("only then implement... behavior changes before storage changes").

## 4. Deletion orchestration — resolved

**Frozen invariant:**

> An Account may not be deleted while referenced by financial events. Deletion must either (1) reassign all references to another Account within the same command, or (2) be rejected. Orphaned transaction references are not a valid domain state.

**Decision: option (b) — require explicit reassignment.** Rejected (a) blanket-blocking as a dead end for legitimate account closures/migrations; rejected (c) orphan-and-defer as manufacturing an invalid domain state that every downstream reader (ledger, reports, budgets, transfers, reconciliation, exports, analytics) would then have to defensively handle.

**Archive vs. Delete distinction** — the everyday case ("I don't use this account anymore") is modeled as **Archive**, not Delete:

| | Archive | Delete |
|---|---|---|
| Frequency | Default, everyday action | Rare, administrative |
| Visibility | Hidden from active lists/new-txn pickers | Removed entirely |
| New transactions | Blocked | N/A — account doesn't exist |
| Historical transactions | Untouched, fully intact | Must be zero or fully reassigned first |
| Reversible | Yes (`unarchive()`) | No |

This means the actual account-lifecycle traffic (closing a bank account, migrating a card, merging wallets) mostly never reaches the harder Delete path at all — Delete becomes the rare case that specifically needs its reference-resolution machinery, not the default one.

**Proposed flow, per ADR-033's pattern:**

```
AccountDeletionService (stateless domain service)
  .deleteAccount(accountId, { reassignTo })
    1. Query linked Transactions (read-only) — same computation ConfirmDeleteAccount
       already does today at L6669, just relocated
    2. Query linked sibling Accounts (debit/UPI pointing at this one) — L6670-6671's
       existing computation
    3. If linked Transactions exist and no reassignTo given → reject (command
       fails, UI must collect a replacement account first — this is what
       replaces today's warning-only dialog)
    4. If reassignTo given → call Transaction's own exposed reassignment method
       for each linked transaction (Transaction decides how its own accId
       fields change — the service never reaches into Transaction's internals
       directly, per ADR-033's core rule)
    5. Call sibling Account.update() to clear linkedBank/linkedAccount (already-
       correct behavior, just relocated from ConfirmDeleteAccount's inline code)
    6. Call account.markDeleted()
    7. Trigger projection recalculation (ledgers/reports/budgets that cached
       anything about this account)
```

## 5. What this does not decide

- Whether `Payable`'s introduction (AQ-001, not yet implemented) changes anything about Account's own shape — no evidence yet that it does, Account and Payable are described as separate entities that merely associate
- Implementation sequencing/timeline — that's ACC-002/ACC-003 territory (Migration Plan), once this is signed off
- UI/UX design for the reassignment-picker flow §4 step 3 requires — a product design question downstream of this architectural decision, not answered here
- Whether Archive should be available for `cc` accounts differently than others (e.g. does an archived card still need to show outstanding-balance follow-through?) — no evidence gathered on this, flagging as open rather than assuming

## 6. Candidate CBR entries this establishes

Per the method ("register canonical rules... a living document, not a one-time report"), this ticket contributes these entries to an Accounts CBR:
- Account creation invariants (name, type validity, debit→linkedBank) — owner: `Account` aggregate
- Account update invariants — same owner, same rule set re-applied (closing the create/update duplication found in ACC-000)
- Account archive/unarchive — owner: `Account` aggregate, new lifecycle state
- Account deletion — owner: `AccountDeletionService` (orchestration) + `Account`/`Transaction` (state changes); **frozen invariant:** no deletion without zero-or-reassigned references

---

**Frozen 2026-08-04.** Deletion strategy (b, with Archive/Delete split) incorporated per review before freezing. Next: ACC-002 (Aggregate implementation sequencing / Migration Plan), or the reassignment-picker UX design, whichever you want to tackle first.

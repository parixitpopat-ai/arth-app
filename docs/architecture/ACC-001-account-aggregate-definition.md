# ACC-001 — Account Aggregate Definition

`Opened 2026-08-04` · Status: **Proposed, not Active** — needs sign-off, same discipline as every prior ADR/AQ this session · Input: ACC-000 §4 (Mutation Ownership Matrix), AQ-003 (Frozen)

Scope, per Major's redirection of this ticket: the 7 mutation sites ACC-000 found with no canonical owner — account creation (5 branches), update, and deletion. Reconciliation is explicitly out of scope here; it's governed by AQ-003.

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
| An account cannot be deleted while it has linked records (transactions, or is itself a debit/UPI's link target) without explicit resolution | **Not currently enforced anywhere** — this is the confirmed defect from ACC-000 §11. This aggregate definition proposes it become a real invariant (§4 below), not left as a warning-only UI check. |
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

  // delete() is intentionally NOT a simple flag-flip like Transaction.delete().
  // See §4 — deletion requires cross-aggregate orchestration, so Account itself
  // only exposes the terminal state change; resolving Transaction references
  // is the orchestrator's job, per ADR-033.
  markDeleted(resolution /* { reassignedTo } | { orphaned: true } */) {
    this._deleted = true;
    this._raise({ type: "AccountDeleted", accountId: this.id, resolution, occurredAt: new Date().toISOString() });
  }
}
```

This is a design sketch for sign-off, not a merge-ready implementation — flagging explicitly per the method's step 6 ordering ("only then implement... behavior changes before storage changes").

## 4. Deletion orchestration (the hard part)

This is the one command that can't live inside `Account` alone, because resolving dangling `Transaction.accId`/`fromAccId`/`toAccId` references requires touching a different aggregate — exactly the shape ADR-033 exists for.

**Proposed flow, per ADR-033's pattern:**

```
AccountDeletionService (stateless domain service)
  .deleteAccount(accountId)
    1. Query linked Transactions (read-only) — same computation ConfirmDeleteAccount
       already does today at L6669, just relocated
    2. Query linked sibling Accounts (debit/UPI pointing at this one) — L6670-6671's
       existing computation
    3. Decide resolution strategy — NOT decided by this document. Real options,
       needing your call:
         a. Block deletion if linked transactions exist (safest, most restrictive)
         b. Require explicit reassignment to another account before deleting
         c. Allow deletion, orphan the references, surface them in a "needs
            reassignment" list elsewhere in the app (closest to current UI copy's
            promise — "Linked records will need reassignment later" — except
            actually building the "later")
    4. Call Transaction's own exposed method to detach/reassign (Transaction
       decides how its own accId fields change — AccountDeletionService never
       reaches into Transaction's internals directly, per ADR-033's core rule)
    5. Call sibling Account.update() to clear linkedBank/linkedAccount (already-
       correct behavior, just relocated from ConfirmDeleteAccount's inline code)
    6. Call account.markDeleted(resolution)
```

**This document does not pick (a)/(b)/(c) above.** That's a product decision as much as an architectural one (ACC-000 §8 already separated this into the Product Debt Register, not just Technical Debt). Recommend it gets resolved explicitly — either here before I mark ACC-001 ready to freeze, or as its own fast-follow decision — rather than defaulting silently to whichever option looks simplest to implement.

## 5. What this does not decide

- The exact resolution strategy for deletion (§4) — open, needs your input
- Whether `Payable`'s introduction (AQ-001, not yet implemented) changes anything about Account's own shape — no evidence yet that it does, Account and Payable are described as separate entities that merely associate
- Implementation sequencing/timeline — that's ACC-002/ACC-003 territory (Migration Plan), once this is signed off

## 6. Candidate CBR entries this establishes

Per the method ("register canonical rules... a living document, not a one-time report"), once signed off this ticket contributes these entries to an Accounts CBR:
- Account creation invariants (name, type validity, debit→linkedBank) — owner: `Account` aggregate
- Account update invariants — same owner, same rule set re-applied (closing the create/update duplication found in ACC-000)
- Account deletion — owner: `AccountDeletionService` (orchestration) + `Account`/`Transaction` (state changes), pending §4's open resolution-strategy decision

---

**Needs your sign-off before this moves from Proposed to Active** — in particular, a decision on §4's resolution strategy is the one open item blocking a clean freeze.

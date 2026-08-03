// TRX-002B — TransactionPersonShare.
// Per Team 1's frozen model + the AQ-002 addendum: this is the value object shape
// shared by both Transaction and Bill (Bill's own implementation is out of this
// ticket's scope, but must match this shape when it's built).
//
// This class exists specifically to make two invariants structurally impossible
// to violate, rather than manually re-verified at every call site (which is
// exactly how BUG-TRX-001 happened — the same "reduce owed amount, recompute
// settled" logic hand-written 4 separate times, with no shared enforcement):
//
//   Invariant 1 (Team 1, Invariant Table): `settled` always equals
//     `remainingAmt <= 0` — computed, never independently settable.
//   Invariant 2 (Team 1, Invariant Table): `settledAmt` never exceeds `amount`.
//
// Immutable by design — applySettlement() returns a new instance rather than
// mutating in place, so a reference to an old share can never silently become
// stale/wrong after a settlement elsewhere.

import { Money } from "./Money.js";

export class PersonShareValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PersonShareValidationError";
  }
}

const VALID_MODES = ["owes", "owes_by_me", "on_me"];

export class TransactionPersonShare {
  constructor({ personId, amount, mode, settledAmt = 0 }) {
    if (!personId) throw new PersonShareValidationError("PersonShare requires a personId");
    if (!VALID_MODES.includes(mode)) {
      throw new PersonShareValidationError(`Invalid mode "${mode}" — must be one of ${VALID_MODES.join(", ")}`);
    }
    this.personId = personId;
    this.mode = mode;
    this.amount = Money.of(amount);

    // Invariant 2, enforced here: settledAmt can never exceed amount, because
    // there is no path to construct an instance where it does.
    const requestedSettled = Money.of(settledAmt);
    this.settledAmt = requestedSettled.isGreaterThan(this.amount) ? this.amount : requestedSettled;

    Object.freeze(this);
  }

  // Invariant 1, enforced here: remainingAmt is always computed, never stored
  // independently — this is the exact field that was missing entirely in the
  // original bill-status bug (bill.status never recomputed after settlement).
  get remainingAmt() {
    return this.amount.subtractClamped(this.settledAmt);
  }

  get settled() {
    return this.remainingAmt.isZero();
  }

  // The SettlementTarget-style operation (ADR-033's contract, applied at the
  // value-object level here — the aggregate's applySettlement() is what
  // actually implements SettlementTarget; this method is its building block).
  // Returns a NEW share — never mutates this one.
  applySettlement(paymentAmount) {
    const applied = Money.of(Math.min(Money.of(paymentAmount).amount, this.remainingAmt.amount));
    return new TransactionPersonShare({
      personId: this.personId,
      mode: this.mode,
      amount: this.amount.amount,
      settledAmt: this.settledAmt.amount + applied.amount,
    });
  }
}

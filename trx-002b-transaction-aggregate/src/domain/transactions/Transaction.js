// TRX-002B — Transaction aggregate root.
// Implements the model frozen in Team 1's transaction-aggregate.md and the
// SettlementTarget contract from ADR-033. Every invariant below traces to a
// specific row in Team 1's Invariant Table — see the comment at each check.

import { AggregateRoot } from "../contracts/AggregateRoot.js";
import { Money } from "./Money.js";
import { TransactionPersonShare, PersonShareValidationError } from "./TransactionPersonShare.js";

export class TransactionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TransactionValidationError";
  }
}

// Frozen per the real repo's ADR-017/030 taxonomy — not redesigned, just encoded
// as a constructor guard so it can't silently drift.
export const VALID_TRANSACTION_TYPES = [
  "expense", "income", "transfer", "cc_payment", "cc_emi",
  "settlement_in", "settlement_out", "investment",
];

export class Transaction extends AggregateRoot {
  constructor({
    id, type, date, amount, accountId,
    categoryId = null, subcategoryId = null, note = null,
    personShares = [], lineItems = [],
  }) {
    super(id);

    if (!VALID_TRANSACTION_TYPES.includes(type)) {
      throw new TransactionValidationError(
        `Invalid transaction type "${type}" — must be one of: ${VALID_TRANSACTION_TYPES.join(", ")}`
      );
    }
    if (!date) throw new TransactionValidationError("Transaction requires a date");

    // Invariant (Team 1 Invariant Table): "Transaction has exactly one Account
    // reference" — enforced by requiring it, not by any array/multiplicity.
    if (!accountId) throw new TransactionValidationError("Transaction requires an accountId");

    // Invariant (Team 1 Invariant Table): "Transaction type constrains which
    // fields/child objects are valid (per ADR-017)". PersonShare[] only makes
    // sense for expense-type transactions, per the real code's own usage
    // (confirmed in AQ-002's audit — split/settlement attribution is an
    // expense-only concept in the current model).
    if (personShares.length > 0 && type !== "expense") {
      throw new TransactionValidationError(
        `PersonShare[] is only valid for type "expense", got "${type}"`
      );
    }

    this.id = id;
    this.type = type;
    this.date = date;
    this.amount = Money.of(amount);
    this.accountId = accountId;
    this.categoryId = categoryId;
    this.subcategoryId = subcategoryId;
    this.note = note;

    // Validate each share is a real TransactionPersonShare (or shape it into one)
    this.personShares = personShares.map(s =>
      s instanceof TransactionPersonShare ? s : new TransactionPersonShare(s)
    );
    this.lineItems = lineItems; // LineItem instances, caller's responsibility (validated by LineItem's own constructor)

    this._deleted = false;
  }

  // --- Behavior: post() ---
  static post(params) {
    const txn = new Transaction(params);
    txn._raise({
      type: "TransactionPosted",
      transactionId: txn.id,
      txnType: txn.type,
      amount: txn.amount.amount,
      occurredAt: new Date().toISOString(),
    });
    return txn;
  }

  // --- Behavior: edit() ---
  edit(changes = {}) {
    if (this._deleted) {
      throw new TransactionValidationError("Cannot edit a deleted transaction");
    }
    if (changes.amount !== undefined) this.amount = Money.of(changes.amount);
    if (changes.note !== undefined) this.note = changes.note;
    if (changes.categoryId !== undefined) this.categoryId = changes.categoryId;
    if (changes.subcategoryId !== undefined) this.subcategoryId = changes.subcategoryId;
    if (changes.date !== undefined) this.date = changes.date;

    this._raise({
      type: "TransactionEdited",
      transactionId: this.id,
      changes,
      occurredAt: new Date().toISOString(),
    });
  }

  // --- Behavior: delete() ---
  // Per ADR-018 (real repo, unchanged): permanent, no soft-delete. This method
  // is the terminal operation — no `deletedAt` field, no recoverable state.
  // The `_deleted` flag here exists only to prevent double-operating on the same
  // in-memory instance within one process lifetime; it is not a persisted
  // "soft delete" flag.
  delete() {
    if (this._deleted) {
      throw new TransactionValidationError("Transaction is already deleted");
    }
    this._deleted = true;
    this._raise({
      type: "TransactionDeleted",
      transactionId: this.id,
      occurredAt: new Date().toISOString(),
    });
  }

  // --- SettlementTarget contract (ADR-033) ---
  outstanding() {
    return this.personShares
      .filter(s => s.mode === "owes")
      .reduce((sum, s) => sum.add(s.remainingAmt), Money.zero());
  }

  applySettlement(personId, paymentAmount) {
    if (this._deleted) {
      throw new TransactionValidationError("Cannot settle a deleted transaction");
    }
    const idx = this.personShares.findIndex(s => s.personId === personId);
    if (idx === -1) {
      throw new PersonShareValidationError(
        `No PersonShare found for person "${personId}" on transaction ${this.id}`
      );
    }

    const share = this.personShares[idx];
    const appliedAmount = Money.of(Math.min(Money.of(paymentAmount).amount, share.remainingAmt.amount));
    const updatedShare = share.applySettlement(paymentAmount);

    this.personShares = [
      ...this.personShares.slice(0, idx),
      updatedShare,
      ...this.personShares.slice(idx + 1),
    ];

    this._raise({
      type: "TransactionSettlementApplied",
      transactionId: this.id,
      personId,
      appliedAmount: appliedAmount.amount,
      remainingAmt: updatedShare.remainingAmt.amount,
      fullySettled: updatedShare.settled,
      occurredAt: new Date().toISOString(),
    });

    return { fullySettled: updatedShare.settled, appliedAmount };
  }
}

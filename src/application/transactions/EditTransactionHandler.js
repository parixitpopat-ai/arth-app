// WP-TXN-01 — EditTransaction command handler.
// Same shape as ApplySettlementHandler: load the aggregate, call its own
// method, save, publish. Never reaches into the aggregate's fields directly.
//
// This handler is legacy-shape-agnostic on purpose — it only ever receives
// `changes` already mapped to the five fields Transaction.edit() actually
// applies (amount, note, categoryId, subcategoryId, date). Deciding whether
// a submission is representable this way at all is the representability
// boundary's job (transactionRepresentability.js / transactionBoundary.js),
// not this handler's — by the time a command reaches here, that decision
// has already been made.

import { CommandResult } from "../CommandResult.js";
import { TransactionValidationError } from "../../domain/transactions/Transaction.js";
import { PersonShareValidationError } from "../../domain/transactions/TransactionPersonShare.js";
import { MoneyValidationError } from "../../domain/transactions/Money.js";

const DOMAIN_ERRORS = [TransactionValidationError, PersonShareValidationError, MoneyValidationError];

// The only fields Transaction.edit() applies. A `changes` payload
// containing any other key is a programming error upstream (the
// representability boundary should have routed this to the legacy path
// instead of dispatching EditTransaction at all) — this handler fails loud
// rather than silently ignoring or silently applying an unsupported key.
const EDITABLE_FIELDS = ["amount", "note", "categoryId", "subcategoryId", "date"];

export class EditTransactionHandler {
  constructor({ repository, eventPublisher }) {
    this._repository = repository;
    this._eventPublisher = eventPublisher;
  }

  async handle(command) {
    const { transactionId, changes = {} } = command.payload;

    const unsupportedKeys = Object.keys(changes).filter(k => !EDITABLE_FIELDS.includes(k));
    if (unsupportedKeys.length > 0) {
      return CommandResult.failure(
        "UNSUPPORTED_EDIT_FIELDS",
        `EditTransaction received field(s) Transaction.edit() cannot apply: ${unsupportedKeys.join(", ")}. ` +
        `The caller must route this submission through the legacy path instead of dispatching EditTransaction.`
      );
    }

    const txn = await this._repository.load(transactionId);
    if (!txn) {
      return CommandResult.failure("NOT_FOUND", `No transaction found with id "${transactionId}"`);
    }

    try {
      txn.edit(changes);
    } catch (err) {
      if (DOMAIN_ERRORS.some(ErrClass => err instanceof ErrClass)) {
        return CommandResult.failure("VALIDATION_ERROR", err.message);
      }
      throw err;
    }

    await this._repository.save(txn);
    const events = txn.pullEvents();
    await this._eventPublisher.publish(events);

    return CommandResult.success(
      { id: txn.id, type: txn.type, amount: txn.amount.amount },
      events
    );
  }
}

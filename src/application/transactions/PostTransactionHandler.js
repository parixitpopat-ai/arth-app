// TRX-002B — Example command handler proving repository integration through
// TRX-002A's Application Layer. Same shape as CreateTagHandler, now with the
// real aggregate instead of the trivial example.

import { CommandResult } from "../CommandResult.js";
import { Transaction, TransactionValidationError } from "../../domain/transactions/Transaction.js";
import { PersonShareValidationError } from "../../domain/transactions/TransactionPersonShare.js";
import { LineItemValidationError } from "../../domain/transactions/LineItem.js";
import { MoneyValidationError } from "../../domain/transactions/Money.js";

const DOMAIN_ERRORS = [TransactionValidationError, PersonShareValidationError, LineItemValidationError, MoneyValidationError];

export class PostTransactionHandler {
  constructor({ repository, eventPublisher }) {
    this._repository = repository;
    this._eventPublisher = eventPublisher;
  }

  async handle(command) {
    let txn;
    try {
      txn = Transaction.post(command.payload);
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

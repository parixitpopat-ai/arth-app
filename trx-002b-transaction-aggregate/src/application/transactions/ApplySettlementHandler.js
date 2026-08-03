// TRX-002B — Example command handler for settling a transaction's person share.
// Demonstrates load -> mutate via aggregate method -> save -> publish, the
// pattern every real settlement command (including the eventual SettlementService
// orchestration, ADR-033) will follow — load the aggregate, never reach into its
// fields directly, call its own method, let it decide what changed.

import { CommandResult } from "../CommandResult.js";
import { TransactionValidationError } from "../../domain/transactions/Transaction.js";
import { PersonShareValidationError } from "../../domain/transactions/TransactionPersonShare.js";

export class ApplySettlementHandler {
  constructor({ repository, eventPublisher }) {
    this._repository = repository;
    this._eventPublisher = eventPublisher;
  }

  async handle(command) {
    const { transactionId, personId, amount } = command.payload;

    const txn = await this._repository.load(transactionId);
    if (!txn) {
      return CommandResult.failure("NOT_FOUND", `No transaction found with id "${transactionId}"`);
    }

    let result;
    try {
      result = txn.applySettlement(personId, amount);
    } catch (err) {
      if (err instanceof TransactionValidationError || err instanceof PersonShareValidationError) {
        return CommandResult.failure("VALIDATION_ERROR", err.message);
      }
      throw err;
    }

    await this._repository.save(txn);
    const events = txn.pullEvents();
    await this._eventPublisher.publish(events);

    return CommandResult.success(
      { transactionId, personId, fullySettled: result.fullySettled, appliedAmount: result.appliedAmount.amount },
      events
    );
  }
}

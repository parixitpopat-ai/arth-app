// WP-TXN-01 — the first real Transaction persistence boundary.
//
// This is an adapter, not a second source of truth: `txns[]` (whatever
// array the injected statePort reads/writes) remains the single
// authoritative store. This repository never caches, never holds its own
// copy — every load()/save() call reads the live statePort at the moment
// it's called.
//
// statePort shape (deliberately duck-typed, not a class — see WP-TXN-01
// planning discussion on avoiding unnecessary abstraction):
//   { getAll(): StoredTxnRecord[], upsert(record: StoredTxnRecord): void }
// App.jsx is responsible for backing this with real React state without
// introducing stale closures (a ref-backed getAll(), a stable setTxns-based
// upsert()) — this file has no React dependency at all and must stay that
// way to remain unit-testable with a plain mock port.

import { Repository } from "../../contracts/Repository.js";
import { Transaction } from "../Transaction.js";
import { transactionFromStoredShape } from "./transactionFromStoredShape.js";
import { transactionToStoredShape } from "./transactionToStoredShape.js";

export class TxnsStateRepository extends Repository {
  constructor({ statePort }) {
    super();
    if (!statePort || typeof statePort.getAll !== "function" || typeof statePort.upsert !== "function") {
      throw new Error("TxnsStateRepository requires a statePort with getAll() and upsert()");
    }
    this._statePort = statePort;
  }

  async load(id) {
    const stored = this._findStored(id);
    if (!stored) return null;
    // Hydration via the constructor directly — NOT Transaction.post() —
    // because post() unconditionally raises a TransactionPosted event.
    // Loading an existing record for editing must not fabricate a fake
    // "just created" event.
    return new Transaction(transactionFromStoredShape(stored));
  }

  async save(aggregate) {
    const priorStoredRecord = this._findStored(aggregate.id);
    const stored = transactionToStoredShape(aggregate, priorStoredRecord);
    this._statePort.upsert(stored);
    return aggregate;
  }

  _findStored(id) {
    return this._statePort.getAll().find(t => String(t.id) === String(id)) || null;
  }
}

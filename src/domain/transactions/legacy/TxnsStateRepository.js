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
    // WP-TXN-02 — single-shot side-channel, set by the boundary immediately
    // before dispatch on the create path only, consumed and cleared by the
    // very next save(). Exists so PostTransactionHandler/EditTransactionHandler
    // never need to change at all, staying fully outside this WP's scope.
    this._pendingCreateSourceDraft = null;
  }

  // WP-TXN-02 — called by transactionBoundary.js right before dispatching a
  // "create" command, only when this repository was passed to it.
  setPendingCreateSourceDraft(draft) {
    this._pendingCreateSourceDraft = draft;
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
    // WP-TXN-02 — consume-and-clear: only relevant when priorStoredRecord is
    // null (create); a real prior record always wins over a stale pending
    // draft, matching transactionToStoredShape's own precedence.
    const createSourceDraft = this._pendingCreateSourceDraft;
    this._pendingCreateSourceDraft = null;
    const stored = transactionToStoredShape(aggregate, priorStoredRecord, createSourceDraft);
    this._statePort.upsert(stored);
    return aggregate;
  }

  _findStored(id) {
    return this._statePort.getAll().find(t => String(t.id) === String(id)) || null;
  }
}

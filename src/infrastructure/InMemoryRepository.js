// TRX-002A — In-memory Repository implementation.
import { Repository } from "../domain/contracts/Repository.js";

export class InMemoryRepository extends Repository {
  constructor() {
    super();
    this._store = new Map();
  }

  async load(id) {
    const aggregate = this._store.get(id);
    if (!aggregate) return null;
    return aggregate;
  }

  async save(aggregate) {
    this._store.set(aggregate.id, aggregate);
    return aggregate;
  }
}

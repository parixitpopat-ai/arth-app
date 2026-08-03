// TRX-002A — Aggregate Root base contract.
export class AggregateRoot {
  constructor(id) {
    if (!id) throw new Error("AggregateRoot requires an id");
    this.id = id;
    this._pendingEvents = [];
  }

  _raise(event) {
    this._pendingEvents.push(event);
  }

  pullEvents() {
    const events = this._pendingEvents;
    this._pendingEvents = [];
    return events;
  }
}

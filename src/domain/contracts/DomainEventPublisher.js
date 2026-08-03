// TRX-002A — Domain Event Publisher contract.
export class DomainEventPublisher {
  async publish(events) {
    throw new Error(`${this.constructor.name}.publish() not implemented`);
  }
}

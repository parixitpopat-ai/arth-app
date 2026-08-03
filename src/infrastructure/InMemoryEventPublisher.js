// TRX-002A — In-memory Domain Event Publisher.
import { DomainEventPublisher } from "../domain/contracts/DomainEventPublisher.js";

export class InMemoryEventPublisher extends DomainEventPublisher {
  constructor() {
    super();
    this.published = [];
  }

  async publish(events) {
    this.published.push(...events);
  }
}

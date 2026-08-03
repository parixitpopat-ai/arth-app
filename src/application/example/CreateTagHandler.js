// TRX-002A — Example Command Handler: CreateTag.
import { CommandResult } from "../CommandResult.js";
import { Tag, TagValidationError } from "../../domain/example/Tag.js";

export class CreateTagHandler {
  constructor({ repository, eventPublisher }) {
    this._repository = repository;
    this._eventPublisher = eventPublisher;
  }

  async handle(command) {
    const { id, name } = command.payload;

    let tag;
    try {
      tag = Tag.create(id, name);
    } catch (err) {
      if (err instanceof TagValidationError) {
        return CommandResult.failure("VALIDATION_ERROR", err.message);
      }
      throw err;
    }

    await this._repository.save(tag);
    const events = tag.pullEvents();
    await this._eventPublisher.publish(events);

    return CommandResult.success({ id: tag.id, name: tag.name }, events);
  }
}

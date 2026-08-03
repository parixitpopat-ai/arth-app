// TRX-002A — Example aggregate: Tag. Deliberately trivial, NOT Transaction.
import { AggregateRoot } from "../contracts/AggregateRoot.js";

export class Tag extends AggregateRoot {
  constructor(id, name) {
    super(id);
    this.name = name;
  }

  static create(id, name) {
    if (!name || !name.trim()) {
      throw new TagValidationError("Tag name cannot be empty");
    }
    const tag = new Tag(id, name.trim());
    tag._raise({ type: "TagCreated", tagId: id, name: tag.name, occurredAt: new Date().toISOString() });
    return tag;
  }

  rename(newName) {
    if (!newName || !newName.trim()) {
      throw new TagValidationError("Tag name cannot be empty");
    }
    const oldName = this.name;
    this.name = newName.trim();
    this._raise({
      type: "TagRenamed",
      tagId: this.id,
      oldName,
      newName: this.name,
      occurredAt: new Date().toISOString(),
    });
  }
}

export class TagValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TagValidationError";
  }
}

// TRX-002A — Repository contract.
export class Repository {
  async load(id) {
    throw new Error(`${this.constructor.name}.load() not implemented`);
  }

  async save(aggregate) {
    throw new Error(`${this.constructor.name}.save() not implemented`);
  }
}

// TRX-002A — Snapshot Adapter.
export class SnapshotAdapter {
  constructor({ saveSnapshot, loadSnapshot, serialize, deserialize }) {
    if (!saveSnapshot || !loadSnapshot) {
      throw new Error("SnapshotAdapter requires saveSnapshot and loadSnapshot functions");
    }
    this._saveSnapshot = saveSnapshot;
    this._loadSnapshot = loadSnapshot;
    this._serialize = serialize || (data => data);
    this._deserialize = deserialize || (data => data);
  }

  async persist(userId, repositoryState) {
    const payload = this._serialize(repositoryState);
    return this._saveSnapshot(userId, payload);
  }

  async restore(userId) {
    const raw = await this._loadSnapshot(userId);
    if (!raw) return null;
    return this._deserialize(raw);
  }
}

export async function createRealSnapshotAdapter() {
  const { saveCloudSnapshot, loadCloudSnapshot } = await import("../cloudSync.js");
  return new SnapshotAdapter({
    saveSnapshot: saveCloudSnapshot,
    loadSnapshot: loadCloudSnapshot,
  });
}

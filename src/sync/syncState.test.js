import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSyncState, saveSyncState, EMPTY_STATE, SYNC_STATE_KEY } from "./syncState.js";
import { createSafetyBackup, listSafetyBackups, MAX_KEPT } from "./safetyBackup.js";
import { createMemoryStorage } from "./testing/sim.js";

test("history belongs to one account: another account, corrupt or missing state means no history", () => {
  const s = createMemoryStorage();
  assert.deepEqual(loadSyncState(s, "u1"), { ...EMPTY_STATE, userId: "u1" });
  saveSyncState(s, { ...EMPTY_STATE, userId: "u1", baseToken: "T", baseDigest: "D" });
  assert.equal(loadSyncState(s, "u1").baseToken, "T");
  assert.equal(loadSyncState(s, "u2").baseToken, null, "account switch");
  s.setItem(SYNC_STATE_KEY, "{not json");
  assert.equal(loadSyncState(s, "u1").baseToken, null, "corrupt");
});

test("safety backups are not throttled and the newest ten are kept", async () => {
  const s = createMemoryStorage(); let n = 0;
  for (let i = 0; i < MAX_KEPT + 3; i++) {
    const r = await createSafetyBackup(s, { reason: `r${i}`, snapshot: { txns: [{ id: i }] }, now: () => 1000 + i, genId: () => `g${++n}` });
    assert.equal(r.ok, true);
  }
  const list = listSafetyBackups(s);
  assert.equal(list.length, MAX_KEPT);
  assert.equal(list[list.length - 1].reason, `r${MAX_KEPT + 2}`);
  assert.equal(list[0].reason, "r3");
});

test("a full store yields ok:false rather than a silent skip", async () => {
  const s = createMemoryStorage(); s.limit.bytes = 10;
  const r = await createSafetyBackup(s, { reason: "x", snapshot: { txns: [{ id: 1 }] }, genId: () => "g" });
  assert.equal(r.ok, false);
});

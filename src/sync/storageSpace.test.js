import { test } from "node:test";
import assert from "node:assert/strict";
import { isQuotaError, hasRoom, storageReport, buildAllBackupsExport, freeBackupSpace, SAFETY_KEY, AUTO_KEY, PROBE_KEY } from "./storageSpace.js";
import { createSafetyBackup, listSafetyBackups, listPinned, releasePinned, readSafetyBackups } from "./safetyBackup.js";
import { createMemoryStorage } from "./testing/sim.js";

const snap = (n, extra = {}) => ({ txns: Array.from({ length: n }, (_, i) => ({ id: `t${i}`, amount: 100 + i })), savedAt: `2026-11-0${(n % 9) + 1}T00:00:00Z`, ...extra });
let seq = 0; const mk = (s, snapshot, o = {}) => createSafetyBackup(s, { reason: "r", snapshot, now: () => 1000 + (++seq), genId: () => `g${seq}`, ...o });

test("isQuotaError recognises the browser's wording seen on the phone and the standard names", () => {
  assert.equal(isQuotaError(new Error("Failed to execute 'setItem' on 'Storage': Setting the value of 'arth_sync_state' exceeded the quota.")), true);
  assert.equal(isQuotaError(Object.assign(new Error("x"), { name: "QuotaExceededError" })), true);
  assert.equal(isQuotaError(new Error("network down")), false);
  assert.equal(isQuotaError(null), false);
});

test("hasRoom reports false when storage is full and leaves no probe behind", () => {
  const s = createMemoryStorage(); assert.equal(hasRoom(s), true); assert.equal(s.getItem(PROBE_KEY), null);
  s.limit.bytes = 1000; assert.equal(hasRoom(s), false); assert.equal(s.getItem(PROBE_KEY), null);
});

test("identical data is stored once; a repeat sign-out backup does not add a copy", async () => {
  const s = createMemoryStorage();
  const a = await mk(s, snap(5)); const b = await mk(s, snap(5)); const c = await mk(s, snap(5), { pinned: true, conflictId: "so_1" });
  assert.ok(a.ok && b.ok && c.ok);
  assert.equal(listSafetyBackups(s).length, 1);
  assert.equal(b.id, a.id); assert.equal(c.id, a.id);
  assert.equal(listPinned(s).length, 1, "pinned on request");
});

test("a copy held for two conflicts stays pinned until BOTH are released", async () => {
  const s = createMemoryStorage();
  await mk(s, snap(4), { pinned: true, conflictId: "c1" }); await mk(s, snap(4), { pinned: true, conflictId: "c2" });
  assert.equal(listSafetyBackups(s).length, 1);
  releasePinned(s, "c1"); assert.equal(listPinned(s).length, 1);
  releasePinned(s, "c2"); assert.equal(listPinned(s).length, 0);
  assert.equal(listSafetyBackups(s).length, 1, "released, not deleted");
});

test("full storage: oldest ordinary copies are dropped to fit the new one; pinned copies are never dropped", async () => {
  const s = createMemoryStorage();
  const held = await mk(s, snap(6), { pinned: true, conflictId: "keep" });
  for (let i = 7; i < 11; i++) await mk(s, snap(i));
  const size = s.getItem(SAFETY_KEY).length;
  s.limit.bytes = Math.round(size * 0.8);
  const r = await mk(s, snap(11));
  assert.equal(r.ok, true, r.error);
  const list = listSafetyBackups(s);
  assert.ok(list.some(b => b.id === held.id), "pinned kept");
  assert.ok(list.some(b => b.id === r.id), "new one kept");
  assert.ok(list.length < 6, "older ordinary copies made room");
});

test("full storage with nothing droppable: the backup fails (caller must not replace anything) and the pinned copy is intact", async () => {
  const s = createMemoryStorage();
  const held = await mk(s, snap(8), { pinned: true, conflictId: "keep" });
  s.limit.bytes = s.getItem(SAFETY_KEY).length + 10;
  const r = await mk(s, snap(9), { pinned: true, conflictId: "other" });
  assert.equal(r.ok, false);
  assert.deepEqual(listSafetyBackups(s).map(b => b.id), [held.id]);
});

test("report separates backup copies from working data", async () => {
  const s = createMemoryStorage({ arth_txns: "x".repeat(2000) });
  await mk(s, snap(5)); s.setItem(AUTO_KEY, JSON.stringify([{ id: "a", snapshot: snap(5) }]));
  const r = storageReport(s);
  assert.ok(r.backups > 0 && r.working >= 2000 && r.total === r.backups + r.working);
  assert.equal(r.rows[0].chars >= r.rows[r.rows.length - 1].chars, true);
});

test("export holds every backup copy; freeing removes backup copies only, keeps the newest safety copy, never the live data", async () => {
  const live = JSON.stringify([{ id: "live1", amount: 5 }]);
  const s = createMemoryStorage({ arth_txns: live, sb_dummy: "keep" });
  for (let i = 1; i <= 4; i++) await mk(s, snap(i));
  await mk(s, snap(9), { pinned: true, conflictId: "c" });
  s.setItem(AUTO_KEY, JSON.stringify([{ id: "a1", snapshot: snap(3) }, { id: "a2", snapshot: snap(2) }]));
  const exp = buildAllBackupsExport(s);
  assert.equal(exp.safetyBackups.length, 5); assert.equal(exp.autoBackups.length, 2); assert.ok(exp.snapshot);
  const before = storageReport(s).total;
  const r = freeBackupSpace(s);
  assert.equal(readSafetyBackups(s).length, 1); assert.equal(s.getItem(AUTO_KEY), null);
  assert.equal(s.getItem("arth_txns"), live); assert.equal(s.getItem("sb_dummy"), "keep");
  assert.ok(r.freedChars > 0 && storageReport(s).total < before);
});

test("freeing space with no backups present changes nothing and does not throw", () => {
  const s = createMemoryStorage({ arth_txns: "[]" });
  const r = freeBackupSpace(s); assert.equal(r.freedChars, 0); assert.equal(s.getItem("arth_txns"), "[]");
});

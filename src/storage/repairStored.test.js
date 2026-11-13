import test from "node:test";
import assert from "node:assert/strict";
import { findDamaged, newestBackupValue, repairStored, startEmpty, readNotice, KEY_TO_FIELD, DAMAGED_PREFIX, RECOVERY_NOTICE_KEY } from "./repairStored.js";
import { packList } from "../sync/packedList.js";

const mem = init => { const d = { ...init }; return { d, getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: k => { delete d[k]; } }; };
const T = id => ({ id, type: "expense", amount: 10 });
const safety = (at, snapshot) => ({ id: "sb_" + at, reason: "t", at, snapshot });

test("healthy data is left exactly as it is", () => {
  const s = mem({ arth_txns: JSON.stringify([T(1)]), arth_people: "[]", arth_checkpoints: "{}", arth_dark: "true", arth_cats: "null" });
  const before = JSON.stringify(s.d);
  const r = repairStored(s);
  assert.deepEqual(r, { restored: [], needsChoice: [] }); assert.equal(JSON.stringify(s.d), before);
});
test("an unreadable list is found, whatever the cause, and a wrong shape too", () => {
  const s = mem({ arth_txns: '[{"id":1,', arth_people: "{}", arth_checkpoints: "[]", arth_dark: '"yes"', arth_bills: "[]" });
  const d = findDamaged(s).map(x => `${x.key}:${x.why}`).sort();
  assert.deepEqual(d, ["arth_checkpoints:wrong shape", "arth_dark:wrong shape", "arth_people:wrong shape", "arth_txns:unreadable"]);
});
test("restores from the NEWEST good backup (safety or automatic), keeps a copy of the damaged text, and records a notice", () => {
  const good1 = { txns: [T(1)] }, good2 = { txns: [T(1), T(2)] }, bad = { txns: "oops" };
  const s = mem({
    arth_txns: '[{"id":1,',
    arth_sync_safety_backups: packList([safety("2026-11-01T10:00:00Z", good1), safety("2026-11-05T10:00:00Z", bad)]),
    arth_auto_backups: packList([safety("2026-11-03T10:00:00Z", good2)]),
  });
  const r = repairStored(s);
  assert.equal(r.needsChoice.length, 0); assert.equal(r.restored.length, 1);
  assert.equal(r.restored[0].from, "automatic backup"); assert.equal(r.restored[0].at, "2026-11-03T10:00:00Z");     // the newer safety copy was damaged: skipped
  assert.deepEqual(JSON.parse(s.d.arth_txns), [T(1), T(2)]);
  assert.equal(s.d[DAMAGED_PREFIX + "arth_txns"], '[{"id":1,');
  assert.equal(readNotice(s)[0].key, "arth_txns"); assert.ok(s.d[RECOVERY_NOTICE_KEY]);
});
test("no backup holds it: nothing is changed, the damaged text is copied aside, and the person is asked; starting empty only removes that key", () => {
  const s = mem({ arth_txns: '[{"id":1,', arth_people: JSON.stringify([{ id: "p1", name: "A" }]) });
  const r = repairStored(s);
  assert.deepEqual(r.needsChoice.map(x => x.key), ["arth_txns"]); assert.equal(r.restored.length, 0);
  assert.equal(s.d.arth_txns, '[{"id":1,');                                      // untouched until the person chooses
  assert.equal(s.d[DAMAGED_PREFIX + "arth_txns"], '[{"id":1,');
  startEmpty(s, ["arth_txns"]);
  assert.equal("arth_txns" in s.d, false); assert.equal(s.d[DAMAGED_PREFIX + "arth_txns"], '[{"id":1,'); assert.ok(s.d.arth_people);
});
test("a key that is not part of backups can only be asked about; a failing storage never throws", () => {
  assert.equal(KEY_TO_FIELD.arth_vendor_not_same, null);
  assert.equal(newestBackupValue(mem({}), "arth_vendor_not_same"), null);
  const boom = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); }, removeItem() { throw new Error("x"); } };
  assert.deepEqual(repairStored(boom), { restored: [], needsChoice: [] });
  const full = mem({ arth_txns: "{bad" }); full.setItem = () => { throw new Error("full"); };
  assert.equal(repairStored(full).needsChoice.length, 1);                       // cannot write: asks, does not pretend
});

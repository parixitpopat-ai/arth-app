import { test } from "node:test";
import assert from "node:assert/strict";
import { listPayableInstalments, createGroup, removeItem, liveItems, groupTotal, itemKey } from "./group.js";

const today = "2026-10-03";
const fee = (id, date, amount = 5000, status = "unpaid") => ({ sourceType: "feePeriod", sourceId: id, name: id, date, amount, status });
const events = [
  fee("f1", "2026-11-10"), fee("f2", "2026-12-10"), fee("f3", "2027-01-10"),
  fee("old", "2026-09-10"), fee("paid", "2026-11-12", 5000, "paid"),
  { sourceType: "insurancePolicy", sourceId: "i1", date: "2026-11-20", amount: 24000, status: "unpaid" },
  { sourceType: "membership", sourceId: "m1", date: "2026-11-21", amount: 9000, status: "unpaid" },
];
let n = 0; const genId = () => `g${++n}`;

test("only real, upcoming, unpaid instalments are offered (no Expected types, no overdue, no paid)", () => {
  const list = listPayableInstalments(events, [], today);
  assert.deepEqual(list.map(e => e.sourceId), ["f1", "f2", "f3"]);
});

test("creating a group needs a date and at least two instalments; due dates are not stored or changed", () => {
  const keys = ["feePeriod:f1", "feePeriod:f2", "feePeriod:f3"];
  assert.equal(createGroup({ events, keys, date: "", genId }).ok, false);
  assert.equal(createGroup({ events, keys: ["feePeriod:f1"], date: "2026-11-10", genId }).ok, false);
  const r = createGroup({ events, keys, date: "2026-11-10", genId });
  assert.equal(r.ok, true);
  assert.deepEqual(r.group.items, [{ sourceType: "feePeriod", sourceId: "f1" }, { sourceType: "feePeriod", sourceId: "f2" }, { sourceType: "feePeriod", sourceId: "f3" }]);
  assert.equal("dueDate" in r.group.items[0], false);
  assert.equal(groupTotal(r.group, events), 15000);
});

test("grouped instalments are no longer offered again; an unknown or paid key is ignored", () => {
  const g = createGroup({ events, keys: ["feePeriod:f1", "feePeriod:f2", "feePeriod:paid", "feePeriod:nope"], date: "2026-11-10", genId }).group;
  assert.equal(g.items.length, 2);
  assert.deepEqual(listPayableInstalments(events, [g], today).map(e => e.sourceId), ["f3"]);
});

test("removing an item keeps the group; removing down to one dissolves it", () => {
  const g = createGroup({ events, keys: ["feePeriod:f1", "feePeriod:f2", "feePeriod:f3"], date: "2026-11-10", genId }).group;
  const g2 = removeItem(g, "feePeriod:f3");
  assert.equal(g2.items.length, 2);
  assert.equal(removeItem(g2, "feePeriod:f2"), null);
});

test("an instalment that gets paid drops out of the group's live items and total", () => {
  const g = createGroup({ events, keys: ["feePeriod:f1", "feePeriod:f2"], date: "2026-11-10", genId }).group;
  const after = events.map(e => e.sourceId === "f1" ? { ...e, status: "paid" } : e);
  assert.deepEqual(liveItems(g, after).map(itemKey), ["feePeriod:f2"]);
  assert.equal(groupTotal(g, after), 5000);
});

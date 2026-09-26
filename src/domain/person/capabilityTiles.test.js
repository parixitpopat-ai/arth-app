import { test } from "node:test";
import assert from "node:assert/strict";
import { getPersonCapabilityTiles } from "./capabilityTiles.js";
import { PERSON_MODULES } from "../../constants/appConstants.js";

const base = { moduleDefs: PERSON_MODULES, sym: "₹", fmt: n => n.toLocaleString("en-IN") };

test("only switched-on modules, in stored order, with D-15 labels", () => {
  const tiles = getPersonCapabilityTiles({ ...base, modules: ["reminders", "budget", "sharedExpenses"] });
  assert.deepEqual(tiles.map(t => t.label), ["Shared expenses", "Monthly budget", "Reminders"]);
});

test("summaries come from figures passed in", () => {
  const tiles = getPersonCapabilityTiles({
    ...base, modules: PERSON_MODULES.map(m => m.id),
    balance: { owesMe: 1500, iOwe: 260 }, spent: 9300, spendBudget: 15000, giftCount: 2, loanOutstanding: 0,
    notes: "Prefers UPI\nSecond line", reminders: [{ text: "Birthday · 14 Nov" }],
  });
  const by = Object.fromEntries(tiles.map(t => [t.id, t.sub]));
  assert.equal(by.budget, "₹9,300 of ₹15,000");
  assert.equal(by.sharedExpenses, "Owes you ₹1,240");
  assert.equal(by.gifts, "2 gifts");
  assert.equal(by.borrowMoney, "No money lent");
  assert.equal(by.notes, "Prefers UPI");
  assert.equal(by.reminders, "Birthday · 14 Nov");
});

test("empty states never invent a figure", () => {
  const tiles = getPersonCapabilityTiles({ ...base, modules: ["budget", "sharedExpenses", "reminders", "notes"] });
  const by = Object.fromEntries(tiles.map(t => [t.id, t.sub]));
  assert.equal(by.budget, "No monthly amount set");
  assert.equal(by.sharedExpenses, "All settled");
  assert.equal(by.reminders, "No dates set");
  assert.equal(by.notes, "No notes yet");
  assert.equal(getPersonCapabilityTiles({ ...base, balance: { owesMe: 0, iOwe: 400 }, modules: ["sharedExpenses"] })[0].sub, "You owe ₹400");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { canOfferPettyPaid, chooseRowMode, choosePettyPaid } from "./rowPayer.js";

const rows = () => [
  { id: "r1", targetType: "person", targetId: "p1", mode: "owes" },
  { id: "r2", targetType: "person", targetId: "p2", mode: "spent_on" },
];

test("P is offered only for someone still holding petty cash, or who is already ticked", () => {
  assert.equal(canOfferPettyPaid(0, false), false);
  assert.equal(canOfferPettyPaid(undefined, false), false);
  assert.equal(canOfferPettyPaid(4000, false), true);
  assert.equal(canOfferPettyPaid(0, true), true);
});
test("tapping P makes them the payer and clears their pre-selected A / O / C", () => {
  const r = choosePettyPaid({ rows: rows(), rowId: "r1", paidByPersonId: "" });
  assert.equal(r.paidByPersonId, "p1");
  assert.equal(r.rows.find(x => x.id === "r1").mode, null);
  assert.equal(r.rows.find(x => x.id === "r2").mode, "spent_on");     // other rows untouched
});
test("tapping P again unticks the payer and leaves the row without a mode, so the form asks", () => {
  const first = choosePettyPaid({ rows: rows(), rowId: "r1", paidByPersonId: "" });
  const again = choosePettyPaid({ rows: first.rows, rowId: "r1", paidByPersonId: first.paidByPersonId });
  assert.equal(again.paidByPersonId, "");
  assert.equal(again.rows.find(x => x.id === "r1").mode, null);
});
test("tapping A, O or C on the payer's row sets that mode and they stop being the payer", () => {
  const p = choosePettyPaid({ rows: rows(), rowId: "r1", paidByPersonId: "" });
  const r = chooseRowMode({ rows: p.rows, rowId: "r1", mode: "i_owe", paidByPersonId: p.paidByPersonId });
  assert.equal(r.paidByPersonId, "");
  assert.equal(r.rows.find(x => x.id === "r1").mode, "i_owe");
});
test("tapping A, O or C on someone else's row leaves the payer as it was", () => {
  const p = choosePettyPaid({ rows: rows(), rowId: "r1", paidByPersonId: "" });
  const r = chooseRowMode({ rows: p.rows, rowId: "r2", mode: "owes", paidByPersonId: p.paidByPersonId });
  assert.equal(r.paidByPersonId, "p1");
  assert.equal(r.rows.find(x => x.id === "r2").mode, "owes");
});
test("a group row is never made the payer", () => {
  const g = [{ id: "g1", targetType: "group", targetId: "grp", mode: "owes" }];
  const r = choosePettyPaid({ rows: g, rowId: "g1", paidByPersonId: "" });
  assert.equal(r.paidByPersonId, ""); assert.equal(r.rows[0].mode, "owes");
});

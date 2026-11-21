import { test } from "node:test";
import assert from "node:assert/strict";
import { billMonthTitle, meterNicknamer } from "./billMonthTitle.js";

const today = new Date("2026-11-21");
test("a bill is named for the month it was generated in, not the month it falls due", () => {
  assert.equal(billMonthTitle({ name: "Water", billDate: "2026-07-27", dueDate: "2026-08-02" }, { today }), "July Water Bill");
});
test("the generation date is billDate, then createdDate, then dueDate", () => {
  assert.equal(billMonthTitle({ name: "Water", createdDate: "2026-03-05", dueDate: "2026-04-01" }, { today }), "March Water Bill");
  assert.equal(billMonthTitle({ name: "Water", dueDate: "2026-04-01" }, { today }), "April Water Bill");
});
test("a name that already says what it is keeps its own wording", () => {
  assert.equal(billMonthTitle({ name: "Electricity bill", billDate: "2026-10-14" }, { today }), "October Electricity bill");
  assert.equal(billMonthTitle({ name: "Rent", billDate: "2026-10-01" }, { today }), "October Rent");
  assert.equal(billMonthTitle({ name: "Test Card Statement", billDate: "2026-10-15" }, { today }), "October Test Card Statement");
});
test("a name that already names a month is left alone", () => {
  assert.equal(billMonthTitle({ name: "July Water Bill", billDate: "2026-07-27" }, { today }), "July Water Bill");
  assert.equal(billMonthTitle({ name: "Water bill Jul", billDate: "2026-07-27" }, { today }), "Water bill Jul");
});
test("the year is shown only when the bill is not from this year", () => {
  assert.equal(billMonthTitle({ name: "Water", billDate: "2025-07-27" }, { today }), "July 2025 Water Bill");
});
test("no usable date, or no name, gives a plain name and never fails", () => {
  assert.equal(billMonthTitle({ name: "Water" }, { today }), "Water");
  assert.equal(billMonthTitle({ billDate: "2026-07-27" }, { today }), "July Bill");
  assert.equal(billMonthTitle(undefined, { today }), "Bill");
});

const meters = [
  { id: "a1", billerId: "water", name: "Office", provider: "City Water", consumerNo: "WT-77120045" },
  { id: "a2", billerId: "water", name: "House", provider: "City Water", consumerNo: "WT-55610321" },
  { id: "a3", billerId: "elec", name: "Home meter", provider: "Test Power", consumerNo: "9001" },
  { id: "a4", billerId: "water", name: "City Water", provider: "City Water", consumerNo: "WT-99871234" },
];
test("with several meters under one biller the meter's nickname is added; one meter stays plain", () => {
  const nick = meterNicknamer(meters);
  assert.equal(nick({ billerAccountId: "a1" }), "Office");
  assert.equal(nick({ billerAccountId: "a2" }), "House");
  assert.equal(nick({ billerAccountId: "a3" }), "");                      // the only electricity meter
  assert.equal(nick({ billerAccountId: "zz" }), ""); assert.equal(nick({}), "");
  assert.equal(billMonthTitle({ name: "Water", billDate: "2026-07-27" }, { today, nickname: nick({ billerAccountId: "a1" }) }), "July Water Bill (Office)");
});
test("a meter whose nickname only repeats the provider shows the last four digits of its number instead", () => {
  assert.equal(meterNicknamer(meters)({ billerAccountId: "a4" }), "…1234");
});
test("the nickname is not added when the bill name already has it", () => {
  assert.equal(billMonthTitle({ name: "Office Water", billDate: "2026-07-27" }, { today, nickname: "Office" }), "July Office Water Bill");
});

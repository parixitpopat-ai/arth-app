import test from "node:test";
import assert from "node:assert/strict";
import { pastedTextToRows } from "./pastedText.js";
import { parseStatementRows } from "./statement.js";

const T = `Here are your transactions:

1. Amount: -₹222.14
Date: 10 November 2026
Description: UPI-x -y -z -ZOMATO L

2. Amount: -₹1,450.00
Date: 9 November 2026
Description: AMAZON PAY
INDIA

3. Amount: ₹500.00
Date: 08 Nov 2026
Description: PAYMENT RECEIVED
`;
test("pasted card text: negative = charge, positive = credit", () => {
  const r = pastedTextToRows(T);
  assert.equal(r.ok, true); assert.equal(r.rows.length, 4); assert.equal(r.unreadable.length, 0);
  const p = parseStatementRows(r.rows, { kind: "card" });
  assert.equal(p.ok, true); assert.equal(p.rows.length, 3);
  const by = d => p.rows.find(x => x.desc.includes(d));
  assert.equal(by("ZOMATO").amountPaise, -22214); assert.equal(by("ZOMATO").date, "2026-11-10");
  assert.equal(by("AMAZON PAY INDIA").amountPaise, -145000);
  assert.equal(by("PAYMENT").amountPaise, 50000);
});
test("pasted card text: unreadable items are reported, empty text is refused", () => {
  const r = pastedTextToRows("1. Amount: abc\nDate: 1 Nov 2026\nDescription: X\n2. Amount: -₹5\nDate: 2 Nov 2026\nDescription: Y");
  assert.equal(r.rows.length, 2); assert.equal(r.unreadable.length, 1);
  assert.equal(pastedTextToRows("hello").ok, false);
});

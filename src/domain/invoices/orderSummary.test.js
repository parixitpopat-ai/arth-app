import test from "node:test";
import assert from "node:assert/strict";
import { toPaise, parseOrderSummaryLines, checkEquations, suggestCorrection, evaluateManualEntry, matchSummaryToOrder, chooseOrder, rematch, newSummary, acknowledge, editFigure,
  reconcileSummaryWithOrder, attachmentConflicts, orderGate, FIGURE_KEYS } from "./orderSummary.js";

// Figures from the owner's own order summary (amounts only). Everything else here is invented.
const GOOD = { subtotal: 32900, shipping: 5000, fee: 135, total: 38035, discount: 1733, grandTotal: 36302 };
const ORDER_A = "123-4567890-1234567", ORDER_B = "999-0000000-0000000";
const order = (n, extra = {}) => ({ orderNumber: n, itemsPaise: 32900, chargesPaise: 135, fees: { count: 1, totalPaise: 135, sources: [] }, otherCharges: [], ...extra });
const ORDERS = [order(ORDER_A), order(ORDER_B)];

// ---------- arithmetic ----------
test("toPaise reads plain amounts exactly and rejects everything else", () => {
  assert.equal(toPaise("329.00"), 32900); assert.equal(toPaise("₹1,234.50"), 123450); assert.equal(toPaise("1.35"), 135); assert.equal(toPaise("1,23,456.50"), 12345650); assert.equal(toPaise("1,234,567"), 123456700); assert.equal(toPaise("17.3"), 1730); assert.equal(toPaise("-17.33"), 1733);
  for (const bad of ["", "abc", "1.234", "12,34", "3380,35", "1e3", null]) assert.equal(toPaise(bad), null, String(bad));
});
test("E1 and E2 hold for the real figures, to the paisa", () => {
  const e = checkEquations(GOOD);
  assert.equal(e.allHold, true); assert.equal(e.e1.expectedPaise, 38035); assert.equal(e.e2.expectedPaise, 36302);
});
test("a figure one paisa out fails the equation it belongs to, and nothing is changed", () => {
  const f = { ...GOOD, total: 38036 }, before = JSON.stringify(f);
  const e = checkEquations(f);
  assert.deepEqual(e.failing, ["e1", "e2"]); assert.equal(e.e1.differencePaise, 1); assert.equal(JSON.stringify(f), before);
});
test("a missing figure makes the equation incomplete, never a pass", () => {
  assert.equal(checkEquations({ ...GOOD, discount: null }).e2.status, "incomplete");
  assert.equal(checkEquations({ ...GOOD, discount: null }).allHold, false);
  assert.equal(checkEquations(Object.fromEntries(FIGURE_KEYS.map(k => [k, null]))).allHold, false);
});

// ---------- parsing ----------
test("labelled lines (clean) parse; the order number and date are read", () => {
  const r = parseOrderSummaryLines(["Order placed 25 October 2026   Order number 405-7168847-0805165", "Item(s) Subtotal: ₹329.00", "Shipping: ₹50.00", "Offer Processing Fee: ₹1.35", "Total: ₹380.35", "Instant Bank Discount: -₹17.33", "Grand Total: ₹363.02"]);
  assert.deepEqual(r.figures, GOOD); assert.equal(r.orderNumber, "405-7168847-0805165"); assert.equal(r.orderDate, "2026-10-25"); assert.deepEqual(r.unrecognised, []);
});
test("'Grand Total' is not mistaken for 'Total', and merged columns on one line still parse", () => {
  const r = parseOrderSummaryLines(["Test Buyer Item(s) Subtotal: 329.00", "Grand Total: 363.02", "Total: 380.35"]);
  assert.equal(r.figures.subtotal, 32900); assert.equal(r.figures.grandTotal, 36302); assert.equal(r.figures.total, 38035);
});
test("PRIVACY: a name, address, card line or unknown label is never returned; an unknown row yields only its amount", () => {
  const r = parseOrderSummaryLines(["Test Buyer", "99 Sample Lane", "Testville 400001", "Amazon Pay Sample Bank Credit Card ending in 4242", "Ship to: Test Buyer", "Coupon Applied: ₹5.00", "Item(s) Subtotal: ₹329.00"]);
  const dump = JSON.stringify(r);
  for (const s of ["Test Buyer", "Sample Lane", "Testville", "4242", "Coupon", "Credit Card"]) assert.ok(!dump.includes(s), s);
  assert.deepEqual(r.unrecognised, [{ amountPaise: 500 }]);
});
test("a label seen twice with different amounts is reported as a conflict, and the first value is kept", () => {
  const r = parseOrderSummaryLines(["Shipping: 50.00", "Shipping: 60.00"]);
  assert.deepEqual(r.conflictingFigures, ["shipping"]); assert.equal(r.figures.shipping, 5000);
});

// ---------- incorrect figures: misreads as measured on the real screenshot ----------
test("the rupee sign read as a digit (3380.35 for 380.35) fails BOTH equations and suggests exactly one fix, which is never applied", () => {
  const f = { ...GOOD, total: 338035 / 10 * 10 };
  const bad = { ...GOOD, total: 338035 };
  assert.deepEqual(checkEquations(bad).failing, ["e1", "e2"]);
  assert.deepEqual(suggestCorrection(bad), { figure: "total", valuePaise: 38035, kind: "misread" });
  assert.equal(bad.total, 338035); assert.ok(f);
});
test("a missing discount is suggested as the exact difference, once", () => {
  const f = { ...GOOD, discount: null };
  assert.deepEqual(suggestCorrection(f), { figure: "discount", valuePaise: 1733, kind: "missing" });
});
test("when several single changes would fix it, nothing is suggested (E1 alone fails: subtotal, shipping or fee could be wrong)", () => {
  assert.equal(suggestCorrection({ ...GOOD, subtotal: 32000 }), null);
  assert.equal(suggestCorrection({ ...GOOD, fee: 100 }), null);
});
test("two wrong figures, or two missing figures, give no suggestion", () => {
  assert.equal(suggestCorrection({ ...GOOD, total: 338035, grandTotal: 12345 }), null);
  assert.equal(suggestCorrection({ ...GOOD, discount: null, shipping: null }), null);
});
test("nothing is suggested when the figures already hold", () => { assert.equal(suggestCorrection(GOOD), null); });
test("a suggestion that would be negative is refused", () => { assert.equal(suggestCorrection({ subtotal: 100000, shipping: 0, fee: 0, total: 100000, discount: null, grandTotal: 500000 }), null); });

// ---------- manual entry ----------
test("manual entry: the real figures give Total 380.35 and hold", () => {
  const r = evaluateManualEntry({ subtotal: "329.00", shipping: "50.00", fee: "1.35", discount: "17.33", grandTotal: "363.02" });
  assert.equal(r.figures.total, 38035); assert.equal(r.ready, true); assert.deepEqual(r.errors, {});
});
test("manual entry: a wrong Grand Total is refused with the arithmetic, and nothing is corrected for the person", () => {
  const r = evaluateManualEntry({ subtotal: "329.00", shipping: "50.00", fee: "1.35", discount: "17.33", grandTotal: "360.02" });
  assert.equal(r.ready, false); assert.equal(r.equations.e2.status, "fails"); assert.equal(r.equations.e2.expectedPaise, 36302); assert.equal(r.figures.grandTotal, 36002);
});
test("manual entry: Total cannot be typed or overridden (a 'total' key is ignored); blank shipping, fee and discount are 0; subtotal and Grand Total are required", () => {
  const r = evaluateManualEntry({ subtotal: "100", grandTotal: "100", total: "5", shipping: "", fee: "", discount: "" });
  assert.equal(r.figures.total, 10000); assert.equal(r.ready, true);
  const miss = evaluateManualEntry({ subtotal: "", grandTotal: "" });
  assert.deepEqual(Object.keys(miss.errors).sort(), ["grandTotal", "subtotal"]); assert.equal(miss.ready, false);
});
test("manual entry: text that is not an amount is an error on that field", () => {
  const r = evaluateManualEntry({ subtotal: "abc", shipping: "5,0", grandTotal: "10" });
  assert.ok(r.errors.subtotal && r.errors.shipping); assert.equal(r.ready, false);
});
test("manual entry: a discount larger than the total is refused by E2 (no negative Grand Total)", () => {
  const r = evaluateManualEntry({ subtotal: "10", discount: "50", grandTotal: "0" });
  assert.equal(r.ready, false);
});

// ---------- order matching ----------
test("an exact order number attaches by itself", () => {
  assert.deepEqual(matchSummaryToOrder({ orderNumber: ORDER_A, orders: ORDERS }), { state: "matched", how: "exact", orderNumber: ORDER_A, blocks: false });
});
test("no orders read: the summary is unattached and blocks", () => {
  assert.deepEqual(matchSummaryToOrder({ orderNumber: ORDER_A, orders: [] }), { state: "unattached", reason: "no-orders-read", blocks: true });
});
test("no number, a malformed number, or a number nobody has: the person must choose; nothing attaches", () => {
  for (const [n, reason] of [[null, "no-number"], ["12-345", "bad-format"], ["555-5555555-5555555", "no-exact-match"]]) {
    const m = matchSummaryToOrder({ orderNumber: n, orders: ORDERS });
    assert.equal(m.state, "choose"); assert.equal(m.reason, reason); assert.equal(m.blocks, true);
  }
});
test("a number one digit off is a HINT only and is never attached automatically", () => {
  const m = matchSummaryToOrder({ orderNumber: "123-4567890-1234568", orders: ORDERS });
  assert.equal(m.state, "choose"); assert.deepEqual(m.hints, [ORDER_A]); assert.equal(m.blocks, true);
  const two = matchSummaryToOrder({ orderNumber: "123-4567890-1234560", orders: [...ORDERS, order("123-4567890-1234561")] });
  assert.equal(two.hints.length, 2);
});
test("two entries with the same number are not an exact single match: the person chooses", () => {
  assert.equal(matchSummaryToOrder({ orderNumber: ORDER_A, orders: [order(ORDER_A), order(ORDER_A)] }).state, "choose");
});
test("manual selection attaches; 'not sure' leaves it unattached and blocking; an unknown choice changes nothing", () => {
  const m = matchSummaryToOrder({ orderNumber: null, orders: ORDERS });
  assert.deepEqual(chooseOrder(m, ORDER_B, ORDERS), { state: "chosen", how: "chosen-by-you", orderNumber: ORDER_B, blocks: false });
  assert.deepEqual(chooseOrder(m, null, ORDERS), { state: "unattached", reason: "not-sure", blocks: true });
  assert.equal(chooseOrder(m, "000-0000000-0000000", ORDERS), m);
});
test("more invoices later: a summary waiting for an order can now match exactly; a choice and 'not sure' are kept", () => {
  const waiting = matchSummaryToOrder({ orderNumber: ORDER_A, orders: [order(ORDER_B)] });
  assert.equal(waiting.state, "choose");
  assert.equal(rematch(waiting, ORDER_A, ORDERS).state, "matched");
  const chosen = chooseOrder(waiting, ORDER_B, [order(ORDER_B)]);
  assert.equal(rematch(chosen, ORDER_A, ORDERS), chosen);
  const notSure = chooseOrder(waiting, null, [order(ORDER_B)]);
  assert.equal(rematch(notSure, ORDER_A, ORDERS), notSure);
  const gone = rematch(chosen, null, [order(ORDER_A)]);
  assert.notEqual(gone.state, "chosen");
});
test("two summaries attached to one order are a conflict", () => {
  const a = { ...newSummary({ source: "typed", figures: GOOD, orders: ORDERS, orderNumber: ORDER_A }) }, b = { ...newSummary({ source: "typed", figures: GOOD, orders: ORDERS, orderNumber: ORDER_A }) };
  assert.deepEqual(attachmentConflicts([a, b]), [{ orderNumber: ORDER_A, ids: [a.id, b.id] }]);
  assert.deepEqual(attachmentConflicts([a]), []);
});

// ---------- acknowledgement ----------
test("acknowledgement is refused while an equation fails, while a row is unrecognised, and is withdrawn by any edit", () => {
  const bad = newSummary({ source: "read-from-picture", figures: { ...GOOD, total: 338035 }, orders: ORDERS });
  assert.deepEqual([acknowledge(bad).ok, acknowledge(bad).reason], [false, "equations-fail"]);
  const odd = newSummary({ source: "read-from-picture", figures: GOOD, unrecognised: [{ amountPaise: 500 }], orders: ORDERS });
  assert.deepEqual([acknowledge(odd).ok, acknowledge(odd).reason], [false, "unrecognised-row"]);
  const ok = acknowledge(newSummary({ source: "typed", figures: GOOD, orders: ORDERS })).summary;
  assert.equal(ok.acknowledged, true);
  assert.equal(editFigure(ok, "shipping", "60.00").acknowledged, false);
  assert.equal(editFigure(ok, "shipping", "abc"), ok);
});
test("an incomplete figure set cannot be acknowledged", () => {
  const s = newSummary({ source: "typed", figures: { ...GOOD, discount: null }, orders: ORDERS });
  assert.deepEqual([acknowledge(s).ok, acknowledge(s).reason], [false, "incomplete"]);
});

// ---------- reconciliation with the invoices ----------
test("items and fees that agree with the invoices match; shipping and discount are summary-only", () => {
  const r = reconcileSummaryWithOrder(GOOD, order(ORDER_A));
  assert.deepEqual(r.components.map(c => [c.name, c.state]), [["Items", "matches"], ["Fees", "matches"], ["Shipping", "summary-only"], ["Discount", "summary-only"]]);
  assert.equal(r.hasInvoiceMismatch, false); assert.equal(r.orderTotalPaise, 36302);
});
test("invoices that exceed the summary, or fall short of it, are exact differences", () => {
  const exceed = reconcileSummaryWithOrder(GOOD, order(ORDER_A, { itemsPaise: 35900 }));
  assert.deepEqual([exceed.components[0].state, exceed.components[0].differencePaise, exceed.hasInvoiceMismatch], ["invoices-exceed", 3000, true]);
  const short = reconcileSummaryWithOrder(GOOD, order(ORDER_A, { itemsPaise: 10000 }));
  assert.deepEqual([short.components[0].state, short.components[0].differencePaise], ["missing-coverage", -22900]);
});
test("fees: invoices with no fee invoice against a summary fee is missing coverage; against a zero fee it matches", () => {
  const none = { ...order(ORDER_A), fees: { count: 0, totalPaise: 0, sources: [] } };
  assert.equal(reconcileSummaryWithOrder(GOOD, none).components[1].state, "missing-coverage");
  assert.equal(reconcileSummaryWithOrder({ ...GOOD, fee: 0, total: 37900, grandTotal: 36167 }, none).components[1].state, "matches");
});
test("shipping is compared only when the invoices carry a delivery line", () => {
  const withShip = order(ORDER_A, { otherCharges: [{ chargeType: "delivery", totalPaise: 5000 }] });
  assert.equal(reconcileSummaryWithOrder(GOOD, withShip).components[2].state, "matches");
  const other = order(ORDER_A, { otherCharges: [{ chargeType: "delivery", totalPaise: 4000 }] });
  assert.equal(reconcileSummaryWithOrder(GOOD, other).components[2].state, "missing-coverage");
});

// ---------- attempts to bypass the gates ----------
const gateCases = () => {
  const out = [];
  for (const acknowledged of [false, true]) for (const discount of [0, 1733]) for (const emiPaid of [false, true]) for (const matchKind of ["matched", "choose", "unattached"]) for (const itemsPaise of [32900, 35900]) {
    const figures = discount ? GOOD : { subtotal: 32900, shipping: 5000, fee: 135, total: 38035, discount: 0, grandTotal: 38035 };
    const s = { ...newSummary({ source: "typed", figures, orders: ORDERS, orderNumber: matchKind === "matched" ? ORDER_A : null }), acknowledged };
    if (matchKind === "unattached") s.match = { state: "unattached", reason: "not-sure", blocks: true };
    out.push({ acknowledged, discount, emiPaid, matchKind, itemsPaise, gate: orderGate({ summary: s, order: order(ORDER_A, { itemsPaise }), emiPaid }) });
  }
  return out;
};
test("BYPASS: no combination of acknowledgement, match, discount, EMI or invoice mismatch ever makes an Amazon order confirmable", () => {
  const all = gateCases(); assert.equal(all.length, 48);
  for (const c of all) { assert.equal(c.gate.confirmable, false); assert.equal(c.gate.blocked, true); assert.ok(c.gate.reasons.includes("amazon-confirm-not-available")); }
});
test("BYPASS: acknowledging never changes the reconciliation result and never removes an invoice mismatch", () => {
  const f = GOOD, o = order(ORDER_A, { itemsPaise: 35900 });
  const mk = acknowledged => ({ ...newSummary({ source: "typed", figures: f, orders: ORDERS, orderNumber: ORDER_A }), acknowledged });
  const a = orderGate({ summary: mk(false), order: o }), b = orderGate({ summary: mk(true), order: o });
  assert.deepEqual(a.reconciliation, b.reconciliation);
  assert.ok(a.reasons.includes("invoice-mismatch") && b.reasons.includes("invoice-mismatch"));
  assert.ok(a.reasons.includes("figures-not-acknowledged") && !b.reasons.includes("figures-not-acknowledged"));
});
test("BYPASS: a discount or an EMI payment always adds its reason, whatever else is true", () => {
  for (const c of gateCases()) {
    assert.equal(c.gate.reasons.includes("discount-present"), c.discount > 0);
    assert.equal(c.gate.reasons.includes("emi-paid"), c.emiPaid);
  }
});
test("BYPASS: an unattached or unchosen summary is blocked for attachment and gets no comparison", () => {
  for (const c of gateCases().filter(c => c.matchKind !== "matched")) { assert.ok(c.gate.reasons.includes("summary-not-attached")); assert.equal(c.gate.reconciliation, null); }
});
test("BYPASS: failing equations always show 'equations-fail', and a missing summary is 'summary-not-attached'", () => {
  const bad = { ...newSummary({ source: "typed", figures: { ...GOOD, total: 338035 }, orders: ORDERS, orderNumber: ORDER_A }), acknowledged: true };
  assert.ok(orderGate({ summary: bad, order: order(ORDER_A) }).reasons.includes("equations-fail"));
  assert.ok(orderGate({ summary: null, order: order(ORDER_A) }).reasons.includes("summary-not-attached"));
});
test("BYPASS: two summaries on one order add 'duplicate-summary' to each", () => {
  const a = newSummary({ source: "typed", figures: GOOD, orders: ORDERS, orderNumber: ORDER_A }), b = newSummary({ source: "typed", figures: GOOD, orders: ORDERS, orderNumber: ORDER_A });
  const conflicts = attachmentConflicts([a, b]);
  for (const s of [a, b]) assert.ok(orderGate({ summary: s, order: order(ORDER_A), conflicts }).reasons.includes("duplicate-summary"));
});
test("the gate and the reconciliation do not mutate their inputs", () => {
  const s = Object.freeze({ ...newSummary({ source: "typed", figures: Object.freeze({ ...GOOD }), orders: ORDERS, orderNumber: ORDER_A }), match: Object.freeze({ state: "matched", how: "exact", orderNumber: ORDER_A, blocks: false }) });
  const o = Object.freeze(order(ORDER_A));
  assert.doesNotThrow(() => orderGate({ summary: s, order: o }));
});

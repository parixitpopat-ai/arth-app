// Phase 2 plan: critical rules. Synthetic/redacted data only.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BLINKIT_FIXTURE_3_ITEMS as ITEMS } from "./fixtures/blinkitGstInvoiceItems.fixture.js";
import { analysePage } from "./blinkitPdf.js";
import { buildInvoicePreviews } from "./invoicePreview.js";
import { planConfirm, planUndo, buildLineItems } from "./invoiceImport.js";
import { reconcileLines } from "../transactions/itemLineMath.js";

const here = dirname(fileURLToPath(import.meta.url));
const page = items => ({ number: 1, items, textChars: 9999, imageOps: 0 });
const previewOf = items => buildInvoicePreviews({ status: "supported", fileHash: "h", pages: [analysePage(page(items))] }).invoices[0];
const base = () => ITEMS.map(i => ({ ...i }));
let n = 0; const genId = () => `id${++n}`;
const ACCS = [{ id: "b1", name: "Test Bank", type: "bank" }, { id: "c1", name: "Test Card", type: "cc" }];
const ctx = (o = {}) => ({ accounts: ACCS, txns: [], records: [], genId, now: 1760000000000, today: "2026-10-23", ...o });
const good = () => { const p = previewOf(base()); return { view: p.view, status: p.status, mode: "create", accountId: "b1", paymentDate: "2026-01-15", orderCatId: "groceries", fileHash: "h" }; };
const lineSum = lines => lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);

test("create: one itemised expense of the invoice total on the chosen account, lines add up to the total by the app's own rule", () => {
  const r = planConfirm(good(), ctx());
  assert.equal(r.ok, true);
  const t = r.create;
  assert.deepEqual([t.type, t.amount, t.date, t.accId, t.merchant, t.catId, t.excludeFromSpend], ["expense", 1125, "2026-01-15", "b1", "Blinkit", "groceries", false]);
  assert.equal(t.lineItems.length, 4);                                     // 3 items + one handling charge
  assert.equal(reconcileLines(t.lineItems.map(l => l.qty * l.unitPrice), t.amount).matches, true);
  assert.equal(Math.round(lineSum(t.lineItems) * 100), 112500);
  assert.deepEqual(t.lineItems.map(l => l.label).slice(-1), ["Handling charge"]);
  assert.equal(t.lineItems[2].qty, 2); assert.equal(t.lineItems[2].unitPrice, 466); assert.equal(t.lineItems[2].amount, 932);
  assert.ok(t.lineItems.every(l => l.amount >= 0 && l.catId === "groceries"), "no negative line; order category on every line");
  assert.equal(t.note, "Blinkit invoice C00000T000000001");
});

test("the invoice record keeps only the key, identifiers, total and the expense it points to: no customer data, no PDF", () => {
  const r = planConfirm(good(), ctx());
  assert.deepEqual(Object.keys(r.record).sort(), ["fileHash", "id", "importedAt", "importedAtDate", "invoiceDate", "invoiceNumber", "key", "lines", "mode", "orderId", "parserVersion", "sellerGstin", "totalPaise", "txnId"]);
  assert.deepEqual([r.record.key, r.record.mode, r.record.totalPaise, r.record.txnId], ["blinkit|30AAFCG9846E1ZO|C00000T000000001", "created", 112500, r.create.id]);
});

test("a credit-card purchase is an ordinary expense on the card account (the later card bill payment is not an expense)", () => {
  const r = planConfirm({ ...good(), accountId: "c1" }, ctx());
  assert.equal(r.create.accId, "c1"); assert.equal(r.create.type, "expense");
});

test("the account is always the user's choice: none or unknown is refused", () => {
  assert.equal(planConfirm({ ...good(), accountId: "" }, ctx()).errors[0].code, "no-account");
  assert.equal(planConfirm({ ...good(), accountId: "zzz" }, ctx()).errors[0].code, "no-account");
});

test("nothing is added for an invoice that needs review or does not add up", () => {
  const bad = previewOf(base().map(i => (i.str === "932.00" ? { ...i, str: "902.00" } : i)));
  const r = planConfirm({ view: bad.view, status: bad.status, mode: "create", accountId: "b1", paymentDate: "2026-01-15", orderCatId: "groceries" }, ctx());
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.code === "not-supported") && r.errors.some(e => e.code === "does-not-add-up"));
  assert.equal(r.create, undefined);
});

test("date: invalid or future payment dates are refused", () => {
  assert.equal(planConfirm({ ...good(), paymentDate: "2030-01-01" }, ctx()).errors[0].code, "bad-date");
  assert.equal(planConfirm({ ...good(), paymentDate: "2026-02-31" }, ctx()).errors[0].code, "bad-date");
});

test("duplicate: the same invoice cannot be added twice; a record whose expense was deleted is re-added only on purpose", () => {
  const first = planConfirm(good(), ctx());
  const withTxn = ctx({ records: [first.record], txns: [first.create] });
  assert.equal(planConfirm(good(), withTxn).errors[0].code, "already-imported");
  const orphan = ctx({ records: [first.record], txns: [] });
  assert.equal(planConfirm(good(), orphan).errors[0].code, "orphan");
  assert.equal(planConfirm(good(), { ...orphan, importAgain: true }).ok, true);
  assert.equal(planConfirm({ ...good(), mode: "create" }, { ...withTxn, importAgain: true }).errors[0].code, "already-imported");   // 'again' never overrides a live expense
});

test("missing invoice key: refused unless the person explicitly acknowledges that duplicates cannot be checked", () => {
  const noKey = previewOf(base().filter(i => i.str !== "C00000T000000001"));
  const input = { view: noKey.view, status: "supported", mode: "create", accountId: "b1", paymentDate: "2026-01-15", orderCatId: "groceries" };
  assert.equal(planConfirm(input, ctx()).errors[0].code, "no-key");
  assert.equal(planConfirm(input, ctx({ acknowledgeNoKey: true })).ok, true);
});

test("link: items are added to ONE same-amount expense that has none; only the items change", () => {
  const target = { id: "t9", type: "expense", amount: 1125, date: "2026-01-16", accId: "c1", merchant: "Blinkit" };
  const r = planConfirm({ ...good(), mode: "link", linkTxnId: "t9" }, ctx({ txns: [target] }));
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.patch).sort(), ["lineItems", "previousLineItems", "txnId"]);          // no amount, date or account in the patch
  assert.equal(r.create, undefined);
  assert.equal(r.record.mode, "linked");
  assert.equal(r.patch.lineItems.length, 4);
});

test("link is refused when the expense already has items, has a different amount, or is not an expense", () => {
  const mk = o => planConfirm({ ...good(), mode: "link", linkTxnId: "t9" }, ctx({ txns: [{ id: "t9", type: "expense", amount: 1125, date: "2026-01-16", accId: "c1", ...o }] }));
  assert.equal(mk({ lineItems: [{ id: "a", label: "x", qty: 1, unitPrice: 1125 }] }).errors[0].code, "link-has-items");
  assert.equal(mk({ amount: 1135 }).errors[0].code, "link-amount");
  assert.equal(mk({ type: "income" }).errors[0].code, "link-missing");
  assert.equal(planConfirm({ ...good(), mode: "link", linkTxnId: "nope" }, ctx()).errors[0].code, "link-missing");
});

test("a total that cannot be split into whole-paise units stays ONE line so the sum is exact", () => {
  const view = { items: [{ srNo: 1, name: "Odd item", qty: 3, lineTotal: 100 }], handling: null };
  const lines = buildLineItems(view, { orderCatId: null, genId });
  assert.equal(lines.length, 1); assert.deepEqual([lines[0].qty, lines[0].unitPrice, lines[0].amount], [1, 100, 100]); assert.match(lines[0].label, /×3/);
});

test("delivery rows that were NOT verified as one charge are kept as printed lines, and the total still adds up", () => {
  const items = base().map(i => (i.str === "12.381" ? { ...i, str: "9.000" } : i.str === "0.310" ? { ...i, str: "0.225" } : i));
  const p = previewOf(items);
  const lines = buildLineItems(p.view, { orderCatId: "groceries", genId });
  assert.equal(lines.length, 6);                                           // 3 items + 3 printed delivery rows
  assert.equal(Math.round(lineSum(lines) * 100), 112500);
});

test("per-line category overrides apply; lines left uncategorised are allowed and the order category still comes from the rest", () => {
  const p = previewOf(base());
  const r = planConfirm({ ...good(), orderCatId: "groceries", lineCats: { 1: null, 2: "food" } }, ctx());
  assert.equal(r.create.lineItems[0].catId, null); assert.equal(r.create.lineItems[1].catId, "food"); assert.equal(r.create.lineItems[2].catId, "groceries");
  assert.equal(r.create.catId, "groceries");
  assert.equal(p.status, "supported");
});

test("undo: allowed only while the expense is exactly as the import left it (extra fields added by the boundary are fine)", () => {
  const r = planConfirm(good(), ctx());
  const stored = { ...r.create, boundaryField: true };
  assert.equal(planUndo(r.record, r, [stored]).ok, true);
  assert.equal(planUndo(r.record, r, [{ ...stored, amount: 999 }]).ok, false);
  assert.equal(planUndo(r.record, r, [{ ...stored, lineItems: [] }]).ok, false);
  assert.equal(planUndo(r.record, r, []).ok, false);
  // anything added to the expense since (people / groups / allocations / a note / a settlement) is not thrown away silently
  for (const extra of [{ people: { p1: { amount: 10 } } }, { allocations: [{ targetId: "g1", amount: 10 }] }, { groupAllocations: [{ groupId: "g1", amount: 5 }] }, { groupId: "g1" }, { forPerson: "p1" }, { note: "edited" }, { settlementLinks: [{ id: "s" }] }])
    assert.equal(planUndo(r.record, r, [{ ...stored, ...extra }]).ok, false, JSON.stringify(extra));
  assert.equal(planUndo(r.record, r, [{ ...stored, people: {}, allocations: [], groupAllocations: null, groupId: null, forPerson: "" }]).ok, true);
  const target = { id: "t9", type: "expense", amount: 1125, date: "2026-01-16", accId: "c1" };
  const l = planConfirm({ ...good(), mode: "link", linkTxnId: "t9" }, ctx({ txns: [target] }));
  assert.equal(planUndo(l.record, l, [{ ...target, lineItems: l.patch.lineItems }]).ok, true);
  assert.equal(planUndo(l.record, l, [{ ...target, lineItems: l.patch.lineItems, amount: 5 }]).ok, false);
  assert.equal(planUndo(l.record, l, [{ ...target, lineItems: l.patch.lineItems, allocations: [{ targetId: "p1", amount: 5, items: [{ sourceItemId: "x", qty: 1 }] }] }]).ok, false);
});

test("the plan module cannot write anywhere: no storage, no state setters, no network", () => {
  const src = readFileSync(join(here, "invoiceImport.js"), "utf8");
  assert.doesNotMatch(src, /localStorage|setTxns|fetch\s*\(|XMLHttpRequest|createTransactionThroughBoundary/);
});

test("lines that do not add up to the invoice total are refused (never forced to match)", () => {
  const g = good(); g.view = { ...g.view, totals: { ...g.view.totals, invoiceTotal: g.view.totals.invoiceTotal + 1 } };
  const r = planConfirm(g, ctx());
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.code === "lines-dont-add-up"));
  assert.equal(r.create, undefined);
});

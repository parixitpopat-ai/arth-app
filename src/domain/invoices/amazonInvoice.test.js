import test from "node:test";
import assert from "node:assert/strict";
import { looksLikeAmazonInvoice, parseAmazonInvoicePage, amazonKeys, groupAmazonOrders } from "./amazonInvoice.js";

import { BUYER, ADDR, CITY, PHONE, TXN, T, productPage, feePage } from "./fixtures/amazonInvoice.fixture.js";

test("recognises an Amazon.in invoice page and nothing else", () => {
  assert.equal(looksLikeAmazonInvoice(productPage()), true);
  assert.equal(looksLikeAmazonInvoice([T("Tax Invoice", 1, 1), T("Blinkit", 1, 2)]), false);
  assert.equal(parseAmazonInvoicePage([T("hello", 1, 1)]).ok, false);
});

test("seller invoice: one item, tax and totals read and cross-checked", () => {
  const p = parseAmazonInvoicePage(productPage());
  assert.equal(p.ok, true); assert.equal(p.status, "supported"); assert.deepEqual(p.findings, []);
  assert.equal(p.orderNumber, "123-4567890-1234567"); assert.equal(p.invoiceNumber, "SMP-1001"); assert.equal(p.invoiceDate, "2026-10-25");
  assert.equal(p.seller.name, "Sample Traders"); assert.equal(p.seller.gstin, "29ABCDE1234F1Z5");
  assert.equal(p.rows.length, 1);
  const r = p.rows[0];
  assert.deepEqual([r.kind, r.qty, r.unitPaise, r.netPaise, r.ratePct, r.taxPaise, r.totalPaise, r.asin, r.hsn], ["item", 1, 82119, 82119, 18, 14781, 96900, "B0AAAA1111", "8507"]);
  assert.equal(r.label, "Sample ECR 11 MC Fast Charger + 4X AA 1000mAh Batteries");
  assert.deepEqual(p.declared, { taxPaise: 14781, totalPaise: 96900 }); assert.equal(p.totalPaise, 96900);
});

test("Amazon's own 'Offer Processing Fees' invoice is a charge, GST included", () => {
  const p = parseAmazonInvoicePage(feePage());
  assert.equal(p.status, "supported");
  assert.deepEqual([p.rows[0].kind, p.rows[0].chargeType, p.rows[0].label, p.rows[0].qty, p.rows[0].totalPaise], ["charge", "other", "Offer Processing Fees", 1, 333]);
});

test("PRIVACY: nothing from the buyer column or the payment block is read or returned", () => {
  for (const page of [productPage(), feePage()]) {
    const dump = JSON.stringify(parseAmazonInvoicePage(page));
    for (const secret of [BUYER, ADDR, CITY, PHONE, TXN, "Credit Card", "Billing Address", "Shipping Address"]) assert.ok(!dump.includes(secret), `leaked: ${secret}`);
    assert.ok(!/AAAAA0000A|ABCDE1234F\b(?!1)/.test(dump.replace(/29ABCDE1234F1Z5|29AAAAA0000A1ZZ/g, "")), "a PAN was returned on its own");
  }
});

test("the buyer name beside the seller is never used as the seller", () => {
  const items = productPage().map(i => i.str === "Sample Traders" ? { ...i, str: "Sample Traders" } : i);
  assert.equal(parseAmazonInvoicePage(items).seller.name, "Sample Traders");
});

test("rows that do not add up are flagged, never corrected", () => {
  const bad = productPage().map(i => i.str === "₹969.00" && i.y === 380 ? { ...i, str: "₹970.00" } : i);
  const p = parseAmazonInvoicePage(bad);
  assert.equal(p.status, "needs-review"); assert.equal(p.importable, false);
  assert.ok(p.findings.some(f => f.code === "declared-total-mismatch"));
  const badRow = productPage().map(i => i.str === "₹969.00" && i.y === 541 ? { ...i, str: "₹960.00" } : i);
  assert.ok(parseAmazonInvoicePage(badRow).findings.some(f => f.code === "total-mismatch"));
  const badTax = productPage().map(i => i.str === "₹147.81" && i.y === 541 ? { ...i, str: "₹100.00" } : i);
  assert.ok(parseAmazonInvoicePage(badTax).findings.some(f => f.code === "tax-rate-mismatch"));
});

test("several rows on one invoice are reported as unverified (only single-row invoices have been seen)", () => {
  const two = productPage().concat([T("₹100.00", 250, 500), T("2", 275, 500), T("₹200.00", 300, 500), T("18%", 345, 500), T("₹36.00", 420, 500), T("₹236.00", 470, 500)]);
  const p = parseAmazonInvoicePage(two);
  assert.ok(p.findings.some(f => f.code === "multi-row-unverified")); assert.equal(p.importable, false);
});

test("an order spread over several invoices is grouped, de-duplicated, and says what is missing", () => {
  const a = parseAmazonInvoicePage(productPage()), b = parseAmazonInvoicePage(feePage());
  const g = groupAmazonOrders([a, b, a]);
  assert.equal(g.length, 1); assert.equal(g[0].invoices.length, 2);
  assert.deepEqual([g[0].itemsPaise, g[0].chargesPaise, g[0].invoicedPaise], [96900, 333, 97233]);
  assert.equal(g[0].status, "supported");
  assert.equal(g[0].notOnTheseInvoices.length, 3);
  const other = parseAmazonInvoicePage(productPage({ orderNo: "999-0000000-0000000", invNo: "SMP-2" }));
  assert.equal(groupAmazonOrders([a, other]).length, 2);
});

test("PRIVACY: saved keys are hashed; neither the GSTIN, invoice number nor order number appears", async () => {
  const p = parseAmazonInvoicePage(productPage());
  const k = await amazonKeys(p);
  assert.match(k.invoiceKey, /^amazon\|[0-9a-f]{32}$/); assert.match(k.orderKey, /^amazon-order\|[0-9a-f]{32}$/);
  const dump = JSON.stringify(k);
  for (const s of ["29ABCDE1234F1Z5", "ABCDE1234F", "SMP-1001", "123-4567890-1234567"]) assert.ok(!dump.includes(s));
  assert.deepEqual(await amazonKeys(parseAmazonInvoicePage(productPage())), k);
  assert.notEqual((await amazonKeys(parseAmazonInvoicePage(productPage({ invNo: "SMP-1002" })))).invoiceKey, k.invoiceKey);
});

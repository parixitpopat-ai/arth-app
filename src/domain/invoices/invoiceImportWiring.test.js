// Guards for how Phase 2 is wired into the app, plus the itemised-spend result. Static checks read source text; nothing here touches storage.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BLINKIT_FIXTURE_3_ITEMS as ITEMS } from "./fixtures/blinkitGstInvoiceItems.fixture.js";
import { analysePage } from "./blinkitPdf.js";
import { buildInvoicePreviews } from "./invoicePreview.js";
import { planConfirm } from "./invoiceImport.js";
import { computeLineItemCategoryRollup } from "../transactions/lineItemCategoryRollup.js";

const here = dirname(fileURLToPath(import.meta.url));
const read = p => readFileSync(join(here, "..", "..", p), "utf8");
const app = read("App.jsx");

test("invoiceImports is persisted, in the cloud snapshot, in its dependency list, and restored with a guard (so it syncs, backs up and restores)", () => {
  assert.match(app, /safeSetLocalStorage\("arth_invoice_imports",JSON\.stringify\(invoiceImports\)\)/);
  assert.match(app, /\n {4}invoiceImports,\n/);
  assert.match(app, /if\(Array\.isArray\(snapshot\.invoiceImports\)\) setInvoiceImports\(snapshot\.invoiceImports\)/);
  assert.match(app.match(/\}\), \[dark, masterUserSetupComplete[^\n]*\n/)[0], /invoiceImports/);
  assert.match(read("sync/userData.js"), /"invoiceImports"/);
  assert.match(read("sync/tabOwnership.js"), /"arth_invoice_imports"/);
  assert.match(read("sync/differences.js"), /invoiceImports:/);
});

test("the invoice screen is rendered outside Settings, so its review state and Undo survive the save (Settings is re-created on every data change)", () => {
  assert.match(app, /showSettings&&settingsSection==="importinvoice"&&<InvoiceImportScreen/);
  assert.match(app, /showSettings&&settingsSection!=="importinvoice"&&<Settings\/>/);
  assert.doesNotMatch(app, /if\(settingsSection==="importinvoice"\) return/);
});

test("the app handler writes through the Quick Add boundary, reads the device copy back, and rolls both writes back on failure", () => {
  const h = app.slice(app.indexOf("const confirmInvoiceImport"), app.indexOf("const undoInvoiceImport"));
  assert.match(h, /createTransactionThroughBoundary\(plan\.create\)/);
  assert.match(h, /localStorage\.getItem\("arth_txns"\)/);
  assert.match(h, /setInvoiceImports\(prev=>prev\.filter\(/);                                     // rollback of the record
  assert.match(h, /Couldn't save on this device, so nothing was added/);
  assert.doesNotMatch(h, /amount\s*:/);                                                            // a link patch never sets an amount
});

test("itemised spend: each line's category carries its own amount, and the category amounts add up to the invoice total", () => {
  const page = { number: 1, items: ITEMS.map(i => ({ ...i })), textChars: 9999, imageOps: 0 };
  const inv = buildInvoicePreviews({ status: "supported", fileHash: "h", pages: [analysePage(page)] }).invoices[0];
  let n = 0; const genId = () => `id${++n}`;
  const r = planConfirm({ view: inv.view, status: inv.status, mode: "create", accountId: "b1", paymentDate: "2026-01-15", orderCatId: "groceries", lineCats: { 2: "food", 1: null } },
    { accounts: [{ id: "b1", name: "B" }], txns: [], records: [], genId, today: "2026-10-23" });
  const roll = computeLineItemCategoryRollup(r.create.lineItems);
  assert.equal(Math.round(roll.catAmounts.food * 100), 12000);                                       // item 2, ₹120
  assert.equal(Math.round(roll.catAmounts.groceries * 100), 93200 + 1300);                           // item 3 (₹932) + handling charge (₹13)
  assert.equal(roll.uncategorizedCount, 1);                                                          // item 1 (₹60), left uncategorised on purpose
  assert.equal(Math.round((roll.catAmounts.food + roll.catAmounts.groceries + 60) * 100), 112500);
});

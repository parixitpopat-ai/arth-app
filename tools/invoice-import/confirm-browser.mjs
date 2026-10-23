// Phase 2 (confirmed import) in the real app: Chromium, local Vite dev server, SYNTHETIC accounts/transactions, PDFs drawn from a redacted fixture.
// Chromium only: this says nothing about the Android app.   Setup: npx vite --port 5201 --strictPort &     Run: node tools/invoice-import/confirm-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { writeFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { BLINKIT_FIXTURE_3_ITEMS as ITEMS } from "../../src/domain/invoices/fixtures/blinkitGstInvoiceItems.fixture.js";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";
const APP = process.env.NL_APP || "http://localhost:5201/";
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const dir = mkdtempSync(join(tmpdir(), "inv2-"));
const draw = (items) => makePdf([{ texts: items.map(i => ({ str: i.str, x: i.x, y: i.y, size: 8 })) }]);
const swap = (pred, str) => ITEMS.map(i => (pred(i) ? { ...i, str } : i));
const pdfs = { good: draw(ITEMS), tampered: draw(swap(i => i.str === "932.00", "902.00")), credit: draw(swap(i => i.str === "Tax Invoice", "Credit Note")) };
const paths = {}; for (const [k, b] of Object.entries(pdfs)) { paths[k] = join(dir, `${k}.pdf`); writeFileSync(paths[k], b); }
const ACCOUNTS = [{ id: "b1", name: "Test Bank", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "c1", name: "Test Card", type: "cc", openingBalance: 0, openingBalanceDate: "2026-01-01", last4: "1234" }];
const TXNS = [
  { id: "t1", type: "expense", merchant: "Blinkit", desc: "Groceries", date: "2026-01-16", amount: 1125, accId: "c1", catIds: [], subIds: [] },
  { id: "t2", type: "expense", merchant: "Blinkit", desc: "Groceries", date: "2026-01-15", amount: 1135, accId: "b1", catIds: [], subIds: [] }];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const requests = [];
async function openScenario(txns, { failTxnWrites = false } = {}) {
  const ctx = await browser.newContext({ timezoneId: "Asia/Kolkata", viewport: { width: 420, height: 900 } });
  ctx.on("request", r => requests.push(r.url()));
  await ctx.route(u => { try { return !["localhost", "127.0.0.1"].includes(new URL(u).hostname); } catch { return false; } }, r => r.abort());
  await ctx.addInitScript(([accs, tx, fail]) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
    localStorage.setItem("arth_accounts", JSON.stringify(accs)); localStorage.setItem("arth_txns", JSON.stringify(tx));
    localStorage.setItem("arth_master_user_setup_complete", "true"); localStorage.setItem("arth_vehicles", "[]");
    if (fail) { window.__failTxns = false; const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (window.__failTxns && k === "arth_txns") throw new DOMException("quota", "QuotaExceededError"); return orig.call(this, k, v); }; } }, [ACCOUNTS, txns, failTxnWrites]);
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(APP); await page.waitForTimeout(900);
  for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(120); } await page.waitForTimeout(500); } }
  await page.getByText("☰", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(500);
  await page.getByText("Vehicles").first().click(); await page.waitForTimeout(400);
  await page.getByText("←", { exact: true }).first().click(); await page.waitForTimeout(400);
  await page.getByText("Import invoice", { exact: true }).first().click(); await page.waitForTimeout(400);
  return { ctx, page, errors, T: id => page.getByTestId(id), store: k => page.evaluate(x => JSON.parse(localStorage.getItem(x) || "[]"), k),
    pick: async f => { await page.getByTestId("invoice-file").setInputFiles(paths[f]); await page.waitForTimeout(1500); } };
}
const sum = lines => Math.round(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 100) / 100;

// ---- A: create, itemised, on a bank account; then undo; then create again; then duplicate is blocked ----
{ const s = await openScenario(TXNS); const { page, T } = s;
  await s.pick("good");
  rec("CF1 before choosing an account, Confirm is disabled and the reason is shown", (await T("confirm-import").isDisabled()) && /Choose the account you paid from/.test(await T("review-sentence").innerText()), {});
  rec("CF1b a same-amount expense on 16 Jan exists, so the page warns that a new expense would count the spend twice", (await T("double-count-warning").count()) === 1, {});
  await T("confirm-account").selectOption("b1");
  rec("CF2 with an account chosen the review sentence says exactly what will happen and Confirm is enabled", /Arth will: Add 1 expense of ₹1125 to Test Bank on 2026-01-15, with 4 item lines/.test(await T("review-sentence").innerText()) && !(await T("confirm-import").isDisabled()), { s: (await T("review-sentence").innerText()).slice(0, 120) });
  const before = await s.store("arth_txns");
  await T("confirm-import").click(); await page.waitForTimeout(1500);
  const after = await s.store("arth_txns"), recs = await s.store("arth_invoice_imports"), t = after.find(x => !before.some(b => b.id === x.id));
  rec("CF3 Confirm adds exactly ONE expense: ₹1,125, 15 Jan, Test Bank, Blinkit, category Groceries", after.length === before.length + 1 && t && t.amount === 1125 && t.date === "2026-01-15" && t.accId === "b1" && t.merchant === "Blinkit" && t.catId === "groceries" && t.type === "expense", { n: after.length, t: t && [t.amount, t.date, t.accId, t.catId] });
  rec("CF4 it is itemised: 3 items + Handling charge, lines add up to ₹1,125.00, none negative, discount kept inside the ₹932 line", t && t.lineItems.length === 4 && sum(t.lineItems) === 1125 && t.lineItems.every(l => l.amount >= 0) && t.lineItems.some(l => l.label === "Handling charge" && l.amount === 13) && t.lineItems.some(l => l.amount === 932 && l.qty === 2 && l.unitPrice === 466), { labels: t && t.lineItems.map(l => l.label.slice(0, 18)) });
  rec("CF5 one invoice record is saved with the key, order and invoice numbers and the expense id; no customer data or PDF", recs.length === 1 && recs[0].key === "blinkit|30AAFCG9846E1ZO|C00000T000000001" && recs[0].txnId === t.id && recs[0].mode === "created" && recs[0].totalPaise === 112500 && !JSON.stringify(recs[0]).match(/Name|Address|data:application/), { keys: Object.keys(recs[0] || {}).length });
  rec("CF6 the screen says it was added", (await T("import-done").count()) === 1, {});
  await T("undo-import").click(); await page.waitForTimeout(600);
  const afterUndo = await s.store("arth_txns"), recsUndo = await s.store("arth_invoice_imports");
  rec("CF7 Undo removes the expense and the record; transactions are back to the starting list", afterUndo.length === before.length && !afterUndo.some(x => x.id === t.id) && recsUndo.length === 0 && (await T("undone-note").count()) === 1, {});
  await T("confirm-account").selectOption("b1"); await T("confirm-import").click(); await page.waitForTimeout(1500);
  await s.pick("good");
  rec("CF8 choosing the same invoice again: it is recognised as already added and Confirm cannot be pressed", /already added|imported before/.test(await T("duplicate-banner").innerText()) && (await T("confirm-import").isDisabled()) && /already added/.test(await T("review-sentence").innerText()), {});
  rec("CF9 still only one expense and one record after the duplicate attempt", (await s.store("arth_txns")).length === before.length + 1 && (await s.store("arth_invoice_imports")).length === 1, {});
  const ext = requests.filter(u => { try { return !["localhost", "127.0.0.1"].includes(new URL(u).hostname) && !/fonts\.(googleapis|gstatic)/.test(u); } catch { return false; } });
  rec("CF10 no request left this machine (apart from the app's own page fonts)", ext.length === 0, ext.slice(0, 2));
  rec("CF11 no page errors", s.errors.length === 0, s.errors.slice(0, 2));
  await s.ctx.close(); }

// ---- B: link to an existing same-amount expense: only its items change ----
{ const s = await openScenario(TXNS); const { T } = s;
  await s.pick("good");
  await T("match-row").first().click();
  await T("mode-link").check();
  rec("CF12 link wording names the expense and says amount, date and account stay", /Add 4 item lines to your ₹1125 expense\. Its amount, date and account stay as they are/.test(await T("review-sentence").innerText()), {});
  const before = await s.store("arth_txns"); await T("confirm-import").click(); await s.page.waitForTimeout(1500);
  const after = await s.store("arth_txns"), t1 = after.find(x => x.id === "t1"), t1b = before.find(x => x.id === "t1"), recs = await s.store("arth_invoice_imports");
  rec("CF13 link: same number of expenses; t1 now has the 4 lines; its amount, date, account and merchant are unchanged; other expenses untouched", after.length === before.length && t1.lineItems.length === 4 && sum(t1.lineItems) === 1125 && t1.amount === t1b.amount && t1.date === t1b.date && t1.accId === t1b.accId && JSON.stringify(after.find(x => x.id === "t2")) === JSON.stringify(before.find(x => x.id === "t2")), {});
  rec("CF14 link record: mode linked, points at t1", recs.length === 1 && recs[0].mode === "linked" && recs[0].txnId === "t1", {});
  await T("undo-import").click(); await s.page.waitForTimeout(600);
  const un = (await s.store("arth_txns")).find(x => x.id === "t1");
  rec("CF15 Undo of a link removes the added items and leaves the expense as it was", !un.lineItems || un.lineItems.length === 0, {});
  await s.ctx.close(); }

// ---- C: a similar-amount suggestion cannot be linked ----
{ const s = await openScenario(TXNS.filter(x => x.id === "t2")); const { T } = s;
  await s.pick("good"); await T("match-row").first().click();
  rec("CF16 similar-amount suggestion: no link option, a plain explanation, creating a new expense is still possible", (await T("mode-link").count()) === 0 && (await s.page.getByText(/can't be linked yet/).count()) === 1, {});
  await s.ctx.close(); }

// ---- D: credit card account ----
{ const s = await openScenario([]); const { T } = s;
  await s.pick("good"); await T("confirm-account").selectOption("c1"); await T("confirm-import").click(); await s.page.waitForTimeout(1500);
  const t = (await s.store("arth_txns"))[0];
  rec("CF17 paid by credit card: an ordinary expense on the card account (the card bill payment later is a separate card payment, not an expense)", t && t.type === "expense" && t.accId === "c1", {});
  await s.ctx.close(); }

// ---- E: per-line category choice ----
{ const s = await openScenario([]); const { T } = s;
  await s.pick("good"); await T("confirm-account").selectOption("b1"); await T("line-cat-2").selectOption("food"); await T("line-cat-1").selectOption("");
  await T("confirm-import").click(); await s.page.waitForTimeout(1500);
  const t = (await s.store("arth_txns"))[0];
  rec("CF18 per-line category: line 2 = food, line 1 left uncategorised, the rest follow the order category; lines still add up", t && t.lineItems[1].catId === "food" && !t.lineItems[0].catId && t.lineItems[2].catId === "groceries" && sum(t.lineItems) === 1125, { cats: t && t.lineItems.map(l => l.catId) });
  await s.ctx.close(); }

// ---- F: a save failure is visible and nothing is left half-added ----
{ const s = await openScenario([], { failTxnWrites: true }); const { T, page } = s;
  await s.pick("good"); await T("confirm-account").selectOption("b1");
  await page.evaluate(() => { window.__failTxns = true; });
  await T("confirm-import").click(); await page.waitForTimeout(2000);
  await page.evaluate(() => { window.__failTxns = false; });
  rec("CF19 when the device cannot save, the screen says nothing was added", /Couldn't save on this device, so nothing was added/.test(await T("import-error").innerText()), {});
  await page.waitForTimeout(800);
  rec("CF20 and no expense and no invoice record exist afterwards (rolled back), so the invoice can be tried again", (await s.store("arth_txns")).length === 0 && (await s.store("arth_invoice_imports")).length === 0 && (await T("confirm-import").count()) === 1, {});
  await s.ctx.close(); }

// ---- G: documents that must never be added ----
{ const s = await openScenario(TXNS); const { T } = s; const before = JSON.stringify(await s.store("arth_txns"));
  await s.pick("tampered");
  rec("CF21 a wrong-total invoice cannot be confirmed: reason shown, button disabled, figures as printed", (await T("confirm-import").isDisabled()) && /needs review|do not add up/.test(await T("review-sentence").innerText()), { s: (await T("review-sentence").innerText()).slice(0, 140) });
  await s.pick("credit");
  rec("CF22 a credit note shows no 'Add to Arth' section at all", (await T("confirm-import").count()) === 0 && (await T("add-to-arth").count()) === 0, {});
  rec("CF23 nothing changed after those two", JSON.stringify(await s.store("arth_txns")) === before && (await s.store("arth_invoice_imports")).length === 0, {});
  await s.ctx.close(); }

console.log("outcome vector:", JSON.stringify(results));
await browser.close(); process.exit(results.every(r => r.pass) ? 0 : 1);

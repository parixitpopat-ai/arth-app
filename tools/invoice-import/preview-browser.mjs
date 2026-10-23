// Phase 1 invoice preview in the real app (Chromium, local Vite dev server, SYNTHETIC account/transactions, PDFs drawn from a redacted fixture).
// This is a CHROMIUM check. It says nothing about the Android app or Electron.
//   Setup: npx vite --port 5200 --strictPort &     Run: node tools/invoice-import/preview-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { writeFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { BLINKIT_FIXTURE_3_ITEMS as ITEMS } from "../../src/domain/invoices/fixtures/blinkitGstInvoiceItems.fixture.js";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";
const APP = process.env.NL_APP || "http://localhost:5200/";
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const dir = mkdtempSync(join(tmpdir(), "inv-"));
const draw = (items, extra = {}) => makePdf([{ texts: items.map(i => ({ str: i.str, x: i.x, y: i.y, size: 8 })), ...extra }]);
const swap = (pred, str) => ITEMS.map(i => (pred(i) ? { ...i, str } : i));
const files = {
  good: draw(ITEMS, { image: { x: 40, y: 780, w: 40, h: 20 } }),
  tampered: draw(swap(i => i.str === "932.00", "902.00")),
  credit: draw(swap(i => i.str === "Tax Invoice", "Credit Note")),
  junk: new TextEncoder().encode("%PDF-1.4\ngarbage"),
  scanned: makePdf([{ texts: [], image: { x: 0, y: 0, w: 595, h: 842 } }]),
};
const paths = {}; for (const [k, b] of Object.entries(files)) { paths[k] = join(dir, `${k}.pdf`); writeFileSync(paths[k], b); }
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ timezoneId: "Asia/Kolkata", viewport: { width: 420, height: 900 } });
const requests = []; ctx.on("request", r => requests.push(r.url()));
await ctx.route(u => { try { return !["localhost", "127.0.0.1"].includes(new URL(u).hostname); } catch { return false; } }, r => r.abort());
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  localStorage.setItem("arth_accounts", JSON.stringify([{ id: "b1", name: "Test Bank", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]));
  localStorage.setItem("arth_txns", JSON.stringify([
    { id: "t1", type: "expense", merchant: "Blinkit", desc: "Groceries", date: "2026-01-16", amount: 1125, accId: "b1", catIds: [], subIds: [] },
    { id: "t2", type: "expense", merchant: "Blinkit", desc: "Groceries", date: "2026-01-15", amount: 1135, accId: "b1", catIds: [], subIds: [] },
    { id: "t3", type: "expense", merchant: "Blinkit", desc: "Big order", date: "2026-01-15", amount: 2000, accId: "b1", catIds: [], subIds: [] },
    { id: "t4", type: "expense", merchant: "Cafe", desc: "Lunch", date: "2026-01-15", amount: 1130, accId: "b1", catIds: [], subIds: [] },
    { id: "tx", type: "expense", merchant: "Blinkit", desc: "Later", date: "2026-01-19", amount: 1125, accId: "b1", catIds: [], subIds: [] }]));
  localStorage.setItem("arth_master_user_setup_complete", "true"); localStorage.setItem("arth_vehicles", "[]"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e))); page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
await page.goto(APP); await page.waitForTimeout(900);
for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(120); } await page.waitForTimeout(500); } }
const keys = ["arth_txns", "arth_accounts"]; const snap = () => page.evaluate(k => k.map(x => localStorage.getItem(x)), keys);
const before = await snap(); const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort());
await page.getByRole("button", { name: /➖/ }).first().click(); await page.waitForTimeout(500); await page.getByText("From invoice", { exact: true }).click(); await page.waitForTimeout(500);
const T = id => page.getByTestId(id), body = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
requests.length = 0;                                          // the app's own page-load requests (fonts) are not part of PDF reading
const pick = async f => { await T("invoice-file").setInputFiles(paths[f]); await page.waitForTimeout(1500); };
rec("IV1 screen opens: review-first banner, Blinkit active, footer says nothing is added until Confirm", (await T("invoice-import").count()) === 1 && /Nothing is added until you press Confirm/.test(await T("import-preview-banner").innerText()) && /Nothing is added until you press Confirm/.test(await T("preview-footer").innerText()), {});

await pick("good");
const f = async id => (await T(`field-${id}`).innerText()).replace(/\s+/g, " ");
rec("IV2 valid invoice: invoice date, real order id and invoice number shown separately; no order time", (await f("invoice-date")).includes("2026-01-15") && (await f("order-id")).includes("0000000001") && (await f("invoice-number")).includes("C00000T000000001") && !/\d:\d\d ?(am|pm)/i.test(await body()), { date: await f("invoice-date") });
const rows = await T("item-row").allInnerTexts();
rec("IV3 items show qty x MRP, discount kept inside the line, taxes, final line total; no negative line", rows.length === 3 && /2 × MRP ₹606/.test(rows[2]) && /discount ₹280.* already inside the line total/.test(rows[2]) && /CGST 2.5% ₹22.19/.test(rows[2]) && /₹932/.test(rows[2]) && !/[−-]₹/.test(rows.join(" ")), { third: rows[2].replace(/\s+/g, " ").slice(0, 160) });
const h = await T("handling-charge").innerText();
rec("IV4 delivery rows are ONE verified handling charge (₹13) with the 3 printed rows kept", (await T("handling-charge").getAttribute("data-verified")) === "true" && /Handling charge/.test(h) && /₹13/.test(h) && (await T("handling-source-row").count()) === 3, { hasRows: await T("handling-source-row").count() });
rec("IV5 invoice total ₹1,125.00 and the reconciliation line names the invoice's own ₹0.01 rounding", /1,125/.test(await T("invoice-total").innerText()) && (await T("reconciliation").getAttribute("data-level")) === "adds-up-with-printed-rounding", {});
const ms = await T("match-row").evaluateAll(els => els.map(e => [e.getAttribute("data-id"), e.getAttribute("data-strength"), e.getAttribute("data-selected")]));
rec("IV6 matching: same-amount t1 first, similar t2 second, none auto-selected; other-merchant t4 and far txn absent; larger t3 only a hint", JSON.stringify(ms) === JSON.stringify([["t1", "same-amount", "false"], ["t2", "similar", "false"]]) && (await T("match-hint").count()) === 1 && /Test Bank/.test(await T("match-row").first().innerText()), { ms });
rec("IV6b the matching rules are labelled as unverified on the screen", /not yet verified on real data/.test(await T("match-rules-note").innerText()), {});
rec("IV7 Confirm is disabled until an account is chosen", (await T("confirm-import").isDisabled()), {});
await T("match-row").first().click(); await page.waitForTimeout(200);
rec("IV8 choosing a same-amount suggestion only offers the link option; nothing is written", (await T("mode-link").count()) === 1 && JSON.stringify(await snap()) === JSON.stringify(before), {});
await T("payment-date").fill("2026-01-18"); await page.waitForTimeout(500);
const ids = await T("match-row").evaluateAll(els => els.map(e => e.getAttribute("data-id")));
rec("IV9 editing the payment date re-runs the matching (txn dated 19 Jan now appears); the invoice date is unchanged", ids.includes("tx") && (await f("invoice-date")).includes("2026-01-15"), { ids });
await T("payment-date").fill("2030-01-01"); await page.waitForTimeout(300);
rec("IV10 a future payment date is refused with a reason", /can't be in the future/.test(await T("payment-date-error").innerText()), {});

await pick("good");
rec("IV11 choosing the same invoice again says it was already looked at in this session (not 'imported')", /already looked at this invoice/.test(await T("seen-banner").innerText()) && !/imported before/.test(await body()), {});
await pick("tampered");
const rv = await T("review-banner").innerText().catch(() => "");
rec("IV12 wrong figure: marked 'check', shown exactly as printed (₹902), reconciliation says it does not add up", /Check this before relying/.test(rv) && (await T("reconciliation").getAttribute("data-level")) === "does-not-add-up" && /₹902/.test((await T("item-row").allInnerTexts())[2]), {});
await pick("junk");
rec("IV13 unreadable file: plain message and actions, no invoice card", (await T("invoice-error").getAttribute("data-status")) === "unreadable" && (await T("invoice-card").count()) === 0 && (await T("action-add-by-hand").count()) === 1 && (await T("action-choose-another").count()) === 1, {});
await pick("scanned");
rec("IV14 scanned PDF: says it is a picture and needs OCR", /picture, not text/.test(await T("invoice-error").first().innerText()), {});
await pick("credit");
rec("IV15 credit note / cancellation: 'not a purchase invoice', no invoice card, no amount shown, nothing created", /This isn't a purchase invoice/.test(await T("invoice-error").first().innerText()) && (await T("invoice-card").count()) === 0 && (await T("invoice-total").count()) === 0 && JSON.stringify(await snap()) === JSON.stringify(before), {});
await T("action-close").first().click(); await page.waitForTimeout(300);
rec("IV16 Close discards the result and returns to the start", (await T("invoice-error").count()) === 0 && (await T("invoice-card").count()) === 0, {});
const diag = await (async () => { await pick("tampered"); return T("diag-code").innerText(); })();
rec("IV17 the diagnostic line has status and codes only (no names, amounts or identifiers)", /^Code: needs-review/.test(diag) && !/Haldiram|Pillsbury|902|1125|C00000T|0000000001|30AAFCG/.test(diag), { diag });
const newKeys = (await page.evaluate(() => Object.keys(localStorage).sort())).filter(k => !keysBefore.includes(k));
rec("IV18 after every scenario no transaction or account changed and nothing about invoices or PDFs was stored on the device", JSON.stringify(await snap()) === JSON.stringify(before) && newKeys.every(k => !/invoice|pdf/i.test(k)), { newKeys });
if (process.argv[2]) {   // optional: a REAL invoice PDF, read on this machine only; only customer-free facts are asserted/printed
  paths.real = process.argv[2]; await pick("real");
  const t = await body(), items = await T("item-row").count();
  rec("RV1 real invoice through the screen: 3 items, total ₹1,125, one verified handling charge, order id and invoice number present, no customer details shown", items === 3 && /1,125/.test(await T("invoice-total").innerText()) && (await T("handling-charge").getAttribute("data-verified")) === "true" && (await f("order-id")).replace(/\D/g, "").length >= 10 && !(await f("invoice-number")).includes("Not on the invoice") && !/Invoice To|\bName\s*:|Pin code|Address\s*:/.test(t), { items, date: (await f("invoice-date")).slice(0, 40) });
}
const external = requests.filter(u => { try { return !["localhost", "127.0.0.1"].includes(new URL(u).hostname) && !u.startsWith("data:") && !u.startsWith("blob:"); } catch { return false; } });
rec("IV19 no request left this machine while reading the PDFs (external requests: 0)", external.length === 0, external.slice(0, 3));
const real = errors.filter(e => !/Failed to load resource/.test(e)); rec("IV20 no page errors", real.length === 0, real.slice(0, 2));
console.log("outcome vector:", JSON.stringify(results));
await browser.close(); process.exit(results.every(r => r.pass) ? 0 : 1);

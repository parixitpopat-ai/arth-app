// Amazon.in invoice preview in the real app (Chromium, local Vite dev server, SYNTHETIC account and invoices drawn from a fixture).
// This is a CHROMIUM check. It says nothing about the Android app.   Setup: npx vite --port 5210 --strictPort &   Run: node tools/invoice-import/amazon-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { writeFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";
import { productPage, feePage, BUYER, ADDR, PHONE, TXN } from "../../src/domain/invoices/fixtures/amazonInvoice.fixture.js";
const APP = process.env.NL_APP || "http://localhost:5210/";
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const dir = mkdtempSync(join(tmpdir(), "amz-"));
const draw = (...pages) => makePdf(pages.map(items => ({ texts: items.map(i => ({ str: i.str, x: i.x, y: i.y, size: 8 })) })));
const otherOrder = productPage({ orderNo: "999-0000000-0000000", invNo: "SMP-2", sellerName: "Other Sample Seller" });
const files = { both: draw(feePage(), productPage()), second: draw(otherOrder), scanned: makePdf([{ texts: [], image: { x: 0, y: 0, w: 595, h: 842 } }]) };
const paths = {}; for (const [k, b] of Object.entries(files)) { paths[k] = join(dir, `${k}.pdf`); writeFileSync(paths[k], b); }
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ timezoneId: "Asia/Kolkata", viewport: { width: 420, height: 900 } });
const requests = []; ctx.on("request", r => requests.push(r.url()));
await ctx.route(u => { try { return !["localhost", "127.0.0.1"].includes(new URL(u).hostname); } catch { return false; } }, r => r.abort());
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  localStorage.setItem("arth_accounts", JSON.stringify([{ id: "b1", name: "Test Bank", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]));
  localStorage.setItem("arth_txns", JSON.stringify([{ id: "t1", type: "expense", merchant: "Shop", desc: "Shop", date: "2026-10-12", amount: 500, accId: "b1", catIds: [], subIds: [] }]));
  localStorage.setItem("arth_master_user_setup_complete", "true"); localStorage.setItem("arth_vehicles", "[]"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
await page.goto(APP); await page.waitForTimeout(900);
for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(120); } await page.waitForTimeout(500); } }
const snap = () => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
const before = await snap();
await page.getByRole("button", { name: /➖/ }).first().click(); await page.waitForTimeout(500); await page.getByText("From invoice", { exact: true }).click(); await page.waitForTimeout(500);
const T = id => page.getByTestId(id), body = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
requests.length = 0;
const pick = async f => { await T("invoice-file").setInputFiles(paths[f]); await page.waitForTimeout(4000); };

await pick("both");
rec("A1 an Amazon PDF opens the Amazon preview and marks Amazon as the platform", (await T("amazon-preview").count()) === 1 && (await T("platform-amazon").count()) === 1, {});
const rows = await T("amazon-row").allInnerTexts();
rec("A2 both invoices of the order are shown: the ₹969.00 item and the ₹3.33 fee, each with its seller", rows.length === 2 && rows.some(r => /969\.00/.test(r) && /Sample Traders/.test(r)) && rows.some(r => /3\.33/.test(r) && /Amazon Seller Services/.test(r) && /Processing/i.test(r)), rows);
rec("A3 invoiced total is ₹972.33, and the screen says it is not necessarily what was paid", /972\.33/.test(await T("amazon-invoiced-total").innerText()) && /not necessarily what you paid/.test(await T("amazon-missing").innerText()) && /discount/i.test(await T("amazon-missing").innerText()), {});
const txt = await body();
rec("A4 PRIVACY: no buyer name, address, phone, payment id or payment mode anywhere on screen", ![BUYER, ADDR, PHONE, TXN, "Credit Card"].some(s => txt.includes(s)), {});
rec("A5 the privacy note is shown", /not read/.test(await T("amazon-privacy").innerText()), {});
rec("A6 no Confirm button exists for Amazon and the note says why", (await T("confirm-import").count()) === 0 && /preview only/.test(await T("amazon-confirm-note").innerText()), {});
await pick("both");
rec("A7 choosing the same file again does not duplicate rows", (await T("amazon-row").count()) === 2 && (await T("amazon-order").count()) === 1, {});
await pick("second");
rec("A8 an invoice from a different order is a second order card", (await T("amazon-order").count()) === 2, {});
rec("A9 nothing was written: localStorage is byte-for-byte what it was", (await snap()) === before, {});
rec("A10 no network requests while reading (only the local page itself)", requests.every(u => /^(http:\/\/localhost|data:|blob:)/.test(u)), requests.slice(0, 3));
await T("amazon-clear").click(); await page.waitForTimeout(300);
rec("A11 Clear removes the readings", (await T("amazon-preview").count()) === 0, {});
await pick("scanned");
rec("A12 a scanned page still gets the 'picture / OCR' message, not an Amazon card", (await T("amazon-preview").count()) === 0 && /picture|OCR/i.test(await body()), {});
rec("A13 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close();
const bad = results.filter(r => !r.pass); console.log(`\n${results.length - bad.length}/${results.length} passed`); process.exit(bad.length ? 1 : 0);

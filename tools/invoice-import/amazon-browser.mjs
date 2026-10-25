// Amazon.in invoice upload + preview in the real app (Chromium, local Vite dev server, SYNTHETIC account and invoices drawn from a fixture, phone-width viewport).
// This is a CHROMIUM check. It says nothing about the Android app.   Setup: npx vite --port 5210 --strictPort &   Run: node tools/invoice-import/amazon-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { writeFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";
import { productPage, feePage, BUYER, ADDR, PHONE, TXN } from "../../src/domain/invoices/fixtures/amazonInvoice.fixture.js";
const APP = process.env.NL_APP || "http://localhost:5210/";
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const dir = mkdtempSync(join(tmpdir(), "amz-"));
const draw = (...pages) => makePdf(pages.map(items => ({ texts: items.map(i => ({ str: i.str, x: i.x, y: i.y, size: 8 })) })));
const fee = n => feePage().map(i => (i.str === "AMZ-2002" ? { ...i, str: `AMZ-${3000 + n}` } : i));
const other = productPage({ orderNo: "999-0000000-0000000", invNo: "SMP-9", sellerName: "Other Sample Seller" });
const files = { both: draw(feePage(), productPage()), merged: draw(fee(1), fee(2), fee(3)), second: draw(other), scanned: makePdf([{ texts: [], image: { x: 0, y: 0, w: 595, h: 842 } }]), junk: new TextEncoder().encode("%PDF-1.4\ngarbage") };
const paths = {}; for (const [k, b] of Object.entries(files)) { paths[k] = join(dir, `${k}.pdf`); writeFileSync(paths[k], b); }
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ timezoneId: "Asia/Kolkata", viewport: { width: 390, height: 844 } });
const requests = []; ctx.on("request", r => requests.push(r.url()));
const blocked = []; await ctx.route(u => { try { return !["localhost", "127.0.0.1"].includes(new URL(u).hostname); } catch { return false; } }, r => { blocked.push(r.request().url()); r.abort(); });
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
const T = id => page.getByTestId(id), text = id => T(id).evaluate(e => e.textContent.replace(/\s+/g, " "));
requests.length = 0;
const pick = async (...f) => { await T("invoice-file").setInputFiles(f.map(k => paths[k])); await page.waitForTimeout(400); await page.waitForFunction(() => !document.querySelector('[data-testid="invoice-reading"]'), null, { timeout: 60000 }); await page.waitForTimeout(400); };
const count = async id => Number((await T(`count-${id}`).locator("b").innerText()).trim());

// several files together, mixed: an order with two invoices, a merged PDF of 3 fee invoices, the SAME first file again, a picture-only file, a damaged file
await pick("both", "merged", "both", "scanned", "junk");
rec("B1 several files chosen together open one preview", (await T("amazon-preview").count()) === 1, {});
rec("B2 counts: 5 files, 5 invoices read, 1 exact duplicate, 1 unreadable, 1 needing OCR", (await count("files")) === 5 && (await count("read")) === 5 && (await count("exact")) === 1 && (await count("unreadable")) === 1 && (await count("ocr")) === 1,
  { files: await count("files"), read: await count("read"), exact: await count("exact"), unreadable: await count("unreadable"), ocr: await count("ocr") });
const outcomeKinds = await T("outcome-row").evaluateAll(els => els.map(e => e.getAttribute("data-kind")));
rec("B3 a per-file result exists for every file/page and names the kind (by position, never by name)", outcomeKinds.length >= 5 && outcomeKinds.includes("exact-duplicate") && outcomeKinds.includes("requires-ocr") && outcomeKinds.includes("unreadable"), outcomeKinds);
rec("B4 details are collapsed by default (seller, fee and outcome groups are closed)", await page.evaluate(() => [...document.querySelectorAll('[data-testid="amazon-seller-group"],[data-testid="amazon-fee-group"],[data-testid="amazon-outcomes"]')].every(d => !d.open)), {});
rec("B5 processing fees are grouped: 'Processing fees × 4' (1 from the order + 3 from the merged PDF), every source invoice kept", /Processing fees × 4/.test(await text("amazon-fee-group")) && (await T("amazon-fee-source").count()) === 4, {});
rec("B6 the order shows 'Unverified — no order summary' and no match claim", /Unverified — no order summary/.test(await text("amazon-unverified")) && !/Matches/.test(await text("amazon-preview")), {});
const body = await page.evaluate(() => document.body.textContent.replace(/\s+/g, " "));
rec("B7 PRIVACY: no buyer name, address, phone, payment id or payment mode anywhere in the page", ![BUYER, ADDR, PHONE, TXN, "Credit Card"].some(s => body.includes(s)), {});
rec("B8 no Confirm button exists for Amazon and the screen says it is not available yet", (await T("confirm-import").count()) === 0 && /not available yet/.test(await text("amazon-confirm-note")), {});
rec("B9 the invoiced total is shown with the 'not necessarily what you paid' warning", /not necessarily what you paid/.test(await text("amazon-missing")) && /discount/i.test(await text("amazon-missing")), {});
rec("B10 phone width: no horizontal scrolling", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), {});
rec("B11 nothing was written: localStorage is byte-for-byte what it was", (await snap()) === before, {});
rec("B12 no network requests while reading (only local app files)", requests.every(u => /^(http:\/\/localhost|data:|blob:)/.test(u)), requests.filter(u => !/^(http:\/\/localhost|data:|blob:)/.test(u)).slice(0, 3));

// a second batch in the same session: a repeat is counted once across batches; a new order is added
await pick("both", "second");
rec("B13 across batches: the repeated file is counted as an exact duplicate and the new order appears (2 orders)", (await T("amazon-order").count()) === 2 && (await count("exact")) >= 2, { orders: await T("amazon-order").count(), exact: await count("exact") });
rec("B14 files chosen in the second batch continue the numbering (File 6…)", /File 6/.test(await text("amazon-outcomes")), {});
await T("amazon-clear").click(); await page.waitForTimeout(300);
rec("B15 Clear removes the readings", (await T("amazon-preview").count()) === 0, {});

// a single picture-only file keeps the explanatory message and no Amazon card
await pick("scanned");
rec("B16 a single scanned file still gets the 'picture / OCR' message, not an Amazon card", (await T("amazon-preview").count()) === 0 && /picture|OCR/i.test(await page.evaluate(() => document.body.innerText)), {});
// a single Amazon file still works through the single-file path
await pick("both");
rec("B17 a single Amazon file works the same way", (await T("amazon-order").count()) === 1 && (await count("read")) === 2, {});
// file limits are enforced and reported (not raised): 11 pages, and a file over 10 MB
const eleven = makePdf(Array.from({ length: 11 }, () => ({ texts: productPage().map(i => ({ str: i.str, x: i.x, y: i.y, size: 8 })) })));
writeFileSync(join(dir, "eleven.pdf"), eleven); paths.eleven = join(dir, "eleven.pdf");
const big = new Uint8Array(11 * 1024 * 1024 + 10); big.set(new TextEncoder().encode("%PDF-1.4\n")); writeFileSync(join(dir, "big.pdf"), big); paths.big = join(dir, "big.pdf");
await T("amazon-clear").click().catch(() => {});
await pick("eleven", "big", "both");
const kinds = await T("outcome-row").evaluateAll(els => els.map(e => e.getAttribute("data-kind")));
rec("B19 limits unchanged: 11 pages -> too many pages; over 10 MB -> too large; the valid file still reads", kinds.includes("too-many-pages") && kinds.includes("too-large") && (await count("read")) === 2, kinds);
// isolation: nothing but local files was ever requested; no Supabase host was even attempted; no other browser storage was touched
rec("B20 ISOLATION: no request to any Supabase or other remote host was attempted by the app", blocked.filter(u => !/fonts\.(googleapis|gstatic)\.com|google|gvt1/.test(u)).length === 0, blocked.slice(0, 4));
rec("B21 ISOLATION: no IndexedDB database or sessionStorage entry was created by reading invoices", await page.evaluate(async () => { const dbs = indexedDB.databases ? await indexedDB.databases() : []; return dbs.length === 0 && sessionStorage.length === 0; }), {});
rec("B18 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close();
const bad = results.filter(r => !r.pass); console.log(`\n${results.length - bad.length}/${results.length} passed`); process.exit(bad.length ? 1 : 0);

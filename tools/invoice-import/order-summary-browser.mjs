// Order summary typed by hand + order picker, in the real app (Chromium, local Vite server, SYNTHETIC data, phone-width viewport). INVOICE-IMPORT-009 steps 2-3.
// This is a CHROMIUM check. It says nothing about the Android app.   Setup: npx vite --port 5210 --strictPort &   Run: node tools/invoice-import/order-summary-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { writeFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";
import { productPage, feePage } from "../../src/domain/invoices/fixtures/amazonInvoice.fixture.js";
const APP = process.env.NL_APP || "http://localhost:5210/";
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const dir = mkdtempSync(join(tmpdir(), "osum-"));
const draw = (...pages) => makePdf(pages.map(items => ({ texts: items.map(i => ({ str: i.str, x: i.x, y: i.y, size: 8 })) })));
const fee = n => feePage().map(i => (i.str === "AMZ-2002" ? { ...i, str: `AMZ-${3000 + n}` } : i));
const O1 = "123-4567890-1234567", O2 = "999-0000000-0000000";
// order 1: two item invoices of 969.00 + three fee invoices of 3.33 = items 1,938.00, fees 9.99.  order 2: one item invoice of 969.00.
const files = { o1a: draw(productPage()), o1b: draw(productPage({ invNo: "SMP-2", sellerName: "Second Sample Seller", gstin: "29FGHIJ5678K1Z9", pan: "FGHIJ5678K" })), fees: draw(fee(1), fee(2), fee(3)),
  o2: draw(productPage({ orderNo: O2, invNo: "SMP-9", sellerName: "Other Sample Seller" })) };
const paths = {}; for (const [k, b] of Object.entries(files)) { paths[k] = join(dir, `${k}.pdf`); writeFileSync(paths[k], b); }
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ timezoneId: "Asia/Kolkata", viewport: { width: 390, height: 844 } });
const requests = []; ctx.on("request", r => requests.push(r.url()));
await ctx.route(u => { try { return !["localhost", "127.0.0.1"].includes(new URL(u).hostname); } catch { return false; } }, r => r.abort());
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  localStorage.setItem("arth_accounts", JSON.stringify([{ id: "b1", name: "Test Bank", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]));
  localStorage.setItem("arth_txns", JSON.stringify([{ id: "t1", type: "expense", merchant: "Shop", desc: "Shop", date: "2026-10-12", amount: 500, accId: "b1", catIds: [], subIds: [] }]));
  localStorage.setItem("arth_loans", "[]"); localStorage.setItem("arth_master_user_setup_complete", "true"); localStorage.setItem("arth_vehicles", "[]"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
await page.goto(APP); await page.waitForTimeout(900);
for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(120); } await page.waitForTimeout(500); } }
const snap = () => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
const before = await snap();
await page.getByRole("button", { name: /➖/ }).first().click(); await page.waitForTimeout(500); await page.getByText("From invoice", { exact: true }).click(); await page.waitForTimeout(500);
const T = id => page.getByTestId(id), text = id => T(id).first().evaluate(e => e.textContent.replace(/\s+/g, " "));
requests.length = 0;
const pick = async (...f) => { await T("invoice-file").setInputFiles(f.map(k => paths[k])); await page.waitForTimeout(400); await page.waitForFunction(() => !document.querySelector('[data-testid="invoice-reading"]'), null, { timeout: 60000 }); await page.waitForTimeout(400); };
const fill = async v => { for (const [k, val] of Object.entries(v)) await T(`summary-${k}`).fill(val); await page.waitForTimeout(150); };
const enter = async (v, orderNo) => { await T("summary-enter").click(); await fill(v); if (orderNo != null) await T("summary-ordernumber").fill(orderNo); };
const GOOD = { subtotal: "1938.00", shipping: "50.00", fee: "9.99", discount: "", grandTotal: "1997.99" };

await pick("o1a", "o1b", "fees", "o2");
rec("S0 invoices still read as before: 6 invoices, 2 orders, each 'Unverified — no order summary'", (await T("amazon-order").count()) === 2 && (await T("count-read").locator("b").innerText()) === "6" && (await text("amazon-unverified")) === "Unverified — no order summary", {});

// Step 2: the form
await enter({ ...GOOD, grandTotal: "1990.00" });
rec("S1 a wrong Grand Total fails E2 with the arithmetic, and 'These figures are right' stays disabled", (await T("summary-e2").getAttribute("data-status")) === "fails" && /1,997\.99/.test(await text("summary-e2")) && (await T("summary-ack").isDisabled()), await text("summary-e2"));
rec("S2 no figure is changed for the person (the typed value is still 1990.00), and with two possible fixes (the discount or the Grand Total) no guess is offered", (await T("summary-grandTotal").inputValue()) === "1990.00" && (await T("summary-suggestion").count()) === 0, {});
rec("S3 Total is calculated and cannot be typed (no input for it)", (await T("summary-total").evaluate(e => e.tagName)) !== "INPUT" && /1,997\.99/.test(await text("summary-total")), await text("summary-total"));
await fill({ grandTotal: "1997.99" });
rec("S4 right figures: both equations show a tick and the button enables", (await T("summary-e1").getAttribute("data-status")) === "holds" && (await T("summary-e2").getAttribute("data-status")) === "holds" && !(await T("summary-ack").isDisabled()), {});
await T("summary-cancel").click();
await enter({ subtotal: "abc", grandTotal: "10" });
rec("S5 text that is not an amount is refused and the button stays disabled", await T("summary-ack").isDisabled(), {});
await T("summary-cancel").click();

// Step 3: matching
await enter(GOOD, O1); await T("summary-ack").click(); await page.waitForTimeout(300);
rec("S6 an exact order number attaches by itself: 'matched exactly', and the order card says 'Order summary entered by you'", /matched exactly/.test(await text("summary-attachment")) && /Order summary entered by you/.test(await T("amazon-unverified").first().innerText()), {});
rec("S7 against the invoices: Items and Fees match, Shipping is only on the summary, order total ₹1,997.99", await page.evaluate(() => [...document.querySelectorAll('[data-testid="summary-component"]')].map(e => e.getAttribute("data-state")).join(",")) === "matches,matches,summary-only,summary-only" && /1,997\.99/.test(await text("summary-order-total")), {});
rec("S8 even a perfect match is blocked: 'Confirmation is blocked', no Confirm button anywhere", /Confirmation is blocked/.test(await text("order-gate")) && (await T("confirm-import").count()) === 0, await text("order-gate"));
await T("summary-remove").click(); await page.waitForTimeout(200);
rec("S9 removing the summary returns the order to 'Unverified'", /Unverified/.test(await text("amazon-unverified")) && (await T("summary-card").count()) === 0, {});

// no number: the person must choose
await enter(GOOD, null); await T("summary-ack").click(); await page.waitForTimeout(300);
rec("S10 no order number: nothing attaches by itself; the picker lists the orders and says confirmation is blocked", (await T("summary-card").getAttribute("data-state")) === "choose" && (await T("summary-order-option").count()) === 2 && /blocked/.test(await text("summary-blocked")) && /Unverified/.test(await text("amazon-unverified")), {});
await T("summary-not-sure").click(); await page.waitForTimeout(200);
rec("S11 'I am not sure' leaves it unattached and blocking, with no comparison shown", (await T("summary-card").getAttribute("data-state")) === "unattached" && (await T("summary-reconciliation").count()) === 0, {});
await T("summary-rechoose").click(); await page.waitForTimeout(200);
await T("summary-order-option").first().click(); await page.waitForTimeout(300);
rec("S12 choosing an order attaches it as 'chosen by you' and shows the comparison", (await T("summary-card").getAttribute("data-state")) === "chosen" && (await T("summary-reconciliation").count()) === 1, {});
await T("summary-remove").click();

// near-match hint
await enter(GOOD, "123-4567890-1234568"); await T("summary-ack").click(); await page.waitForTimeout(300);
const hints = await T("summary-order-option").evaluateAll(els => els.map(e => e.getAttribute("data-hint")));
rec("S13 a number one digit off is a hint only: not attached, and exactly one order is marked", (await T("summary-card").getAttribute("data-state")) === "choose" && hints.filter(h => h === "true").length === 1, hints);
await T("summary-remove").click();
await enter(GOOD, "12-345");
rec("S14 a badly formed order number is called out on the form", (await T("summary-ordernumber-bad").count()) === 1, {});
await T("summary-cancel").click();

// invoice mismatch: acknowledgement cannot clear it
await enter({ subtotal: "1900.00", shipping: "50.00", fee: "9.99", discount: "", grandTotal: "1959.99" }, O1);
const ackEnabled = !(await T("summary-ack").isDisabled()); await T("summary-ack").click(); await page.waitForTimeout(300);
rec("S15 figures that add up but disagree with the invoices can be accepted as figures, yet the order still shows the exact difference", ackEnabled && (await T("summary-card").getAttribute("data-acknowledged")) === "true" && /invoices exceed the summary by ₹38\.00/.test(await text("summary-reconciliation")), await text("summary-reconciliation"));
rec("S16 the acknowledgement did not clear the mismatch: the order is still blocked for 'disagree', and the card is flagged", /disagree/.test(await text("order-gate")) && (await T("summary-reconciliation").getAttribute("data-mismatch")) === "true", await text("order-gate"));
await T("summary-remove").click();

// discount
await enter({ subtotal: "1938.00", shipping: "50.00", fee: "9.99", discount: "17.33", grandTotal: "1980.66" }, O1); await T("summary-ack").click(); await page.waitForTimeout(300);
rec("S17 a discounted order is accepted as figures but stays unconfirmable, with the reason shown", /discount/.test(await text("order-gate")) && /Confirmation is blocked/.test(await text("order-gate")), await text("order-gate"));
// duplicate
await enter(GOOD, O1); await T("summary-ack").click(); await page.waitForTimeout(300);
rec("S18 two summaries on one order are both flagged", (await T("summary-card").count()) === 2 && /More than one summary/.test(await text("order-gate")), await text("order-gate"));

rec("S19 nothing was saved: localStorage is byte-for-byte what it was (no expense, loan or instalment)", (await snap()) === before, {});
rec("S20 no remote request, no IndexedDB, no sessionStorage", requests.every(u => /^(http:\/\/localhost|data:|blob:)/.test(u)) && await page.evaluate(async () => { const dbs = indexedDB.databases ? await indexedDB.databases() : []; return dbs.length === 0 && sessionStorage.length === 0; }), requests.filter(u => !/^(http:\/\/localhost|data:|blob:)/.test(u)).slice(0, 2));
rec("S21 phone width: no sideways scrolling", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), {});
await T("amazon-clear").click(); await page.waitForTimeout(300);
rec("S22 Clear removes the summaries too", (await T("summary-card").count()) === 0 && (await T("summary-panel").count()) === 0, {});
rec("S23 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close();
const bad = results.filter(r => !r.pass); console.log(`\n${results.length - bad.length}/${results.length} passed`); process.exit(bad.length ? 1 : 0);

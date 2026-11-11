// Settings -> Import bank statement, in the real app (Chromium, local Vite dev server). SYNTHETIC statement files and data only. A CHROMIUM check only.
// Run: node tools/imports/statement-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";
const PORT = 4204, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const dir = mkdtempSync(join(tmpdir(), "stmt-"));
const csv = join(dir, "stmt.csv");
writeFileSync(csv, ["Transaction Date,Value Date,Particulars,Cheque No.,Debit,Credit,Balance",
  "01-04-2026,01-04-2026,UPI/P2M/412345678901/PAX INNO,,670.01,,9329.99",
  "02-04-2026,02-04-2026,SALARY APR,,,50000.00,59329.99",
  "03-04-2026,03-04-2026,ICICI CC 8004 BILL PAYMENT,,2500.00,,56829.99",
  "04-04-2026,04-04-2026,UPI/P2M/412345678902/CHAI POINT,,120.00,,56709.99"].join("\n"));
const t = (str, x, y) => ({ str, x, y, size: 8 });
const pdf = join(dir, "stmt.pdf");
writeFileSync(pdf, makePdf([{ texts: [t("Transaction Date", 30, 780), t("Particulars", 110, 780), t("Debit", 300, 780), t("Credit", 360, 780), t("Balance", 430, 780),
  t("05-04-2026", 30, 760), t("IFT/9/SHOP TWO", 110, 760), t("200.00", 370, 760), t("56509.99", 465, 760),
  t("06-04-2026", 30, 740), t("IFT/9/SHOP THREE", 110, 740), t("50.00", 370, 740), t("56459.99", 465, 740)] }]));

// synthetic credit-card statement PDF (side panel + summary strip + table), invented figures
const ct = (str, x, y, size = 7) => ({ str, x, y, size });
const cright = (s, y) => ct(s, 590 - s.length * 3.6, y);
const cardPdf = join(dir, "card.pdf");
writeFileSync(cardPdf, makePdf([{ texts: [
  ct("STATEMENT DATE", 90, 700), ct("October 16, 2026", 88, 682), ct("PAYMENT DUE DATE", 82, 650), ct("November 3, 2026", 88, 632), ct("Total Amount due", 90, 580), ct("\u20B9575.10", 105, 562), ct("Minimum Amount due", 84, 520), ct("\u20B9100.00", 105, 502), ct("Dining-100%", 40, 390),
  ct("Previous Balance", 340, 560, 6), ct("\u20B91,000.00", 346, 545, 6), ct("Purchases / Charges", 395, 560, 6), ct("\u20B9575.10", 412, 545, 6), ct("Cash Advances", 468, 560, 6), ct("\u20B90.00", 480, 545, 6), ct("Payments / Credits", 523, 560, 6), ct("\u20B91,000.00", 532, 545, 6),
  ct("Date", 342, 420), ct("SerNo.", 385, 420), ct("Transaction Details", 430, 420), ct("Reward", 505, 420), ct("Points", 507, 411), ct("Amount (in\u20B9)", 545, 420),
  ct("06/10/2026", 342, 380), ct("14308206086", 385, 380), ct("ZOMATO CYBS DELHI", 430, 380), ct("7", 505, 380), cright("375.10", 380),
  ct("08/10/2026", 342, 365), ct("14308206999", 385, 365), ct("AMAZON PAY MUMBAI", 430, 365), cright("200.00", 365),
  ct("09/10/2026", 342, 350), ct("14308207000", 385, 350), ct("PAYMENT RECEIVED", 430, 350), cright("1,000.00 CR", 350)] }]));
const bad = join(dir, "x.csv"); writeFileSync(bad, "hello,world\n1,2\n");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 10000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "cc1", name: "Test ICICI Card", type: "cc", last4: "8004", creditLimit: 100000 }, { id: "upi1", name: "Test UPI", type: "upi", handle: "test@upi", linkedAccount: "bank1" }]);
  set("arth_txns", [{ id: "m1", type: "expense", merchant: "Chai Point", desc: "Chai Point", amount: 120, date: "2026-04-03", accId: "upi1", catId: "food", catIds: ["food"] }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
const open = async () => { await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  await page.getByText("Test Savings").first().dispatchEvent("click"); await page.waitForTimeout(600);
  await T("acc-import-statement").dispatchEvent("click"); await page.waitForTimeout(500); };
const load = async f => { await T("stmt-file").setInputFiles(f); await page.waitForTimeout(1500); };
try {
  await open();
  rec("S1 the bank account's own page has 'Import statement'; it opens the screen with that account fixed (no account picker)", (await T("statement-import").count()) === 1 && (await T("stmt-fixed-account").innerText()) === "Test Savings" && (await T("stmt-account").count()) === 0, {});
  await load(csv);
  let body = await text();
  rec("S2 preview shows 4 rows, period, balance check passes", (await T("stmt-row").count()) === 4 && /01-04-2026 to 04-04-2026/.test(body) && (await T("stmt-balance-ok").count()) === 1, body.slice(0, 200));
  const st = await page.locator('[data-testid="stmt-row"]').evaluateAll(els => els.map(e => e.dataset.status));
  rec("S3 the chai row is a probable match to the manual entry that was paid through the linked UPI handle (3 new, 1 probable)", st.join() === "new,new,new,probable-match", st);
  rec("S4 the card-bill row says it goes to the card; nothing is imported yet", /card bill payment → Test ICICI Card/.test(body) && (await ls("arth_txns")).length === 1, {});
  rec("S5 button says Import 3 rows", /Import 3 rows/.test(await T("stmt-import").innerText()), {});
  // balances: set opening to the statement's first balance, current to its last; undo restores
  const acc0 = async () => (await ls("arth_accounts")).find(a => a.id === "bank1");
  rec("S5a the balance card offers opening 10,000.00 -> 10,000.00 on 01-04-2026 and current -> 56,709.99 as of 04-04-2026", /56,709\.99/.test(await T("stmt-balance-card").innerText()) && /01-04-2026/.test(await T("stmt-balance-card").innerText()), (await T("stmt-balance-card").innerText()).slice(0, 200));
  await T("stmt-balance-match").click(); await page.waitForTimeout(500);
  const a1 = await acc0(), cp1 = (await page.evaluate(() => JSON.parse(localStorage.getItem("arth_checkpoints") || "{}"))).bank1;
  rec("S5b 'Set these balances' stores opening 10000 dated 2026-04-01 and the current-balance note 56709.99 as of 2026-04-04", a1.openingBalance === 10000 && a1.openingBalanceDate === "2026-04-01" && cp1 && cp1.amount === 56709.99 && cp1.date === "2026-04-04", { a1: [a1.openingBalance, a1.openingBalanceDate], cp1 });
  await T("stmt-balance-undo").click(); await page.waitForTimeout(500);
  const a2 = await acc0(), cp2 = (await page.evaluate(() => JSON.parse(localStorage.getItem("arth_checkpoints") || "{}"))).bank1;
  rec("S5c Undo puts the opening balance, its date and the (absent) current-balance note back exactly", a2.openingBalance === 10000 && a2.openingBalanceDate === "2026-01-01" && !cp2, { a2: [a2.openingBalance, a2.openingBalanceDate], cp2 });
  rec("S5d the chai row shows my entry and a Merge button", (await T("stmt-match").count()) === 1 && /Chai Point/.test(await T("stmt-match").innerText()), {});
  await T("stmt-merge").click(); await page.waitForTimeout(300);
  rec("S5e after tapping Merge the button says Import 3 rows · merge 1", /Import 3 rows · merge 1/.test(await T("stmt-import").innerText()), await T("stmt-import").innerText());
  await T("stmt-import").click(); await page.waitForTimeout(700);
  const tx = await ls("arth_txns"), imp = tx.filter(x => x.importKey && !x.importMerged);
  const m1 = tx.find(x => x.id === "m1");
  rec("S6 3 transactions added; my chai entry was linked, not duplicated or changed (amount, merchant, category kept)", imp.length === 3 && tx.length === 4 && m1.importMerged === true && !!m1.importKey && m1.amount === 120 && m1.merchant === "Chai Point" && m1.catIds[0] === "food", imp.map(x => x.type));
  const exp = imp.find(x => x.type === "expense"), inc = imp.find(x => x.type === "income"), cc = imp.find(x => x.type === "cc_payment");
  rec("S7 expense 670.01 'Pax Inno' uncategorised; income 50000; card payment 2500 bank1->cc1", exp && exp.amount === 670.01 && exp.merchant === "Pax Inno" && exp.catIds.length === 0 && inc && inc.amount === 50000 && cc && cc.amount === 2500 && cc.fromAccId === "bank1" && cc.toAccId === "cc1", imp);
  rec("S8 done card shown with Undo", (await T("stmt-done").count()) === 1, {});
  // re-import the same file: nothing new
  await page.reload(); await page.waitForTimeout(1200); await open(); await load(csv);
  const st2 = await page.locator('[data-testid="stmt-row"]').evaluateAll(els => els.map(e => e.dataset.status));
  rec("S9 importing the same file again: all 4 rows (3 created + 1 merged) are 'imported before', Import is disabled", st2.filter(s => s === "already-imported").length === 4 && (await T("stmt-import").isDisabled()), st2);
  // PDF with reversed-looking? (credit col holds a debit-looking amount) -> balance column decides
  await T("stmt-file").setInputFiles(pdf); await page.waitForTimeout(1800);
  body = await text();
  rec("S10 a text PDF is read: 2 rows, shown as money out because the balance column says so", (await T("stmt-row").count()) === 2 && /−₹200\.00/.test(body) && /−₹50\.00/.test(body) && (await T("stmt-reversed").count()) === 1, body.slice(0, 250));
  await T("stmt-file").setInputFiles(bad); await page.waitForTimeout(800);
  rec("S11 an unreadable file gives a plain reason and changes nothing", (await T("stmt-error").count()) === 1 && (await ls("arth_txns")).length === 4, await T("stmt-error").innerText());
  // earlier imports + undo
  rec("S12 'Earlier imports' lists the batch", (await T("stmt-batches").count()) === 1, {});
  page.once("dialog", d => d.accept());
  await T("stmt-undo-batch").click(); await page.waitForTimeout(600);
  const after = await ls("arth_txns");
  rec("S13 Undo removes the 3 created entries and un-links the merged one: my entry is back exactly as it was", after.length === 1 && after[0].id === "m1" && !after[0].importKey && !after[0].importMerged && after[0].amount === 120, after);

  // ── a credit card's own page: import its statement (PDF) ──
  await page.evaluate(() => { const t = JSON.parse(localStorage.getItem("arth_txns") || "[]"); t.push({ id: "pay1", type: "cc_payment", desc: "Icici card bill", amount: 1000, date: "2026-10-08", fromAccId: "bank1", toAccId: "cc1", accId: null, catIds: [] }); localStorage.setItem("arth_txns", JSON.stringify(t)); });
  await page.reload(); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  const before = (await ls("arth_txns")).length;
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  rec("C1 the card's tile on Money has 'Import statement'", (await T("card-import-statement").count()) === 1, {});
  await T("card-import-statement").dispatchEvent("click"); await page.waitForTimeout(500);
  rec("C2 the screen opens with the card fixed", (await T("stmt-fixed-account").innerText()) === "Test ICICI Card", {});
  await T("stmt-file").setInputFiles(cardPdf); await page.waitForTimeout(2200);
  body = await text();
  const cst = await page.locator('[data-testid="stmt-row"]').evaluateAll(els => els.map(e => e.dataset.status));
  rec("C3 3 rows read; the statement summary is shown (total due, due date) and it adds up", cst.length === 3 && /Total due ₹575\.10/.test(body) && /due 03-11-2026/.test(body) && (await T("stmt-card-ok").count()) === 1 && (await T("stmt-card-ok2").count()) === 1, { cst, body: body.slice(0, 300) });
  rec("C4 the CR row matches my bank-side card payment (probable match) and can be merged", cst.join() === "new,new,probable-match" && (await T("stmt-merge").count()) === 1, cst);
  rec("C5 charges are ticked, the payment row is not (cards add charges only): Import 2 rows", /Import 2 rows/.test(await T("stmt-import").innerText()), await T("stmt-import").innerText());
  await T("stmt-merge").click(); await page.waitForTimeout(300);
  await T("stmt-import").click(); await page.waitForTimeout(700);
  const ct2 = await ls("arth_txns"), made = ct2.filter(x => x.importKey && !x.importMerged && x.accId === "cc1"), pay = ct2.find(x => x.id === "pay1");
  rec("C6 two expenses were added ON THE CARD (375.10 and 200.00), uncategorised, vendor from the description", made.length === 2 && made.every(x => x.type === "expense" && x.catIds.length === 0) && made.some(x => x.amount === 375.1 && x.merchant === "Zomato Cybs Delhi") && made.some(x => x.amount === 200), made.map(x => [x.amount, x.merchant]));
  rec("C7 my bank-side card payment was linked, not duplicated or changed; no payment entry was created", ct2.length === before + 2 && pay.importMerged === true && pay.amount === 1000 && pay.type === "cc_payment", { before, after: ct2.length });
  // the statement bill, set from the PDF's printed total / due date
  const bc = (await T("stmt-bill-card").innerText()).replace(/\n/g, " ");
  rec("B1 after the import the screen compares the PDF total with Arth's charges for the cycle: ₹575.10 vs ₹575.10, matches; a note says the card's statement day in Arth (15) is not the printed 16", /Statement total ₹575\.10/.test(bc) && /Arth has ₹575\.10/.test(bc) && /matches/.test(bc) && /statement day in Arth is 15/.test(await T("stmt-bill-note").innerText()), bc);
  await T("stmt-bill-set").click(); await page.waitForTimeout(500);
  let bills = await ls("arth_bills"), sb = bills.find(b => b.isCcStatement);
  rec("B2 'Set the statement bill' creates the card's statement bill: period to 16-10, due 03-11-2026, Arth 575.10 = bank 575.10, matched, nothing else changed", sb && sb.accId === "cc1" && sb.periodTo === "2026-10-16" && sb.dueDate === "2026-11-03" && sb.arthAmount === 575.1 && sb.bankAmount === 575.1 && sb.verification === "matched" && (await ls("arth_txns")).length === ct2.length, sb && { periodFrom: sb.periodFrom, periodTo: sb.periodTo, v: sb.verification });
  rec("B3 pressing it again is not offered; the screen says it already matches only after a fresh load (here: shows Done with Undo)", (await T("stmt-bill-undo").count()) === 1, {});
  await T("stmt-bill-undo").click(); await page.waitForTimeout(400);
  const billAfter = (await ls("arth_bills")).find(b => b.id === sb.id);
  rec("B4 Undo puts things back: the bill it created is gone, or (when the app had already made its own bill for that cycle and this updated it in place) that bill is back as it was, with no bank amount", !billAfter || billAfter.bankAmount == null, billAfter ? { periodTo: billAfter.periodTo, bankAmount: billAfter.bankAmount } : "removed");
  await page.reload(); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  await T("card-view-txns").dispatchEvent("click"); await page.waitForTimeout(700);
  const detail = await text();
  rec("C8 'View transactions' on the card's Money tile opens its transactions, including the imported charges", /Zomato Cybs Delhi/i.test(detail) && /Amazon Pay Mumbai/i.test(detail), detail.slice(0, 200));
  // ── pasted text from the bank app, on the same card ──
  const zt = (await ls("arth_txns")).find(t => /zomato/i.test(t.merchant || t.desc || "") && t.importSource === "bank-statement");
  const [zy, zm, zd] = zt.date.split("-"); const mon = ["January","February","March","April","May","June","July","August","September","October","November","December"][+zm - 1];
  const pasted = `Here are your transactions:\n\n1. Amount: -₹${Number(zt.amount).toFixed(2)}\nDate: ${+zd} ${mon} ${zy}\nDescription: UPI-xx -yy -ZOMATO L\n\n2. Amount: -₹321.45\nDate: ${+zd} ${mon} ${zy}\nDescription: SWIGGY INSTAMART BLR\n`;
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(700);
  await T("card-import-statement").dispatchEvent("click"); await page.waitForTimeout(500);
  const before2 = (await ls("arth_txns")).length;
  await T("stmt-paste-toggle").dispatchEvent("click"); await T("stmt-paste-text").fill(pasted); await T("stmt-paste-read").dispatchEvent("click"); await page.waitForTimeout(900);
  const pst = await page.$$eval('[data-testid="stmt-row"]', els => els.map(e => e.getAttribute("data-status")));
  rec("P1 pasted text: 2 items read; the one I already have is a match, not new, the Swiggy one is new", pst.length === 2 && pst.filter(x => x === "new").length === 1, pst);
  rec("P2 the Import button offers 1 row (only the missing one)", /Import 1 row\b/.test(await T("stmt-import").innerText()), await T("stmt-import").innerText());
  await T("stmt-import").dispatchEvent("click"); await page.waitForTimeout(700);
  const after2 = await ls("arth_txns"); const sw = after2.find(t => /swiggy instamart/i.test(t.merchant || t.desc || ""));
  rec("P3 only the missing charge was added: 321.45 expense on the card", after2.length === before2 + 1 && sw && sw.amount === 321.45 && sw.type === "expense", { before2, after: after2.length, sw });
  // ── SMS read from the phone (fake messages through the test hook; the real Android plugin cannot run here) ──
  await page.evaluate(() => { window.__ARTH_SMS_TEST__ = { granted: true, messages: [
    { id: "s1", address: "HDFCBK", date: Date.now() - 86400000, body: "Rs.640.00 spent on ICICI Bank Card XX8004 at BLINKIT on 06-10-26. Avl limit Rs.50,000. Not you? Call 1800" },
    { id: "s2", address: "ICICIB", date: Date.now() - 2 * 86400000, body: "Rs 75.00 spent on ICICI Bank Card XX8004 at CHAI POINT on 05-10-26." },
    { id: "s3", address: "AXISBK", date: Date.now() - 3 * 86400000, body: "Rs 900.00 spent on card XX7777 at SOMEWHERE on 04-10-26." },
    { id: "s4", address: "VM-OTP", date: Date.now() - 3600000, body: "Your OTP is 482913 for Rs 640.00 payment. Do not share." } ] }; });
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(700);
  await T("card-import-statement").dispatchEvent("click"); await page.waitForTimeout(900);
  const smsBtn = await T("stmt-sms-read").innerText();
  rec("M1 'Read SMS from phone' is offered with the quiet count of new messages (2 for this card; the OTP and the other card's message are left out)", /Read SMS from phone · 2 new/.test(smsBtn), smsBtn);
  const before3 = (await ls("arth_txns")).length;
  await T("stmt-sms-read").dispatchEvent("click"); await page.waitForTimeout(900);
  const smst = await page.$$eval('[data-testid="stmt-row"]', els => els.map(e => e.getAttribute("data-status")));
  rec("M2 two messages shown as rows, both new; nothing is added yet", smst.length === 2 && smst.every(x => x === "new") && (await ls("arth_txns")).length === before3, smst);
  await T("stmt-import").dispatchEvent("click"); await page.waitForTimeout(700);
  const after3 = await ls("arth_txns"); const bl = after3.find(t => /blinkit/i.test(t.merchant || t.desc || ""));
  rec("M3 import adds the two charges to the card (Blinkit 640.00 on 2026-10-06 as an expense)", after3.length === before3 + 2 && bl && bl.amount === 640 && bl.date === "2026-10-06" && bl.type === "expense" && bl.accId === "cc1", bl);
  // all accounts at once: a new bank message (savings ····9001), the card's two already-imported ones, and a new card one
  await page.evaluate(() => { window.__ARTH_SMS_TEST__.messages.push(
    { id: "s5", address: "ICICIB", date: Date.now() - 4 * 86400000, body: "Rs 250.00 debited from A/c XX9001 on 03-10-26 to VPA tea@ybl (UPI Ref No 555666777888). Not you? Call bank" },
    { id: "s6", address: "ICICIB", date: Date.now() - 5 * 86400000, body: "Rs.99.00 spent on ICICI Bank Card XX8004 at NETFLIX on 02-10-26." }); });
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(700);
  await T("card-import-statement").dispatchEvent("click"); await page.waitForTimeout(900);
  await T("stmt-sms-all").dispatchEvent("click"); await page.waitForTimeout(900);
  const listTxt = await T("stmt-sms-all-list").innerText();
  rec("M4 scan all: savings ····9001 has 1 new, the card has 1 new (the two earlier imports are not offered again)", /Test Savings ····9001\s*1 new/.test(listTxt) && /Test ICICI Card ····8004\s*1 new/.test(listTxt) && (await T("stmt-sms-add-all").innerText()) === "Add all 2 new", listTxt);
  const before4 = (await ls("arth_txns")).length;
  await T("stmt-sms-add-all").dispatchEvent("click"); await page.waitForTimeout(800);
  const after4 = await ls("arth_txns"); const tea = after4.find(t => t.transactionRef === "555666777888"), nf = after4.find(t => /netflix/i.test(t.merchant || t.desc || ""));
  rec("M5 'Add all' added one entry to each account: savings UPI 250.00 with its reference, card Netflix 99.00", after4.length === before4 + 2 && tea && tea.accId === "bank1" && tea.amount === 250 && nf && nf.accId === "cc1" && nf.amount === 99, { n: after4.length - before4, tea: tea && tea.accId, nf: nf && nf.accId });
  await T("stmt-sms-all-done").locator("button").first().dispatchEvent("click"); await page.waitForTimeout(600);
  const after5 = await ls("arth_txns");
  rec("M6 Undo on one account's batch removes just that account's entry", after5.length === after4.length - 1, after5.length - after4.length);
  // ── old imported bank notices (not real transactions): found, removed in one tap, undo puts them back ──
  await page.evaluate(() => { const t = JSON.parse(localStorage.getItem("arth_txns") || "[]"); t.push(
    { id: "junk1", type: "expense", amount: 1752.75, date: "2026-11-12", accId: "cc1", merchant: "Payment Of Inr 1752.75 Towards Merchant Amazon To Be Debited", desc: "Payment of INR 1752.75 towards Merchant Amazon to be debited", importKey: "cc1|2026-11-12|-175275||x|0", importSource: "bank-statement", catIds: [] },
    { id: "junk2", type: "expense", amount: 22316.4, date: "2026-11-03", accId: "cc1", merchant: "Icici Bank Credit Card Xx1017 Statement Is Sent To Pa********", desc: "", importKey: "cc1|2026-11-03|-2231640||y|0", importSource: "bank-statement", catIds: [] }); localStorage.setItem("arth_txns", JSON.stringify(t)); });
  await page.reload(); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  await T("card-import-statement").dispatchEvent("click"); await page.waitForTimeout(700);
  rec("N1 the 'Not real transactions' box lists the 2 old notices", (await T("stmt-junk").count()) === 1 && /2 imported entries are bank notices/.test(await T("stmt-junk").innerText()), (await T("stmt-junk").innerText()).slice(0, 160));
  const nBefore = (await ls("arth_txns")).length;
  await T("stmt-junk-remove").dispatchEvent("click"); await page.waitForTimeout(600);
  const nAfter = await ls("arth_txns");
  rec("N2 'Remove 2 entries' removes exactly those two, nothing else", nAfter.length === nBefore - 2 && !nAfter.some(t => /^junk/.test(t.id)), { nBefore, after: nAfter.length });
  await T("stmt-junk-undo").dispatchEvent("click"); await page.waitForTimeout(600);
  rec("N3 Undo puts both back", (await ls("arth_txns")).length === nBefore, (await ls("arth_txns")).length);
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);

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
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);

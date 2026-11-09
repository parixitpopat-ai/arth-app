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
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 10000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "cc1", name: "Test ICICI Card", type: "cc", last4: "8004", creditLimit: 100000 }]);
  set("arth_txns", [{ id: "m1", type: "expense", merchant: "Chai Point", desc: "Chai Point", amount: 120, date: "2026-04-03", accId: "bank1", catId: "food", catIds: ["food"] }]);
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
  rec("S3 the chai row is a probable match to the manual entry (3 new, 1 probable)", st.join() === "new,new,new,probable-match", st);
  rec("S4 the card-bill row says it goes to the card; nothing is imported yet", /card bill payment → Test ICICI Card/.test(body) && (await ls("arth_txns")).length === 1, {});
  rec("S5 button says Import 3 rows", /Import 3 rows/.test(await T("stmt-import").innerText()), {});
  await T("stmt-import").click(); await page.waitForTimeout(700);
  const tx = await ls("arth_txns"), imp = tx.filter(x => x.importKey);
  rec("S6 3 transactions added, existing one untouched", imp.length === 3 && tx.length === 4 && tx.find(x => x.id === "m1").merchant === "Chai Point", imp.map(x => x.type));
  const exp = imp.find(x => x.type === "expense"), inc = imp.find(x => x.type === "income"), cc = imp.find(x => x.type === "cc_payment");
  rec("S7 expense 670.01 'Pax Inno' uncategorised; income 50000; card payment 2500 bank1->cc1", exp && exp.amount === 670.01 && exp.merchant === "Pax Inno" && exp.catIds.length === 0 && inc && inc.amount === 50000 && cc && cc.amount === 2500 && cc.fromAccId === "bank1" && cc.toAccId === "cc1", imp);
  rec("S8 done card shown with Undo", (await T("stmt-done").count()) === 1, {});
  // re-import the same file: nothing new
  await page.reload(); await page.waitForTimeout(1200); await open(); await load(csv);
  const st2 = await page.locator('[data-testid="stmt-row"]').evaluateAll(els => els.map(e => e.dataset.status));
  rec("S9 importing the same file again: the 3 are 'imported before', Import is disabled", st2.filter(s => s === "already-imported").length === 3 && (await T("stmt-import").isDisabled()), st2);
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
  rec("S13 Undo removes exactly the imported 3 and leaves the manual entry", after.length === 1 && after[0].id === "m1", after.length);
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);

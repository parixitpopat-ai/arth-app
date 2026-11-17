// Card statement preview: a CREDIT row (refund) can be recorded, linked to the purchase it returns, with Undo; the same file again no longer offers it.
// SYNTHETIC statement file and data, real app in Chromium. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 4234, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const dir = mkdtempSync(join(tmpdir(), "stmt-")); const csv = join(dir, "card.csv"), csv2 = join(dir, "card2.csv");
writeFileSync(csv, ["Date,SerNo.,Transaction Details,Amount (in₹)", "12/11/2026,1,AMAZON INDIA CYBS SI MUMBAI IN,1752.75", "12/11/2026,2,AMAZON INDIA CYBS SI MUMBAI IN,1752.75 CR", "13/11/2026,3,UNKNOWN CREDIT VOUCHER,99.00 CR"].join("\n"));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "cc1", name: "Test Amazon Card", type: "cc", last4: "1017", creditLimit: 100000 }]);
  set("arth_txns", [{ id: "amz", type: "expense", merchant: "Amazon", desc: "Amazon", amount: 1752.75, date: "2026-11-12", accId: "cc1", catId: "shopping", catIds: ["shopping"] }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
const open = async () => { await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  await T("card-import-statement").dispatchEvent("click"); await page.waitForTimeout(500); };
try {
  await open(); await T("stmt-file").setInputFiles(csv); await page.waitForTimeout(1800);
  const offers = await T("stmt-refund-offer").allInnerTexts();
  rec("R1 the credit row of ₹1,752.75 offers 'Record as a refund' of the Amazon purchase of 12-11-2026", offers.length === 1 && /Amazon/.test(offers[0]) && /12-11-2026/.test(offers[0]) && /1,752\.75/.test(offers[0]), offers);
  rec("R2 a credit with no matching purchase (₹99 voucher) says so, offers no button, and tells how to add it by hand", (await T("stmt-refund-none").count()) === 1 && /Add, money in, tag it/.test(await T("stmt-refund-none").innerText()), {});
  rec("R3 nothing was added just by reading the file", (await ls("arth_txns")).length === 1, {});
  await T("stmt-refund-record").click(); await page.waitForTimeout(800);
  const txns = await ls("arth_txns"); const rf = txns.find(t => t.type === "settlement_in");
  rec("R4 a refund of ₹1,752.75 on the card, dated 12-11-2026, linked to the Amazon purchase, carrying the statement row's key", txns.length === 2 && rf && rf.isRefund === true && rf.amount === 1752.75 && rf.accId === "cc1" && rf.date === "2026-11-12" && rf.againstTxnId === "amz" && Boolean(rf.importKey), rf && { amount: rf.amount, acc: rf.accId, against: rf.againstTxnId, date: rf.date });
  rec("R5 the row shows '✓ Refund recorded against Amazon' with Undo", /Refund recorded against Amazon/.test(await T("stmt-refund-done").innerText().catch(() => "")) && (await T("stmt-refund-undo").count()) === 1, {});
  const flagged = await T("stmt-arth-only-row").allInnerTexts();
  rec("R6 the refund just recorded is not flagged as 'in Arth, not on the statement'", !flagged.some(f => /Amazon/.test(f) && /1,752\.75/.test(f) && /Refund|refund/.test(f)) && (await T("stmt-arth-only-row").count()) === 0, flagged);
  await T("stmt-refund-undo").click(); await page.waitForTimeout(700);
  rec("R7 Undo takes the refund back (only the purchase is left) and the offer returns", (await ls("arth_txns")).length === 1 && (await T("stmt-refund-offer").count()) === 1, {});
  await T("stmt-refund-record").click(); await page.waitForTimeout(700);
  await page.reload(); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await open(); await T("stmt-file").setInputFiles(csv); await page.waitForTimeout(1800);
  const st = await page.locator('[data-testid="stmt-row"]').evaluateAll(els => els.map(e => e.dataset.status));
  rec("R8 the same file again: the refund row is recognised (no longer new), so no second offer for it", (await T("stmt-refund-offer").count()) === 0 && st.filter(s => s === "new").length === 1, st);
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);

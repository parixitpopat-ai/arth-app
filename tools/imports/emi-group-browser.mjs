// A card EMI instalment printed as three statement rows (principal, interest, GST) is ONE item: recorded as one instalment of the card's plan, or linked to an
// entry you already have, never added as three expenses. SYNTHETIC data (invented figures), real app in Chromium. A CHROMIUM check only, not a phone.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";
const PORT = 4261, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const dir = mkdtempSync(join(tmpdir(), "emi-"));
const ct = (str, x, y, size = 7) => ({ str, x, y, size });
const cright = (s, y) => ct(s, 590 - s.length * 3.6, y);
const pdf = makePdf([{ texts: [
  ct("STATEMENT DATE", 90, 700), ct("October 16, 2026", 88, 682), ct("PAYMENT DUE DATE", 82, 650), ct("November 3, 2026", 88, 632), ct("Total Amount due", 90, 580), ct("₹2,535.40", 105, 562), ct("Minimum Amount due", 84, 520), ct("₹100.00", 105, 502), ct("Dining-100%", 40, 390),
  ct("Previous Balance", 340, 560, 6), ct("₹0.00", 346, 545, 6), ct("Purchases / Charges", 395, 560, 6), ct("₹2,535.40", 412, 545, 6), ct("Cash Advances", 468, 560, 6), ct("₹0.00", 480, 545, 6), ct("Payments / Credits", 523, 560, 6), ct("₹0.00", 532, 545, 6),
  ct("Date", 40, 420), ct("SerNo.", 95, 420), ct("Transaction Details", 150, 420), ct("Reward", 505, 420), ct("Points", 507, 411), ct("Amount (in₹)", 545, 420),
  ct("05/10/2026", 40, 380), ct("14308206001", 95, 380), ct("Interest Amount Amortization - <3/6>SAMPLE STORE PVT LTD", 150, 380), cright("30.00", 380),
  ct("05/10/2026", 40, 365), ct("14308206002", 95, 365), ct("IGST-CI@18%", 150, 365), cright("5.40", 365),
  ct("05/10/2026", 40, 350), ct("14308206003", 95, 350), ct("Principal Amount Amortization - <3/6>SAMPLE STORE PVT LTD", 150, 350), cright("2,500.00", 350)] }]);
const file = join(dir, "emi.pdf"); writeFileSync(file, pdf);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const PLAN = { id: "pl1", name: "Sample EMI", cardId: "cc1", totalAmount: 15212.4, tenure: 6, monthlyAmount: 2535.4, interestRate: 14, startDate: "2026-08-05", catId: "shopping", catIds: ["shopping"], status: "active" };
const inst = (id, n, date) => ({ id, type: "cc_emi", accId: "cc1", ccEmiPlanId: "pl1", installmentNo: n, ccEmiTenure: 6, amount: 2535.4, date, merchant: "Sample EMI", desc: `Sample EMI · ${n}/6`, catId: "shopping", catIds: ["shopping"], people: {}, trackingMode: "none" });
async function scenario(txns, plans, fn) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
  await ctx.addInitScript(([txns, plans]) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "cc1", name: "Test Card", type: "cc", last4: "8004", creditLimit: 100000, statementDay: 16, dueDay: 3 }]);
    set("arth_txns", txns); set("arth_cc_emi_plans", plans); set("arth_bills", []);
    localStorage.setItem("arth_master_user_setup_complete", "true"); }, [txns, plans]);
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  const T = id => page.getByTestId(id);
  const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
  const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
  const open = async () => { await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
    await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
    await T("card-import-statement").dispatchEvent("click"); await page.waitForTimeout(500); await T("stmt-file").setInputFiles(file); await page.waitForTimeout(2300); };
  try { await fn({ page, T, ls, open, errors }); } catch (e) { rec("RUN", false, String(e).slice(0, 500)); }
  rec("Z no page errors", errors.length === 0, errors.slice(0, 2)); await ctx.close();
}
try {
  // S1: the plan exists with instalments 1 and 2 recorded; instalment 3 is not in Arth
  await scenario([inst("i1", 1, "2026-08-05"), inst("i2", 2, "2026-09-05")], [PLAN], async ({ page, T, ls, open }) => {
    await open();
    const rows = await T("stmt-row").count(), st = await T("stmt-row").first().getAttribute("data-status");
    rec("S1.1 the three rows show as ONE item, new", rows === 1 && st === "new", { rows, st });
    rec("S1.2 it shows the breakup and says it will be recorded as instalment 3 of the plan, principal not new spending", /Principal ₹2,500\.00 · Interest ₹30\.00 · GST ₹5\.40/.test(await T("stmt-emi-breakup").innerText()) && /instalment 3 of "Sample EMI"/.test(await T("stmt-emi-note").innerText()) && /not new spending/.test(await T("stmt-emi-note").innerText()), await T("stmt-emi-note").innerText());
    rec("S1.3 it is ticked by default, and the total is ₹2,535.40", await T("stmt-row").first().locator("input[type=checkbox]").isChecked() && /2,535\.40/.test(await T("stmt-row").first().innerText()), {});
    await T("stmt-import").click(); await page.waitForTimeout(900);
    const t = await ls("arth_txns"), made = t.filter(x => x.importBatchId);
    rec("S1.4 ONE instalment entry of 2,535.40, number 3 of 6, on its plan, with the breakup inside, and no separate expenses", made.length === 1 && made[0].type === "cc_emi" && made[0].amount === 2535.4 && made[0].installmentNo === 3 && made[0].ccEmiTenure === 6 && made[0].ccEmiPlanId === "pl1" && made[0].emiBreakup.principal === 2500 && made[0].emiBreakup.interest === 30 && made[0].emiBreakup.gst === 5.4 && !t.some(x => x.type === "expense"), made);
    rec("S1.5 all three statement rows are remembered on it", Array.isArray(made[0].importKeys) && made[0].importKeys.length === 3, made[0].importKeys && made[0].importKeys.length);
    await open();
    rec("S1.6 importing the same file again: the item is locked as already imported", (await T("stmt-row").count()) === 1 && (await T("stmt-row").first().getAttribute("data-status")) === "already-imported" && (await T("stmt-row").first().locator("input[type=checkbox]").isDisabled()), {});
    // after reload the breakup survives
    await page.reload(); await page.waitForTimeout(900);
    rec("S1.7 the breakup is still on the entry after a reload", (await ls("arth_txns")).some(x => x.emiBreakup && x.emiBreakup.gst === 5.4), {});
  });
  // S2: the instalment was entered by hand as ONE plain expense of the same total on the same day
  await scenario([inst("i1", 1, "2026-08-05"), inst("i2", 2, "2026-09-05"), { id: "mine", type: "expense", accId: "cc1", amount: 2535.4, date: "2026-10-05", merchant: "My own name", desc: "My own name", catId: "lifestyle", catIds: ["lifestyle"], note: "mine", people: {} }], [PLAN], async ({ page, T, ls, open }) => {
    await open();
    rec("S2.1 one item, a probable match to the plain entry, unticked", (await T("stmt-row").count()) === 1 && (await T("stmt-row").first().getAttribute("data-status")) === "probable-match" && !(await T("stmt-row").first().locator("input[type=checkbox]").isChecked()), {});
    rec("S2.2 it says merge links all three rows and changes nothing else", /Merge links all three rows/.test(await T("stmt-emi-note").innerText()), await T("stmt-emi-note").innerText());
    await T("stmt-merge").click(); await page.waitForTimeout(300);
    await T("stmt-import").click(); await page.waitForTimeout(900);
    const t = await ls("arth_txns"), mine = t.find(x => x.id === "mine");
    rec("S2.3 your entry keeps its name, type, category, note and amount; it gains all three keys and the breakup", mine.merchant === "My own name" && mine.type === "expense" && mine.note === "mine" && mine.amount === 2535.4 && mine.catId === "lifestyle" && mine.importKeys.length === 3 && mine.emiBreakup.interest === 30, mine);
    rec("S2.4 nothing new was created", t.length === 3, t.length);
  });
  // S3: no EMI plan on this card
  await scenario([], [], async ({ page, T, ls, open }) => {
    await open();
    rec("S3.1 one item that cannot be added, saying why (not added as three expenses)", (await T("stmt-row").count()) === 1 && (await T("stmt-row").first().locator("input[type=checkbox]").isDisabled()) && /No EMI plan on this card/.test(await T("stmt-emi-note").innerText()), await T("stmt-emi-note").innerText());
    rec("S3.2 the import button has nothing to import", await T("stmt-import").isDisabled(), {});
    rec("S3.3 no entries were created", (await ls("arth_txns")).length === 0, {});
  });
} catch (e) { rec("RUN", false, String(e).slice(0, 500)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
console.log(results.every(r => r.pass) ? "ALL PASS" : "SOME FAILED"); process.exit(results.every(r => r.pass) ? 0 : 1);

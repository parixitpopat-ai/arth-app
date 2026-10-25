// PURCHASE-ENTRY-001 §16.9 gate G2/G3 in the REAL app (Chromium, local Vite server, SYNTHETIC data, TESTS ONLY — nothing here writes the new fields).
// An invented `purchase` field sits on one loan and an invented `emiLoanId` on the down-payment expense. The loan is edited through the app's own edit form;
// a second loan WITHOUT the field is edited too. Setup: npx vite --port 5210 --strictPort &    Run: node tools/emi/loan-gate-browser.mjs
// This is a CHROMIUM check. It says nothing about the Android app.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const APP = process.env.NL_APP || "http://localhost:5210/";
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const PURCHASE = { v: 1, tenure: 6, purchaseValuePaise: 3000000 };
const loan = (id, name, extra = {}) => ({ id, direction: "taken", name, principal: 24000, outstanding: 24000, startDate: "2026-10-01", dueDate: "2026-11-01", dueDay: 1, tenureMonths: 6, emiAmount: 4000, hasInterest: false, interestRate: 0, sourceType: "bank", paymentMode: "emi", isEmiPlan: true, status: "active", repayments: [], ...extra });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ timezoneId: "Asia/Kolkata", viewport: { width: 420, height: 1100 } });
await ctx.route(u => { try { return !["localhost", "127.0.0.1"].includes(new URL(u).hostname); } catch { return false; } }, r => r.abort());
await ctx.addInitScript(([loans, txns]) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  localStorage.setItem("arth_accounts", JSON.stringify([{ id: "b1", name: "Test Bank", type: "bank", openingBalance: 500000, openingBalanceDate: "2026-01-01", last4: "9001" }]));
  localStorage.setItem("arth_txns", JSON.stringify(txns)); localStorage.setItem("arth_loans", JSON.stringify(loans));
  localStorage.setItem("arth_master_user_setup_complete", "true"); localStorage.setItem("arth_vehicles", "[]"); },
  [[loan("L1", "Phone EMI", { purchase: PURCHASE }), loan("L2", "Laptop EMI")], [{ id: "t-down", type: "expense", merchant: "Phone", desc: "Phone", date: "2026-10-01", amount: 6000, accId: "b1", catId: "shopping", catIds: ["shopping"], emiLoanId: "L1" }]]);
const page = await ctx.newPage(); page.setDefaultTimeout(6000); const errors = []; page.on("pageerror", e => errors.push(String(e)));
await page.goto(APP); await page.waitForTimeout(1200);
for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(120); } await page.waitForTimeout(500); } }
const ls = k => page.evaluate(x => JSON.parse(localStorage.getItem(x) || "null"), k);
const editEmi = async (name, value) => {
  await page.getByText("MONEY REQUIRED", { exact: false }).first().click(); await page.waitForTimeout(700);
  await page.getByText(name).first().click(); await page.waitForTimeout(600);
  const inp = page.locator("input").nth(6); await inp.fill(value);
  await page.getByRole("button", { name: "Save Loan" }).click(); await page.waitForTimeout(700);
  await page.getByText("HOME", { exact: false }).last().click().catch(() => {}); await page.waitForTimeout(500);
};
const before = await ls("arth_loans"), txBefore = await ls("arth_txns");
await editEmi("Phone EMI", "4100");
let loans = await ls("arth_loans"); const l1 = loans.find(l => l.id === "L1");
rec("G2a editing a loan through the app's own form keeps the unknown field and changes the field edited", l1 && l1.emiAmount === 4100 && JSON.stringify(l1.purchase) === JSON.stringify(PURCHASE), { emi: l1 && l1.emiAmount, purchase: l1 && l1.purchase });
rec("G2b the same edit changes no other known field (principal, tenure, status, repayments, id)", l1 && l1.principal === 24000 && l1.tenureMonths === 6 && l1.status === "active" && l1.repayments.length === 0 && l1.id === "L1", {});
const tx = await ls("arth_txns");
rec("G2c the down-payment expense, its amount and its reference are untouched by the loan edit", JSON.stringify(tx.find(t => t.id === "t-down")) === JSON.stringify(txBefore.find(t => t.id === "t-down")), {});
await editEmi("Laptop EMI", "4200");
loans = await ls("arth_loans"); const l2 = loans.find(l => l.id === "L2");
rec("G2d editing a loan WITHOUT the field does not invent one", l2 && l2.emiAmount === 4200 && !("purchase" in l2) && !("emiLoanId" in l2), { keys: l2 && Object.keys(l2).length });
rec("G2e still exactly two loans, none duplicated or dropped", loans.length === 2, { n: loans.length });
rec("G3 the loans reload from storage with the field intact (restore path normaliser)", await (async () => { await page.reload(); await page.waitForTimeout(1200); const again = await ls("arth_loans"); return JSON.stringify(again.find(l => l.id === "L1").purchase) === JSON.stringify(PURCHASE); })(), {});
rec("no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close();
const bad = results.filter(r => !r.pass); console.log(`\n${results.length - bad.length}/${results.length} passed`); process.exit(bad.length ? 1 : 0);

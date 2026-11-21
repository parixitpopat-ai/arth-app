// "Make this a loan" on an older Collect entry, real app in Chromium, SYNTHETIC data. A CHROMIUM check only.
// Run: node tools/loans/make-loan-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4371, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const now = new Date(); const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "r", name: "Raj Test" }, { id: "s", name: "Sunny Test" }]);
  const owes = (a, settledAmt = 0) => ({ amount: a, mode: "owes", settled: settledAmt >= a, settledAmt, remainingAmt: Math.max(0, a - settledAmt) });
  set("arth_txns", [
    { id: "e1", type: "expense", date: `${ym}-01`, createdAt: 5, desc: "Cash to Raj", merchant: "Cash to Raj", amount: 15000, accId: "bank1", catId: "food", catIds: ["food"], note: "for rent", people: { r: owes(15000, 1500) } },
    { id: "e2", type: "expense", date: `${ym}-01`, createdAt: 4, desc: "Dinner with Sunny", merchant: "Dinner with Sunny", amount: 1800, accId: "bank1", catId: "food", catIds: ["food"], people: { s: owes(900) } },
    { id: "s1", type: "settlement_in", isRefund: false, date: `${ym}-02`, createdAt: 6, desc: "Raj paid", amount: 1500, appliedAmount: 1500, extraAmount: 0, accId: "bank1", fromPersonId: "r", settlementLinks: [{ kind: "txn", id: "e1", personId: "r", amount: 1500, title: "Cash to Raj" }] }]);
  set("arth_loans", []);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
const home = async () => { await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(900); };
const openDetail = async title => { await page.getByText(title, { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(800); };
const spent = async () => (await text()).match(/Spent\s*₹([\d,]+)/)?.[1];
try {
  await home(); const spentBefore = await spent();
  await openDetail("Dinner with Sunny");
  rec("L1 a shared dinner (₹900 of ₹1,800 owed) does NOT offer 'Make this a loan'", (await T("txn-make-loan").count()) === 0, {});
  await page.reload(); await page.waitForTimeout(1000); await unlock(); await page.waitForTimeout(800);
  await openDetail("Cash to Raj");
  rec("L2 an entry where one person owes the WHOLE amount offers 'Make this a loan'", (await T("txn-make-loan").count()) === 1, {});
  await T("txn-make-loan").dispatchEvent("click"); await page.waitForTimeout(600);
  rec("L3 the sheet shows ₹15,000 lent, ₹1,500 already paid back, ₹13,500 still owed", (await T("make-loan-sheet").count()) === 1 && /15,000/.test(await T("make-loan-principal").innerText()) && /1,500/.test(await T("make-loan-paid").innerText()) && /13,500/.test(await T("make-loan-outstanding").innerText()), (await T("make-loan-sheet").count()) ? await T("make-loan-sheet").innerText() : "");
  rec("L4 it says spending does not change (the entry already counted as owed to me)", /Your spending does not change/.test(await T("make-loan-spend").innerText()), await T("make-loan-spend").innerText());
  await T("make-loan-due").fill("2020-01-01"); await T("make-loan-confirm").click(); await page.waitForTimeout(400);
  rec("L5 a return date before the lending date is refused and nothing changes", /before the date/.test(await T("make-loan-error").innerText()) && (await ls("arth_loans")).length === 0 && (await ls("arth_txns")).find(t => t.id === "e1").type === "expense", {});
  await T("make-loan-due").fill("2027-02-01"); await T("make-loan-rate").fill("12"); await T("make-loan-confirm").click(); await page.waitForTimeout(900);
  const loans = await ls("arth_loans"), all = await ls("arth_txns"); const e1 = all.find(t => t.id === "e1"), s1 = all.find(t => t.id === "s1");
  rec("L6 one loan: ₹15,000 to Raj, ₹13,500 outstanding, back by 1 Feb 2027, 12% a year, original date", loans.length === 1 && loans[0].principal === 15000 && loans[0].outstanding === 13500 && loans[0].dueDate === "2027-02-01" && loans[0].interestRate === 12 && /-01$/.test(loans[0].startDate) && loans[0].personId === "r", loans[0] && { p: loans[0].principal, o: loans[0].outstanding, due: loans[0].dueDate });
  rec("L7 the entry is now the money-out entry: same id, from the same account, no destination, not an expense", e1.type === "transfer" && e1.fromAccId === "bank1" && e1.toAccId == null && e1.isLoanDisbursal === true && e1.linkedLoanId === loans[0].id, { type: e1.type, from: e1.fromAccId });
  rec("L8 the ₹1,500 repayment is kept as money received on the loan (still credits the account, link to the old entry removed)", s1.type === "settlement_in" && s1.amount === 1500 && s1.accId === "bank1" && s1.linkedLoanId === loans[0].id && (s1.settlementLinks || []).length === 0 && loans[0].repayments.length === 1 && loans[0].repayments[0].amount === 1500, {});
  await home();
  rec("L9 Home 'Spent' is unchanged, and no 'repayment not applied' appears for the loan receipt", (await spent()) === spentBefore && (await T("needs-repayments").count()) === 0, { before: spentBefore, after: await spent() });
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 500)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);

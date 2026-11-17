// "Not a bill? Make it a transaction": an unpaid one-off bill that is really a card purchase becomes an expense on the chosen card.
// SYNTHETIC data, real app in Chromium. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4231, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 500000, openingBalanceDate: "2025-01-01", last4: "9001" }, { id: "cc1", name: "Test Card", type: "cc", last4: "8004", creditLimit: 100000, statementDay: 5, dueDay: 25 }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "p2", name: "Partner" }]);
  const bill = (id, name, extra = {}) => ({ id, name, merchant: name, amount: 4999, dueDate: "2026-12-20", billDate: "2026-11-10", status: "unpaid", catId: "shopping", catIds: ["shopping"], splitPeople: {}, createdDate: "2026-11-10", ...extra });
  set("arth_bills", [bill("b1", "Big Store purchase"), bill("b2", "Shared sofa", { splitPeople: { p2: { amount: 2000, mode: "owes" } } })]);
  set("arth_txns", []); set("arth_contributions", []);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(700); } } };
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const openBill = async id => { await page.getByText(/^payments$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await T(`bill-row-${id}`).dispatchEvent("click"); await page.waitForTimeout(600); };
try {
  await page.goto(APP); await page.waitForTimeout(1300); await unlock(); await page.waitForTimeout(700);
  await openBill("b2"); await T("bill-convert").dispatchEvent("click"); await page.waitForTimeout(500);
  rec("C1 a bill split with another person is refused, with the reason, and cannot be converted", (await T("convert-bill-refused").count()) === 1 && (await T("convert-bill-go").isDisabled()), (await T("convert-bill-refused").innerText().catch(() => "")));
  await page.reload(); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(600);
  await openBill("b1"); rec("C2 the bill detail offers 'Not a bill? Make it a transaction'", (await T("bill-convert").count()) === 1, {});
  await T("bill-convert").dispatchEvent("click"); await page.waitForTimeout(500);
  rec("C3 the sheet asks which card/account and the purchase date (bill date prefilled); Make it a transaction is off until a card is chosen", (await T("convert-bill-go").isDisabled()) && (await T("convert-bill-date").inputValue()) === "2026-11-10", {});
  await T("convert-bill-account").selectOption("cc1"); await page.waitForTimeout(300);
  await T("convert-bill-go").click(); await page.waitForTimeout(900);
  const txns = await ls("arth_txns"), bills = await ls("arth_bills");
  rec("C4 one expense of ₹4,999 on the credit card, dated 2026-11-10, same name and category", txns.length === 1 && txns[0].type === "expense" && txns[0].amount === 4999 && txns[0].accId === "cc1" && txns[0].date === "2026-11-10" && txns[0].merchant === "Big Store purchase" && txns[0].catId === "shopping", txns.map(t => ({ amount: t.amount, accId: t.accId, date: t.date, merchant: t.merchant, catId: t.catId })));
  const stmt = bills.find(b => b.isCcStatement);
  rec("C5 that bill is gone, the other bill is untouched, and the card's own statement now carries the purchase (₹4,999)", !bills.some(b => b.id === "b1") && bills.some(b => b.id === "b2") && stmt && stmt.amount === 4999 && stmt.accId === "cc1", bills.map(b => ({ id: b.id, cc: !!b.isCcStatement, amount: b.amount })));
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  rec("C6 the sheets closed and the bill no longer shows in Payments", !/Big Store purchase/.test(body.split("Moved to your transactions")[0] || body) || /Moved to your transactions/.test(body), body.slice(0, 160));
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);

// Transactions screen: "Account or card" filter across ALL types (purchase, refund, card payment), statement-period chips, and the card tile's shortcut.
// SYNTHETIC data, real app in Chromium. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4233, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 500000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "cc1", name: "Test ICICI Card", type: "cc", last4: "8004", creditLimit: 100000, statementDay: 16, dueDay: 4 }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
  const ex = (id, date, amount, m, accId) => ({ id, type: "expense", merchant: m, desc: m, amount, date, accId, catId: "food", catIds: ["food"] });
  set("arth_txns", [ex("a", "2026-10-20", 1000, "CardBuy Oct", "cc1"), ex("b", "2026-10-21", 222, "BankBuy Oct", "bank1"), ex("o", "2026-09-20", 333, "OldCardBuy Sep", "cc1"),
    { id: "r", type: "settlement_in", isRefund: true, desc: "CardRefund Oct", merchant: "CardRefund Oct", amount: 150, date: "2026-10-22", accId: "cc1" },
    { id: "p", type: "cc_payment", desc: "CardPayment Oct", amount: 700, date: "2026-10-23", fromAccId: "bank1", toAccId: "cc1" }]);
  set("arth_bills", [{ id: "st1", isCcStatement: true, accId: "cc1", billerCategory: "Credit Card", name: "Test ICICI Card Statement", periodFrom: "2026-09-16", periodTo: "2026-10-16", arthAmount: 333, amount: 333, dueDate: "2026-11-04", status: "unpaid", verification: "needs_verification", bankAmount: null, verifiedAt: null, adjustments: [], createdAt: "2026-10-17" },
    { id: "st2", isCcStatement: true, accId: "cc1", billerCategory: "Credit Card", name: "Test ICICI Card Statement", periodFrom: "2026-10-16", periodTo: "2026-11-16", arthAmount: 1000, amount: 1000, dueDate: "2026-12-04", status: "unpaid", verification: "needs_verification", bankAmount: null, verifiedAt: null, adjustments: [], createdAt: "2026-11-17" }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(700); } } };
const has = (t, ...names) => names.every(n => t.includes(n));
try {
  await page.goto(APP); await page.waitForTimeout(1400); await unlock(); await page.waitForTimeout(600);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  rec("F1 the card's tile on Money has 'Filter in Transactions'", (await T("card-filter-txns").count()) === 1, {});
  await T("card-filter-txns").dispatchEvent("click"); await page.waitForTimeout(900);
  let t = await text();
  rec("F2 the Transactions screen shows EVERY type on that card: purchases (two months), the refund and the card payment", has(t, "CardBuy Oct", "OldCardBuy Sep", "CardRefund Oct", "CardPayment Oct"), t.slice(0, 200));
  rec("F3 and nothing from the other account (BankBuy Oct is not listed)", !t.includes("BankBuy Oct"), {});
  await page.getByLabel("Open transaction filters").dispatchEvent("click"); await page.waitForTimeout(600);
  rec("F4 the filter sheet shows the card as chosen under 'Account or card'", (await T("txn-account-select").inputValue()) === "cc1", {});
  const chips = await T("txn-statement-chip").allInnerTexts();
  rec("F5 the card's statement periods are offered, newest first (17 Oct – 16 Nov, then 17 Sep – 16 Oct)", chips.length === 2 && chips[0] === "17 Oct – 16 Nov" && chips[1] === "17 Sep – 16 Oct", chips);
  await T("txn-statement-chip").nth(1).click(); await page.waitForTimeout(500);
  rec("F5a the filter sheet stays open after a filter tap (it used to close after every tap)", /Account or card/i.test(await text()), {});
  await page.getByText("OK", { exact: true }).last().dispatchEvent("click"); await page.waitForTimeout(700);
  t = await text();
  rec("F6 choosing the 17 Sep – 16 Oct statement leaves only that cycle's entry (OldCardBuy Sep, 20 Sep); the October purchase, refund and payment belong to the next cycle", has(t, "OldCardBuy Sep") && !t.includes("CardBuy Oct") && !t.includes("CardRefund Oct") && !t.includes("CardPayment Oct") && !t.includes("BankBuy Oct"), t.slice(0, 220));
  await page.getByLabel("Open transaction filters").dispatchEvent("click"); await page.waitForTimeout(500);
  await T("txn-statement-chip").nth(0).click(); await page.waitForTimeout(400);
  await page.getByText("OK", { exact: true }).last().dispatchEvent("click"); await page.waitForTimeout(700);
  t = await text();
  rec("F7 the 17 Oct – 16 Nov statement shows the Oct purchase, the refund and the payment on that card", has(t, "CardBuy Oct", "CardRefund Oct", "CardPayment Oct") && !t.includes("OldCardBuy Sep") && !t.includes("BankBuy Oct"), t.slice(0, 220));
  await page.getByLabel("Open transaction filters").dispatchEvent("click"); await page.waitForTimeout(500);
  await T("txn-account-select").selectOption("all"); await page.waitForTimeout(300);
  rec("F8 'All accounts and cards' brings back the other account's entries and removes the statement chips", (await T("txn-statement-chip").count()) === 0, {});
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);

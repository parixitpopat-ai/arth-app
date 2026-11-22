// Card limits (total + per card, EMI still to bill counted as used) and card spending not yet billed in Money Required. SYNTHETIC data, real app in Chromium. CHROMIUM check only.
// Run: node tools/cards/card-limits-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4461, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 1100 }, timezoneId: "Asia/Kolkata" });
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// Card 1: statement closes tomorrow, due 6 days later, so what is unbilled today falls due inside Money Required's 30 days.
const stmtDay = day(1).getDate(), dueDay = day(6).getDate();
await ctx.addInitScript(([stmtDay, dueDay, today, nextMonthDate]) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 300000, openingBalanceDate: "2026-01-01" },
    { id: "cc1", name: "Coral RuPay", type: "cc", limit: 200000, outstanding: 0, statementDate: stmtDay, dueDate: dueDay },
    { id: "cc2", name: "Second Card", type: "cc", limit: 100000, outstanding: 0, statementDate: stmtDay, dueDate: dueDay }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
  set("arth_txns", [{ id: "u1", type: "expense", desc: "TV down payment", date: today, amount: 6000, accId: "cc1", catId: "shopping", catIds: ["shopping"] }]);
  set("arth_loans", [{ id: "L1", direction: "taken", name: "TV", principal: 54000, outstanding: 48000, startDate: today, dueDate: nextMonthDate, emiAmount: 6000, tenureMonths: 9, paymentAccId: "cc1", sourceType: "cc", paymentMode: "emi", isEmiPlan: true, autoScheduled: true, scheduledInstallmentIds: [], status: "active", repayments: [] }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); }, [stmtDay, dueDay, ymd(new Date()), ymd(day(30))]);
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
try {
  await page.goto(APP); await page.waitForTimeout(1400); await unlock(); await page.waitForTimeout(600);
  const home = await text();
  rec("M1 Home's Money Required includes the ₹6,000 spent on the card and not yet billed", /MONEY REQUIRED ₹6,000/.test(home), (home.match(/MONEY REQUIRED ₹[\d,]+/) || [""])[0]);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(500);
  rec("L1 Money shows one box for all cards: total limit ₹3,00,000", (await T("card-limits").count()) === 1 && /3,00,000/.test(await T("card-limits").innerText()), (await T("card-limits").innerText()).replace(/\s+/g, " ").slice(0, 200));
  const box = (await T("card-limits").innerText()).replace(/\s+/g, " ");
  rec("L2 used = ₹6,000 unbilled + ₹48,000 EMI still to bill = ₹54,000 (18%), available ₹2,46,000", /54,000/.test(box) && /18%/.test(box) && /2,46,000/.test(box), box);
  rec("L3 each card shows its own use: Coral RuPay ₹54,000 of ₹2,00,000 (27%), the other ₹0", /54,000 of ₹2,00,000 · 27%/.test((await T("card-limit-cc1").innerText()).replace(/\s+/g, " ")) && /0 of ₹1,00,000 · 0%/.test((await T("card-limit-cc2").innerText()).replace(/\s+/g, " ")), {});
  rec("L4 the card's own row names the EMI still to bill", /EMI still to bill:?\s*₹48,000/.test(await text()), {});
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);

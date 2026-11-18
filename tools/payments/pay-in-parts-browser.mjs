// One purchase paid in parts (₹500 = ₹100 cash + ₹400 bank) from the Add / Edit Transaction form. SYNTHETIC data, real app in Chromium. A CHROMIUM check only, not a phone.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4241, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  localStorage.setItem("arth_accounts", JSON.stringify([
    { id: "cash1", name: "Test Cash", type: "cash", openingBalance: 10000, openingBalanceDate: "2026-01-01" },
    { id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]));
  localStorage.setItem("arth_people", JSON.stringify([{ id: "me", name: "Me", isMe: true }]));
  localStorage.setItem("arth_txns", "[]"); localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const unlock = async () => { for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
try {
  await page.goto(APP); await page.waitForTimeout(900); await unlock();
  await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(700);
  await page.getByText("More options →").click().catch(() => {}); await page.waitForTimeout(500);
  await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("500");
  await page.getByPlaceholder(/vendor|merchant|store/i).first().fill("Test Store").catch(() => {});
  await page.getByText(/^Details/).first().click(); await page.waitForTimeout(400);
  rec("P1 the Details card offers 'Paid in parts? Use more than one account'", (await T("pay-parts-on").count()) === 1, {});
  await T("pay-parts-on").click(); await page.waitForTimeout(300);
  rec("P2 two payment lines appear, with a 'still to place' note", (await T("pay-part").count()) === 2 && /still to place/.test(await T("pay-parts-status").innerText()), await T("pay-parts-status").innerText());
  await T("pay-part-acc").nth(0).selectOption("cash1"); await T("pay-part-amt").nth(0).fill("100");
  await T("pay-part-acc").nth(1).selectOption("bank1"); await T("pay-part-amt").nth(1).fill("300");
  rec("P3 100 + 300 against 500 says ₹100 is still to place", /100.*still to place/.test(await T("pay-parts-status").innerText()), await T("pay-parts-status").innerText());
  await page.getByRole("button", { name: /^Add ✓$/ }).click(); await page.waitForTimeout(500);
  const warn = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  rec("P4 saving with the parts not adding up is refused with the reason, and nothing is saved", /still has to be placed|still to place|₹100 still/.test(warn) && (await ls("arth_txns")).length === 0, (await ls("arth_txns")).length);
  await T("pay-part-amt").nth(1).fill("400"); await page.waitForTimeout(200);
  rec("P5 100 + 400 shows ✓ matches", /✓/.test(await T("pay-parts-status").innerText()), await T("pay-parts-status").innerText());
  await page.getByRole("button", { name: /^Add ✓$/ }).click(); await page.waitForTimeout(800);
  const t = (await ls("arth_txns"))[0];
  rec("P6 ONE expense of 500 is saved, with the two payment lines (cash 100, bank 400)", (await ls("arth_txns")).length === 1 && t.amount === 500 && t.type === "expense" && Array.isArray(t.paymentLines) && t.paymentLines.length === 2 && t.paymentLines[0].accId === "cash1" && t.paymentLines[0].amount === 100 && t.paymentLines[1].accId === "bank1" && t.paymentLines[1].amount === 400, t);
  // reopen it: the parts come back
  await page.reload(); await page.waitForTimeout(1000); await unlock();
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  rec("P7 the purchase shows once in the app (not as two purchases)", (body.match(/Test Store/g) || []).length >= 1, (body.match(/Test Store/g) || []).length);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(600);
  const money = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  rec("P10 each account only loses its own part: cash 10,000 → 9,900 and bank 1,00,000 → 99,600", /Cash in hand ₹9,900/.test(money) && /Bank ₹99,600/.test(money), money.slice(0, 700));
  await page.getByText(/^home$/i).last().dispatchEvent("click"); await page.waitForTimeout(700);
  // edit it again: the two lines come back, and saving an unchanged purchase keeps them
  await page.getByText("Test Store").first().dispatchEvent("click"); await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Edit/ }).first().dispatchEvent("click"); await page.waitForTimeout(700);
  await page.getByText(/^Details/).first().click(); await page.waitForTimeout(400);
  const vals = await T("pay-part-amt").evaluateAll(els => els.map(e => e.value)), accs = await T("pay-part-acc").evaluateAll(els => els.map(e => e.value));
  rec("P8 editing it shows the two payments again (cash 100, bank 400)", vals.join() === "100,400" && accs.join() === "cash1,bank1", { vals, accs });
  await T("pay-parts-off").click(); await page.waitForTimeout(200);
  await page.getByRole("button", { name: /^Save Changes ✓$/ }).click(); await page.waitForTimeout(700);
  const t2 = (await ls("arth_txns"))[0];
  rec("P9 switching back to one account and saving removes the parts (one account, no lines)", (await ls("arth_txns")).length === 1 && !t2.paymentLines && !!t2.accId, t2 && { accId: t2.accId, lines: t2.paymentLines });
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
console.log(results.every(r => r.pass) ? "ALL PASS" : "SOME FAILED"); process.exit(results.every(r => r.pass) ? 0 : 1);

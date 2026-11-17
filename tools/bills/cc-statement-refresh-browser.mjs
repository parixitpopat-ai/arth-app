// Card statement sheet (Money / Payments side): a refund added AFTER the statement was made now shows, can refresh the Arth-calculated amount, and the sheet can add a refund.
// SYNTHETIC data, real app in Chromium. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4235, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 500000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "cc1", name: "Test Amazon Card", type: "cc", last4: "1017", creditLimit: 110000, statementDay: 16, dueDay: 3 }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
  const ex = (id, date, amount, m) => ({ id, type: "expense", merchant: m, desc: m, amount, date, accId: "cc1", catId: "shopping", catIds: ["shopping"] });
  set("arth_txns", [ex("a", "2026-10-20", 7256.94, "Big buy"), ex("b", "2026-11-12", 1752.75, "Amazon"),
    { id: "r", type: "settlement_in", isRefund: true, desc: "Amazon", merchant: "Amazon", amount: 1752.75, date: "2026-11-12", accId: "cc1", againstTxnId: "b" }]);
  // the statement was made BEFORE the refund was recorded: it still holds the purchases only (9,009.69)
  set("arth_bills", [{ id: "st1", isCcStatement: true, accId: "cc1", billerCategory: "Credit Card", name: "Test Amazon Card Statement", periodFrom: "2026-10-16", periodTo: "2026-11-16", arthAmount: 9009.69, amount: 9009.69, dueDate: "2026-12-03", status: "unpaid", verification: "needs_verification", bankAmount: null, verifiedAt: null, adjustments: [], createdAt: "2026-11-16" }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const bills = async () => JSON.parse(await page.evaluate(() => localStorage.getItem("arth_bills") || "[]"));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(700); } } };
const openSheet = async () => { await page.goto(APP); await page.waitForTimeout(1500); await unlock(); await page.waitForTimeout(600);
  await page.getByText(/^payments$/i).last().dispatchEvent("click"); await page.waitForTimeout(1000);
  await page.getByText("Test Amazon Card Statement", { exact: false }).first().dispatchEvent("click"); await page.waitForTimeout(700); };
try {
  await openSheet();
  const note = (await T("cc-stale-note").innerText().catch(() => "")).replace(/\s+/g, " ");
  rec("U1 the statement sheet says the records now total ₹7,256.94, not ₹9,009.69 (the refund was added after it was made)", /7,256\.94/.test(note) && /9,009\.69/.test(note), note.slice(0, 160));
  rec("U2 it offers 'Update to ₹7,256.94'", /Update to ₹7,256\.94/.test(await T("cc-refresh-amount").innerText().catch(() => "")), {});
  rec("U3 nothing changed yet (only a tap changes it)", (await bills())[0].arthAmount === 9009.69, {});
  await T("cc-refresh-amount").click(); await page.waitForTimeout(700);
  const b = (await bills())[0];
  rec("U4 after the tap the statement is ₹7,256.94, still 'needs verification' (not matched by itself), with the change recorded", b.arthAmount === 7256.94 && b.amount === 7256.94 && b.verification === "needs_verification" && b.bankAmount === null && b.adjustments.length === 1 && b.adjustments[0].from === 9009.69 && b.adjustments[0].to === 7256.94, { arth: b.arthAmount, v: b.verification, adj: b.adjustments });
  rec("U5 the note is gone and the sheet shows ₹7,256.94", (await T("cc-stale-note").count()) === 0 && /7,256\.94/.test(await text()), {});
  rec("U6 the sheet has '↩ Add a refund or credit for this period'", (await T("cc-add-refund").count()) === 1, {});
  await T("cc-add-refund").click(); await page.waitForTimeout(900);
  const t = await text();
  rec("U7 it opens the Add form as money in (\"Tag this inflow as\" with Refund chosen) on that card", /Tag this inflow as/i.test(t) && /Refund/.test(t), (t.match(/Tag this inflow as.{0,80}/i) || [""])[0]);
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);

// TV bought on a card EMI: what the app creates, and how Home, Budget and the loan react. SYNTHETIC data, real app in Chromium. CHROMIUM check only.
// Run: node tools/emi/emi-gst-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4481, APP = `http://localhost:${PORT}/`;
const server = spawn("node", [...(process.env.PREVIEW ? ["node_modules/vite/bin/vite.js", "preview", "--port"] : ["node_modules/vite/bin/vite.js", "--port"]), String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 1000 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 200000, openingBalanceDate: "2026-01-01", last4: "9001" },
    { id: "cc1", name: "Coral RuPay", type: "cc", limit: 200000, outstanding: 0, statementDate: 15, dueDate: 5, last4: "8004" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }]); set("arth_txns", []); set("arth_loans", []);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => { errors.push(String(e)); console.log("PAGEERR", String(e).slice(0,300)); });
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const shot = n => page.screenshot({ path: `/tmp/claude-0/-home-claude-repo/271b6b7c-7f32-56d9-9a55-d75ca8158c50/scratchpad/${n}.png` });
await page.goto(APP); await page.waitForTimeout(1300); await unlock(); await page.waitForTimeout(500);
await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(700);
await page.getByText("More options →").click(); await page.waitForTimeout(600);
await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("60000");
await page.getByPlaceholder(/vendor|merchant|store/i).first().fill("TV");
await page.getByText(/^Details/).first().click(); await page.waitForTimeout(500);
await page.getByText("Test Savings").first().click(); await page.waitForTimeout(400);
await page.getByText("Coral RuPay").last().click(); await page.waitForTimeout(500);
await page.getByRole("button", { name: /EMI$/ }).first().click(); await page.waitForTimeout(500);
await page.getByText("💳 Credit card EMI").click(); await page.waitForTimeout(300);
await page.getByText("❓ None").first().click(); await page.waitForTimeout(400);
await page.getByText("👗 Lifestyle").click(); await page.getByRole("button", { name: "Done" }).click(); await page.waitForTimeout(300);
await page.getByText("💸 Down payment").click(); await page.waitForTimeout(300);
await page.getByPlaceholder("e.g. ₹20,000").fill("6000");
await page.getByPlaceholder("e.g. 12").first().fill("9");
await page.getByPlaceholder("e.g. ₹2,500").fill("6000");
await page.getByPlaceholder("e.g. 648").fill("648");
await page.waitForTimeout(300);
rec("G1 the form says GST is billed with each instalment, 72 a month", /72 a month on top of the EMI/.test(await page.getByTestId("emi-gst-each").innerText()), (await page.getByTestId("emi-gst-each").innerText()));
await page.getByRole("button", { name: /^Add ✓$/ }).click(); await page.waitForTimeout(1000);
const txns = await ls("arth_txns"), loans = await ls("arth_loans");
const inst = txns.filter(t => /^EMI \d\/9/.test(t.desc || "")).sort((a, b) => a.date.localeCompare(b.date));
rec("G2 nine instalments, each ₹6,072 (₹6,000 EMI + ₹72 GST)", inst.length === 9 && inst.every(t => t.amount === 6072 && t.emiPrincipalPart === 6000 && t.emiGstPart === 72), inst.slice(0, 2).map(t => [t.amount, t.emiPrincipalPart, t.emiGstPart]));
rec("G3 the loan is still the financed 54,000 with a 6,000 EMI, GST is not part of the debt", loans.length === 1 && loans[0].principal === 54000 && loans[0].emiAmount === 6000, loans[0] && [loans[0].principal, loans[0].emiAmount]);
rec("G4 the down payment is its own 6,000 expense", txns.some(t => t.amount === 6000 && t.desc === "TV"), {});
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);

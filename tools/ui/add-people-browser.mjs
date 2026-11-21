// Add screen, new look: the person rows say what each choice does, and a summary line says what will be owed. SYNTHETIC data, real app in Chromium. CHROMIUM check only. Run: node tools/ui/add-people-browser.mjs
// A CHROMIUM check. It says nothing about the Android app.   Run: node tools/loans/loan-checkbox-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4421, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  localStorage.setItem("arth_accounts", JSON.stringify([
    { id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" },
    { id: "cc1", name: "Test Card", type: "cc", limit: 100000, outstanding: 0, statementDate: 15, dueDate: 5, last4: "4242" }]));
  localStorage.setItem("arth_people", JSON.stringify([{ id: "me", name: "Me", isMe: true }, { id: "p_raj", name: "Raj Test" }, { id: "p_sun", name: "Sunny Test" }, { id: "p_old", name: "Old Friend", archived: true }]));
  localStorage.setItem("arth_txns", "[]"); localStorage.setItem("arth_loans", "[]"); localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const unlock = async () => { for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const openAdd = async () => { await page.goto(APP); await page.waitForTimeout(900); await unlock(); await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(700); await page.getByText("More options →").click(); await page.waitForTimeout(700); };
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
try {
  await openAdd();
  await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("900");
  await page.getByRole("button", { name: /Add person or group/ }).first().dispatchEvent("click"); await page.waitForTimeout(400);
  await page.getByPlaceholder(/Search person or group/).fill("Raj"); await page.waitForTimeout(300);
  await page.locator("button:visible", { hasText: /Raj/ }).first().dispatchEvent("click"); await page.waitForTimeout(400);
  const modes = (await T("row-modes").innerText()).replace(/\s+/g, " ");
  rec("W1 each choice says what it does, not A / O / C", /It was for them\. Just tagging it/.test(modes) && /I owe them/.test(modes) && /They owe me/.test(modes) && !/\bA O C\b/.test(modes), modes);
  rec("W2 the old buttons are still found by their titles (Attribute, Own, Collect)", (await page.locator("button[title='Attribute']").count()) === 1 && (await page.locator("button[title='Own']").count()) === 1 && (await page.locator("button[title='Collect']").count()) === 1, {});
  await page.locator("button[title='Collect']").first().dispatchEvent("click"); await page.waitForTimeout(300);
  await page.locator("input[type='number'][placeholder='0']").first().fill("900"); await page.waitForTimeout(300);
  rec("W3 Collect with 900 says Raj Test will owe you 900", /Raj Test will owe you ₹900/.test(await T("row-summary").innerText()), await T("row-summary").innerText());
  await page.locator("button[title='Own']").first().dispatchEvent("click"); await page.waitForTimeout(300);
  rec("W4 Own says You will owe Raj Test 900", /You will owe Raj Test ₹900/.test(await T("row-summary").innerText()), await T("row-summary").innerText());
  await page.locator("button[title='Attribute']").first().dispatchEvent("click"); await page.waitForTimeout(300);
  rec("W5 Attribute says it is only tagged and nothing is owed", /Nothing is owed/.test(await T("row-summary").innerText()), await T("row-summary").innerText());
  await page.screenshot({ path: "/tmp/claude-0/-home-claude-repo/271b6b7c-7f32-56d9-9a55-d75ca8158c50/scratchpad/add-people.png" });
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);

// Add bill from the generic "+ Add Bill": picking a provider / connection with a clear type (electricity, water) fills category and "for" and
// stops asking for them. SYNTHETIC data, real app in Chromium. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4229, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 500000, openingBalanceDate: "2025-01-01", last4: "9001" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "p2", name: "Partner" }]);
  set("arth_groups", [{ id: "g1", name: "Flat", members: ["me", "p2"] }]);
  set("arth_billers", [{ id: "bl1", name: "Goa Electricity", type: "Electricity" }, { id: "bl2", name: "Drinking Water Dept", type: "Water" }, { id: "bl3", name: "Some Club", type: "Other" }]);
  set("arth_biller_accounts", [
    { id: "ba1", name: "Common Meter Electricity", type: "Electricity", provider: "Goa Electricity", billerId: "bl1", consumerNo: "111222333", attributeType: "house" },
    { id: "ba2", name: "Water Tap A", type: "Water", provider: "Drinking Water Dept", billerId: "bl2", consumerNo: "30071258", attributeType: "group", attributedTo: "g1" },
    { id: "ba3", name: "Water Tap B", type: "Water", provider: "Drinking Water Dept", billerId: "bl2", consumerNo: "30071999", attributeType: "person", attributedTo: "p2" }]);
  set("arth_bills", []);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(700); } } };
const open = async () => { await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(500);
  await page.getByText(/^payments$/i).last().dispatchEvent("click"); await page.waitForTimeout(900);
  await page.getByText("+ Add Bill", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(700); };
const providerSelect = () => page.locator("select").first();
try {
  await open();
  let t = await text();
  rec("A00 with no connection chosen the form still asks for a bill name", (await T("addbill-name-input").count()) === 1, {});
  rec("A0 generic form starts with the full pickers (nothing chosen yet)", /Categories \(select one or more\)/i.test(t) && /FOR \(WHO THIS BILL BELONGS TO\)/i.test(t), {});
  await providerSelect().selectOption({ label: "Goa Electricity" }); await page.waitForTimeout(600);
  t = await text();
  rec("A1 electricity provider with ONE connection: the connection is picked for you", /Common Meter Electricity/.test(t), {});
  rec("A2 no category picker for an electricity bill (the type says Utilities / Electricity)", !/Categories \(select one or more\)/i.test(t), {});
  rec("A3 'for' shows as a one-line row from the connection, not a list of every person", (await T("addbill-for-row").count()) === 1 && !/FOR \(WHO THIS BILL BELONGS TO\)/i.test(t), (await T("addbill-for-row").innerText().catch(() => "")).replace(/\s+/g, " "));
  const nameVal = await page.evaluate(() => [...document.querySelectorAll("input")].map(i => i.value));
  rec("A4 no 'Bill name' to type once a connection is chosen (the connection already has a name)", (await T("addbill-name-input").count()) === 0 && (await T("addbill-name-row").count()) === 0, {});
  await page.getByText("More details").first().dispatchEvent("click"); await page.waitForTimeout(400);
  t = await text();
  rec("A5 More details shows the category read-only: Utilities (from connection)", /Utilities.*from connection/i.test(t), (t.match(/Category [^·]*· from \w+/) || [""])[0]);
  // save
  const inputs = page.locator('input[type="number"]'); await inputs.first().fill("1234"); const due = page.locator('input[type="date"]').first(); await due.fill("2026-12-10");
  await T("addbill-submit").click(); await page.waitForTimeout(900);
  const bills = JSON.parse(await page.evaluate(() => localStorage.getItem("arth_bills") || "[]"));
  rec("A6 saved bill: on that connection, category Utilities, for the house, named from the connection and month", bills.length === 1 && /^Common Meter Electricity · \w+ \d{4}$/.test(bills[0].name) && bills[0].billerAccountId === "ba1" && (bills[0].catIds || []).includes("utilities") && bills[0].amount === 1234, bills.map(b => ({ ba: b.billerAccountId, catIds: b.catIds, amount: b.amount, forType: b.forType || b.billForType })));
  // water: two connections -> account must still be chosen; category already known
  await open();
  await providerSelect().selectOption({ label: "Drinking Water Dept" }); await page.waitForTimeout(600);
  t = await text();
  rec("W1 water provider with TWO connections: asks which one, and still no category picker", /Account under/i.test(t) && !/Categories \(select one or more\)/i.test(t), {});
  await page.locator("select").nth(1).selectOption({ label: "Water Tap B" }); await page.waitForTimeout(600);
  t = await text();
  rec("W2 choosing the connection fills 'for' from it (Partner); still no bill name to type", /Partner/.test((await T("addbill-for-row").innerText().catch(() => ""))) && (await T("addbill-name-input").count()) === 0, (await T("addbill-for-row").innerText().catch(() => "")).replace(/\s+/g, " "));
  // a provider whose type says nothing keeps the picker
  await providerSelect().selectOption({ label: "Some Club" }); await page.waitForTimeout(600);
  t = await text();
  rec("O1 a provider whose type says nothing about the category still asks for it", /Categories \(select one or more\)/i.test(t), {});
  // change category after it was inferred
  await providerSelect().selectOption({ label: "Goa Electricity" }); await page.waitForTimeout(600);
  await page.getByText("More details").first().dispatchEvent("click").catch(() => {}); await page.waitForTimeout(300);
  await page.getByText("Change", { exact: true }).last().dispatchEvent("click").catch(() => {}); await page.waitForTimeout(500);
  t = await text();
  rec("C1 'Change' next to the category brings the picker back", /Categories \(select one or more\)/i.test(t), {});
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);

// Add Provider Account with several people (a family plan), in the real app (Chromium, local Vite dev server, SYNTHETIC data). A CHROMIUM check only.
// Run: node tools/bills/family-plan-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4206, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "p1", name: "Priya Test" }, { id: "p2", name: "Raj Test" }, { id: "p3", name: "Anya Test" }, { id: "p4", name: "Meera Test" }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^payments$/i).last().dispatchEvent("click"); await page.waitForTimeout(800);
  await page.getByText("Billers", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(600);
  await page.getByText(/Add \/ Activate/).first().dispatchEvent("click"); await page.waitForTimeout(700);
  await page.getByText("Mobile Postpaid", { exact: false }).first().dispatchEvent("click"); await page.waitForTimeout(700);
  await page.getByPlaceholder(/./).first().fill("Jio Postpaid"); await page.getByRole("button", { name: "Add Provider", exact: true }).click(); await page.waitForTimeout(800);
  await page.getByText(/\+ Add Person \/ Account/).first().dispatchEvent("click"); await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Person", exact: true }).click(); await page.waitForTimeout(300);
  rec("F1 'Person' shows a Select person(s) control (a checklist, not a one-choice dropdown)", /Select person\(s\)/.test(await text()) && (await page.locator("select").count()) === 0, {});
  await T("ba-persons-toggle").click(); await page.waitForTimeout(300);
  rec("F2 the list shows everyone to tick", (await T("ba-person-p1").count()) === 1 && (await T("ba-person-p2").count()) === 1 && (await T("ba-person-p3").count()) === 1, {});
  await T("ba-person-p1").click(); await T("ba-person-p2").click(); await T("ba-person-p3").click(); await page.waitForTimeout(300);
  rec("F3 three people can be ticked (check marks), the first is the main one", (await T("ba-person-p1").getAttribute("aria-pressed")) === "true" && (await T("ba-person-p2").getAttribute("aria-pressed")) === "true" && (await T("ba-person-p3").getAttribute("aria-pressed")) === "true" && /Bills show as "For" Priya Test/.test(await T("ba-persons-note").innerText()), await T("ba-persons-note").innerText());
  await T("ba-person-p2").click(); await page.waitForTimeout(200);
  rec("F4 unticking one removes just that one", (await T("ba-person-p2").getAttribute("aria-pressed")) === "false" && (await T("ba-person-p3").getAttribute("aria-pressed")) === "true", {});
  await T("ba-person-p2").click(); await page.waitForTimeout(200);
  rec("F5 the nickname was filled from the first person ticked", (await page.getByPlaceholder(/e\.g\. M1/).inputValue()) === "Priya Test", {});
  await page.getByPlaceholder(/e\.g\. M1/).fill("Family plan");
  await page.getByRole("button", { name: "Add Provider Account", exact: true }).last().click(); await page.waitForTimeout(900);
  const ba = (await ls("arth_biller_accounts")).find(b => b.name === "Family plan");
  const rels = (await ls("arth_membership_relationships")).filter(r => ba && r.billerAccountId === ba.id);
  rec("F6 saved: the account is attributed to the first person (Priya) and has THREE active person relationships (one each, none duplicated)", ba && ba.attributedTo === "p1" && ba.attributeType === "person" && rels.length === 3 && rels.every(r => r.status === "active") && ["p1", "p2", "p3"].every(id => rels.some(r => r.targetId === id)), { attributedTo: ba && ba.attributedTo, rels: rels.map(r => [r.targetId, r.status]) });
  await page.waitForTimeout(500);
  const rels2 = (await ls("arth_membership_relationships")).filter(r => ba && r.billerAccountId === ba.id);
  rec("F7 still exactly three after the app's own attribution check has run (no duplicate for the main person)", rels2.length === 3, rels2.length);
  // edit: the three are ticked and locked; a fourth can be added
  await page.reload(); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^payments$/i).last().dispatchEvent("click"); await page.waitForTimeout(800);
  await page.getByText("Billers", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(600);
  await page.getByText(/Broadband & Recharges/).first().dispatchEvent("click"); await page.waitForTimeout(500);
  await page.getByText(/Family plan/).first().dispatchEvent("click"); await page.waitForTimeout(700);
  const sheet = await text();
  rec("E0 the connection screen shows a status panel for EACH person (3 panels, each with Pause / End)", (await page.getByRole("button", { name: "End", exact: true }).count()) === 3 && /Active — Priya Test/.test(sheet) && /Active — Raj Test/.test(sheet) && /Active — Anya Test/.test(sheet), sheet.slice(0, 400));
  await page.getByRole("button", { name: /^✏️ Edit$/ }).first().click(); await page.waitForTimeout(600);
  await T("ba-persons-toggle").click(); await page.waitForTimeout(300);
  rec("E1 editing: the three on the plan are ticked and marked 'on this plan'; the fourth person is not ticked", (await T("ba-person-p1").getAttribute("aria-pressed")) === "true" && (await T("ba-person-p2").getAttribute("aria-pressed")) === "true" && (await T("ba-person-p3").getAttribute("aria-pressed")) === "true" && (await T("ba-person-p4").getAttribute("aria-pressed")) === "false", {});
  await T("ba-person-p2").click(); await page.waitForTimeout(200);
  rec("E2 an existing person cannot be unticked here (ending is done from the connection screen)", (await T("ba-person-p2").getAttribute("aria-pressed")) === "true", {});
  await T("ba-person-p4").click(); await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Save/ }).last().click(); await page.waitForTimeout(900);
  const rels3 = (await ls("arth_membership_relationships"));
  rec("E3 ticking a fourth person and saving adds exactly one more relationship (4 active in all, no duplicates)", rels3.filter(r => r.status === "active").length === 4 && ["p1", "p2", "p3", "p4"].every(id => rels3.filter(r => r.targetId === id).length === 1), rels3.map(r => [r.targetId, r.status]));
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);

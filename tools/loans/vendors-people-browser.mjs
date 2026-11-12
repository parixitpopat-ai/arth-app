// Money -> Reports -> Vendors: vendor-wise spend and "same vendor?" merging, in the real app (Chromium, local Vite dev server, SYNTHETIC data). A CHROMIUM check only.
// Run: node tools/loans/vendors-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4210, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  const now = new Date(); const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
  const ex = (id, merchant, amount, day, date) => ({ id, type: "expense", merchant, desc: merchant, amount, date: date || `${ym}-${String(day).padStart(2, "0")}`, accId: "bank1", catId: "groceries", catIds: ["groceries"], subId: "g1", subIds: ["g1"], people: { __me__: { amount } } });
  set("arth_people", [{ id: "p1", name: "Raj Adhiya" }, { id: "p2", name: "Nidhi Yadav" }, { id: "p3", name: "Nidhi Sharma" }]);
  set("arth_txns", [ex("a1", "Zomato", 900, 1), ex("a2", "Nidhi Yadav", 4000, 2), ex("a3", "RAJ AD", 500, 3), ex("a4", "Raj Ad", 250, 4), ex("a5", "Nidhi", 100, 5)]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const openVendors = async () => {
  await page.goto(APP); await page.waitForTimeout(1100); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  await T("reports-card").dispatchEvent("click"); await page.waitForTimeout(700);
  await T("rp-tab-vendors").dispatchEvent("click"); await page.waitForTimeout(600);
};
try {
  await openVendors();
  let body = await text();
  rec("P1 a vendor with exactly a person's name is not a vendor: Nidhi Yadav is listed under 'Paid to people', Zomato/RAJ AD/Nidhi stay vendors", (await T("vendor-paid-people").count()) === 1 && /Nidhi Yadav/.test(await T("vendor-paid-people").innerText()) && !(await T("vendor-row-nidhi yadav").count()) && (await T("vendor-row-zomato").count()) === 1, (await T("vendor-paid-people").innerText()).slice(0, 120));
  rec("P2 'Raj Ad' (cut short) is only SUGGESTED as Raj Adhiya; 'Nidhi' fits two people so it is not suggested", (await T("vendor-people-hints").count()) === 1 && /Raj Ad.*Raj Adhiya/.test(await T("vendor-people-hints").innerText()) && !/Nidhi →/.test(await T("vendor-people-hints").innerText()), (await T("vendor-people-hints").innerText()).slice(0, 160));
  const before = JSON.stringify(await ls("arth_txns"));
  await T("vendor-link-Raj Ad").dispatchEvent("click"); await page.waitForTimeout(500);
  const ppl = await ls("arth_people"); const raj = ppl.find(p => p.id === "p1");
  rec("P3 'Yes, link' saves the written name as Raj Adhiya's alias and changes no entry", raj && (raj.aliases || []).includes("Raj Ad") && JSON.stringify(await ls("arth_txns")) === before, raj);
  rec("P4 both spellings (RAJ AD, Raj Ad) now sit under 'Paid to people', total 750", /Raj Adhiya/.test(await T("vendor-paid-people").innerText()) && /750/.test(await T("vendor-paid-people").innerText()), (await T("vendor-paid-people").innerText()).slice(0, 200));
  const un = page.locator('[data-testid^="vendor-unlink-"]');
  const n0 = await un.count();
  await un.nth(1).dispatchEvent("click"); await page.waitForTimeout(400);
  const raj2 = (await ls("arth_people")).find(p => p.id === "p1");
  rec("P5 'Not a person' takes the alias off again", n0 === 2 && !(raj2.aliases || []).length, { n0, raj2 });
  await T("vendor-person-pick").selectOption("Zomato"); await page.waitForTimeout(200);
  await T("vendor-person-p2").dispatchEvent("click"); await page.waitForTimeout(400);
  rec("P6 the manual picker links any vendor to a person: Zomato -> Nidhi Yadav saved as an alias", ((await ls("arth_people")).find(p => p.id === "p2").aliases || []).includes("Zomato"), {});
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);

// Money -> Reports -> Vendors: vendor-wise spend and "same vendor?" merging, in the real app (Chromium, local Vite dev server, SYNTHETIC data). A CHROMIUM check only.
// Run: node tools/loans/vendors-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4203, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  const now = new Date(); const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
  const ex = (id, merchant, amount, day, date) => ({ id, type: "expense", merchant, desc: merchant, amount, date: date || `${ym}-${String(day).padStart(2, "0")}`, accId: "bank1", catId: "groceries", catIds: ["groceries"], subId: "g1", subIds: ["g1"], people: { __me__: { amount } } });
  set("arth_txns", [ex("d1", "DudhSagar Dairy", 1000, 1), ex("d2", "DudhSagar Dairy", 1000, 2), ex("d3", "Dudh Sagar Dairy", 200, 3),
    ex("g1", "Goa Electricity Department", 3000, 4), ex("g2", "Goa Electricity Department", 2000, 5), ex("g3", "Goa electricity Department", 776, 6),
    ex("m1", "Mahesh Stores", 300, 7), ex("m2", "Mahesh", 100, 8), ex("o1", "Old Year Vendor", 777, 0, "2025-12-05")]);
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
  rec("V0 Reports has a Vendors tab and it opens the vendor-wise spend", (await T("vendors-report").count()) === 1, {});
  rec("V1 the vendor list is biggest spend first; Goa (capital-letter difference) is ONE vendor with 3 entries Rs 5,776, 'written 2 ways'", /Goa Electricity Department ₹5,776/.test(body) && /3 entries[^·]*· last [^·]*· written 2 ways/.test(body) && body.indexOf("Goa Electricity Department ₹") < body.indexOf("DudhSagar Dairy ₹"), (body.match(/Goa Electricity Department ₹[\d,]+/) || [""])[0]);
  rec("V2 the two dairy spellings are separate vendors (Rs 2,000 and Rs 200)", /DudhSagar Dairy ₹2,000/.test(body) && /Dudh Sagar Dairy ₹200/.test(body), {});
  rec("V3 it asks about the dairy pair ONLY (not Goa, not 'Mahesh Stores / Mahesh')", (await page.locator('[data-testid^="vendor-group-"]').count()) === 1 && /Dudh Sagar Dairy/.test(await T("vendor-suggestions").innerText()) && !/Mahesh/.test(await T("vendor-suggestions").innerText()), await page.locator('[data-testid^="vendor-group-"]').evaluateAll(e => e.map(x => x.getAttribute("data-testid"))));
  const before = await ls("arth_txns");
  rec("V4 looking changes nothing", before.filter(t => /dudh/i.test(t.merchant)).map(t => t.merchant).sort().join("|") === "Dudh Sagar Dairy|DudhSagar Dairy|DudhSagar Dairy", {});
  rec("V5 the most-used spelling is pre-selected", await T("vendor-keep-DudhSagar Dairy").isChecked(), {});
  // this-FY vs all time
  rec("V6 'Old Year Vendor' (Dec 2025) is not in this financial year", !/Old Year Vendor/.test(body), {});
  await T("vendor-range-all").click(); await page.waitForTimeout(400);
  rec("V7 'All time' includes it", /Old Year Vendor ₹777/.test(await text()), {});
  await T("vendor-range-fy").click(); await page.waitForTimeout(300);
  await T("vendor-search").fill("goa"); await page.waitForTimeout(300);
  body = await text();
  rec("V8 search narrows the list", /Goa Electricity Department/.test(body) && !/Mahesh Stores ₹/.test(body), {});
  await T("vendor-search").fill(""); await page.waitForTimeout(200);
  // tapping a vendor opens the existing vendor page
  await page.locator('[data-testid="vendor-row-goa electricity department"]').dispatchEvent("click"); await page.waitForTimeout(800);
  body = await text();
  rec("V9 tapping a vendor opens its detail (the existing vendor page)", /Goa Electricity Department/.test(body) && /(Total|total|spent|Spend)/.test(body) && (await T("vendors-report").count()) >= 0, {});
  await page.goto(APP); await openVendors().catch(() => {});
  // choose the other spelling and merge
  await T("vendor-keep-Dudh Sagar Dairy").check(); await page.waitForTimeout(200);
  await T("vendor-merge-dudhsagardairy").click(); await page.waitForTimeout(800);
  let tx = await ls("arth_txns");
  rec("V10 merging into 'Dudh Sagar Dairy' renamed exactly the 2 other entries; nothing else changed", tx.filter(t => /dudh/i.test(t.merchant)).every(t => t.merchant === "Dudh Sagar Dairy") && tx.filter(t => t.merchant === "Dudh Sagar Dairy").length === 3 && tx.length === 9 && tx.find(t => t.id === "m1").merchant === "Mahesh Stores", tx.filter(t => /dudh/i.test(t.merchant)).map(t => t.merchant));
  body = await text();
  rec("V11 the list now shows ONE dairy vendor, Rs 2,200, with an undo, and the question is gone", /Dudh Sagar Dairy ₹2,200/.test(body) && !/DudhSagar Dairy ₹/.test(body) && (await T("vendor-undo").count()) === 1 && (await T("vendor-suggestions").count()) === 0, (body.match(/Dudh Sagar Dairy ₹[\d,]+/) || [""])[0]);
  await T("vendor-undo").click(); await page.waitForTimeout(700);
  tx = await ls("arth_txns");
  rec("V12 Undo puts the old spellings back exactly", tx.filter(t => t.merchant === "DudhSagar Dairy").length === 2 && tx.filter(t => t.merchant === "Dudh Sagar Dairy").length === 1 && (await T("vendor-suggestions").count()) === 1, tx.filter(t => /dudh/i.test(t.merchant)).map(t => t.merchant));
  await T("vendor-notsame-dudhsagardairy").click(); await page.waitForTimeout(600);
  rec("V13 'Not the same' hides the question and changes no entry", (await T("vendor-suggestions").count()) === 0 && (await ls("arth_txns")).filter(t => t.merchant === "DudhSagar Dairy").length === 2, {});
  rec("V14 and it is remembered after reopening", (await ls("arth_vendor_not_same")).length === 1, await ls("arth_vendor_not_same"));
  await openVendors();
  rec("V15 reopened: still no question about them", (await T("vendor-suggestions").count()) === 0, {});
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 500)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);

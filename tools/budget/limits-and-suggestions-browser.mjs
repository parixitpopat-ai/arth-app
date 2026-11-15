// Budget: limits are guides (never blocked), category limits live on Budget not Settings, and suggestions follow the real last 3 months.
// Real app in Chromium, SYNTHETIC data: one 13,056 expense fully owed back by a group. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4222, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
const ym = (back) => { const d = new Date(); const t = new Date(d.getFullYear(), d.getMonth() - back, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`; };
const seedTxns = []; let n = 0;
seedTxns.push({ id: "tme", type: "expense", desc: "Me spend", merchant: "Me spend", amount: 15000, date: ym(1) + "-12", accId: "bank1", catId: "groceries", catIds: ["groceries"], trackingMode: "tag", forPerson: "me", people: { me: { mode: "spent_on", amount: 15000 } } });
const add = (back, cat, amt) => seedTxns.push({ id: "t" + (++n), type: "expense", desc: cat, merchant: cat, amount: amt, date: ym(back) + "-10", accId: "bank1", catId: cat, catIds: [cat] });
[[1, 9500, 2000], [2, 8600, 1800], [3, 7000, 1500]].forEach(([b, g, e]) => { add(b, "groceries", g); add(b, "entertainment", e); });
await ctx.addInitScript((txns) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 500000, openingBalanceDate: "2025-01-01", last4: "9001" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true, spendBudget: 10000 }]);
  set("arth_groups", []);
  set("arth_cats", [{ id: "groceries", name: "Groceries", icon: "G", color: "#16a34a", budget: 8000, subs: [] }, { id: "entertainment", name: "Entertainment", icon: "E", color: "#9333ea", budget: 5000, subs: [] }]);
  set("arth_txns", txns);
  set("arth_mandatory_commitments", [{ id: "mc1", name: "Pocket money", amount: 5000, categoryId: "entertainment", scopeType: "person", scopeId: "me" }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); }, seedTxns);
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(700); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1300); await unlock(); await page.waitForTimeout(500);
  await page.getByText("Budget", { exact: true }).first().dispatchEvent("click").catch(() => {}); await page.waitForTimeout(900);
  const b = await text();
  rec("B1 nothing says 'Exceeds Discretionary Pool' / 'reduce this to save' any more", !/Exceeds Discretionary Pool/.test(b) && !/reduce this to save/.test(b), {});
  rec("B2 'Unallocated' is now 'Free to spend'", /Free to spend/.test(b) && !/Unallocated/.test(b), {});
  const sugg = await page.getByTestId("limit-suggestion").count();
  const sText = sugg ? (await page.getByTestId("limit-suggestion").allInnerTexts()).join(" | ").replace(/\s+/g, " ") : "";
  rec("B3 suggestions: move freed money from Entertainment to Groceries, based on the last 3 full months", sugg >= 1 && /Move .*Entertainment to Groceries/.test(sText), sText.slice(0, 300));
  rec("B4 Category guides card is on the Budget page with both categories", (await page.getByTestId("category-guides").count()) === 1 && /Groceries/.test(await page.getByTestId("category-guides").innerText()), {});
  const trimText = (await page.getByTestId("limit-suggestion").allInnerTexts()).join(" | ").replace(/\s+/g, " ");
  rec("B7 pay-back: limit 10,000 with a 5,000 commitment, 15,000 spent last month -> next month 5,000", /Me: .* limit ₹5,000 instead of ₹10,000/.test(trimText), trimText.slice(0, 260));
  await page.getByTestId("limit-suggestion").filter({ hasText: "December limit" }).first().getByRole("button", { name: "Apply" }).click(); await page.waitForTimeout(600);
  const meAfter = JSON.parse(await page.evaluate(() => localStorage.getItem("arth_people"))).find(x => x.id === "me");
  const nextKey = (() => { const d = new Date(); const t = new Date(d.getFullYear(), d.getMonth() + 1, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`; })();
  rec("B8 Apply saves next month's limit for Me as 5,000 and leaves this month's alone", meAfter.spendBudgetOverrides?.[nextKey] === 5000 && meAfter.spendBudget === 10000, meAfter.spendBudgetOverrides);
  const cats0 = JSON.parse(await page.evaluate(() => localStorage.getItem("arth_cats")));
  await page.getByTestId("limit-suggestion").filter({ hasText: "Entertainment to Groceries" }).first().getByRole("button", { name: "Apply" }).click(); await page.waitForTimeout(700);
  const cats1 = JSON.parse(await page.evaluate(() => localStorage.getItem("arth_cats")));
  const g0 = cats0.find(c => c.id === "groceries").budget, g1 = cats1.find(c => c.id === "groceries").budget, e0 = cats0.find(c => c.id === "entertainment").budget, e1 = cats1.find(c => c.id === "entertainment").budget;
  rec("B5 applying the move changes the two limits by the same amount (total unchanged)", g1 > g0 && e1 < e0 && Math.abs((g1 - g0) - (e0 - e1)) < 0.01, { g0, g1, e0, e1 });
  const tot0 = g0 + e0, tot1 = g1 + e1; rec("B6 the two limits still add up to the same total", Math.abs(tot0 - tot1) < 0.01, { tot0, tot1 });
  await page.goto(APP); await page.waitForTimeout(1000); await unlock(); await page.waitForTimeout(500);
  await page.getByText("Budget", { exact: true }).first().dispatchEvent("click").catch(() => {}); await page.waitForTimeout(800);
  const settingsOpen = await page.getByText("←", { exact: true }).first().dispatchEvent("click").then(() => true).catch(() => false); await page.waitForTimeout(700);
  await page.getByText("Categories", { exact: true }).first().dispatchEvent("click").catch(() => {}); await page.waitForTimeout(700);
  const sc = await text();
  rec("S1 Settings → Categories has no budget field, no 'Over budget by', and points to Budget", settingsOpen && !/Over budget by/.test(sc) && !/Monthly budget/.test(sc) && /Category guides/.test(sc), sc.slice(0, 260));
} catch (e) { rec("RUN", false, String(e).slice(0, 700)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);

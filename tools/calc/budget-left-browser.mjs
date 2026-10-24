// Budget-left figures on Home and in the Budget tab, in the real app (Chromium, local dev server, SYNTHETIC data, fixed clock).
// Prints what each screen shows so before/after of the unification can be compared. Chromium only; says nothing about Android.
//   Setup: npx vite --port 5210 --strictPort &      Run: node tools/calc/budget-left-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const APP = process.env.NL_APP || "http://localhost:5210/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const SCENARIOS = [
  { id: "mid-month, ₹18,000 left", now: "2026-10-12T10:00:00+05:30", spent: 32000 },
  { id: "over budget by ₹5,000", now: "2026-10-12T10:00:00+05:30", spent: 55000 },
  { id: "last day of month", now: "2026-10-31T10:00:00+05:30", spent: 32000 },
  { id: "first day of month", now: "2026-10-01T10:00:00+05:30", spent: 2000 },
];
const out = [];
for (const sc of SCENARIOS) {
  const ctx = await browser.newContext({ timezoneId: "Asia/Kolkata", viewport: { width: 420, height: 1100 } });
  await ctx.route(u => { try { return !["localhost", "127.0.0.1"].includes(new URL(u).hostname); } catch { return false; } }, r => r.abort());
  await ctx.clock.setFixedTime(new Date(sc.now));
  const day = sc.now.slice(0, 10);
  await ctx.addInitScript(([spent, day]) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
    localStorage.setItem("arth_accounts", JSON.stringify([{ id: "b1", name: "Test Bank", type: "bank", openingBalance: 500000, openingBalanceDate: "2026-01-01", last4: "9001" }]));
    localStorage.setItem("arth_txns", JSON.stringify([{ id: "t1", type: "expense", merchant: "Shop", desc: "Shop", date: day, amount: spent, accId: "b1", catId: "groceries", catIds: ["groceries"], subIds: [] }]));
    localStorage.setItem("arth_master_user_setup_complete", "true"); localStorage.setItem("arth_vehicles", "[]"); }, [sc.spent, day]);
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(APP); await page.waitForTimeout(900);
  for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(120); } await page.waitForTimeout(500); } }
  const text = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const home = await text();
  const pick = (t, re) => { const m = re.exec(t); return m ? m[0] : null; };
  const row = { scenario: sc.id,
    homeCard: pick(home, /(SAFE TO SPEND|LEFT IN BUDGET)[^]*?(day|Over budget)[^.]{0,60}/),
  };
  // Budget tab: Home card opens Budget directly after the change; before it, Outlook's "<Month> budget" button leads there
  page.setDefaultTimeout(4000);
  await page.getByText(/SAFE TO SPEND|LEFT IN BUDGET/).first().click().catch(() => {}); await page.waitForTimeout(700);
  let b = await text();
  if (!/By category|Spent ·/.test(b)) { await page.getByRole("button", { name: / budget$/i }).first().click().catch(() => {}); await page.waitForTimeout(700); b = await text(); }
  row.budgetLine = pick(b, /of ₹[\d,]+ · [^·]*· \d+ days?/);
  row.budgetPerDay = pick(b, /(about ₹[\d,]+ a day|—)/);
  await page.getByText("‹", { exact: true }).first().click().catch(() => {}); await page.waitForTimeout(500);
  const prev = await text();
  row.pastMonthPerDay = pick(prev, /(about ₹[\d,]+ a day)/) || "(none shown)";
  row.errors = errors.slice(0, 1);
  out.push(row); await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();

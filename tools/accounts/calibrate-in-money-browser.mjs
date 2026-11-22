// Calibrate a bank account from its own page under Money (not only from Settings). SYNTHETIC data, real app in Chromium. CHROMIUM check only. Run: node tools/accounts/calibrate-in-money-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4561, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 1000 } });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  localStorage.setItem("arth_nav_v2", "1");
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 10000, openingBalanceDate: "2026-01-01" }]); set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
  set("arth_txns", [{ id: "a", type: "expense", desc: "Saj Burgers", merchant: "Saj Burgers", date: "2026-11-10", amount: 1800, accId: "b1", catId: "food", catIds: ["food"], createdAt: 1 }]); localStorage.setItem("arth_master_user_setup_complete", "true"); });
const p = await ctx.newPage(); const errors = []; p.on("pageerror", e => errors.push(String(e)));
const T = id => p.getByTestId(id); const text = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const pin = async () => { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click().catch(() => {}); await p.waitForTimeout(100); } await p.waitForTimeout(700); };
await p.goto(APP); await p.waitForTimeout(1300);
for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) await pin();
await T("nav-money").click(); await p.waitForTimeout(600); await T("section-accounts").click(); await p.waitForTimeout(600); await pin();
await p.getByText("Test Savings").first().click(); await p.waitForTimeout(800);
rec("C1 the account's page asks 'Does this match your bank?' with a button", (await T("acc-calibrate").count()) === 1 && /Not checked yet/.test(await text()), (await text()).slice(0, 80));
await T("acc-calibrate").click(); await p.waitForTimeout(500);
rec("C2 the balance sheet opens with the live balance (10,000 - 1,800 = 8,200) pre-filled", /Bank Reconciliation/.test(await text()) && (await p.locator("input[placeholder='e.g. 2,300']").inputValue()) === "8200", await p.locator("input[placeholder='e.g. 2,300']").inputValue());
await p.locator("input[placeholder='e.g. 2,300']").fill("8000"); await p.getByRole("button", { name: "Save", exact: true }).click(); await p.waitForTimeout(700);
const t = await text();
rec("C3 after saving, the account page shows the gap (actual 8,000 vs 8,200 = -200)", /Gap −₹200/.test(t), (t.match(/Actual [^·]*· [^.]{0,30}/) || ["none"])[0]);
const cp = await p.evaluate(() => JSON.parse(localStorage.getItem("arth_checkpoints") || "{}"));
rec("C4 the check is kept", cp.b1 && cp.b1.amount === 8000, cp);
await T("acc-calibrate").click(); await p.waitForTimeout(400); await p.locator("input[placeholder='e.g. 2,300']").fill("8200"); await p.getByRole("button", { name: "Save", exact: true }).click(); await p.waitForTimeout(600);
rec("C5 entering the right balance says Matched", /Matched/.test(await text()), {});
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await b.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);

// Transactions: a banner counts expenses with no category and "Sort them" opens Select with them ticked; Select all shown / no-category buttons; Set category applies to all ticked. SYNTHETIC data, real app in Chromium. Run: node tools/ui/uncategorised-banner-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4577, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 1400 } });
const day = n => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
await ctx.addInitScript(([d1, d2, d3, d4]) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem("arth_nav_v2", "1");
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01" }]); set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
  set("arth_txns", [
    { id: "u1", type: "expense", desc: "Mystery A", merchant: "Mystery A", amount: 100, date: d1, accId: "b1" },
    { id: "u2", type: "expense", desc: "Mystery B", merchant: "Mystery B", amount: 200, date: d2, accId: "b1" },
    { id: "u3", type: "expense", desc: "Mystery C", merchant: "Mystery C", amount: 300, date: d3, accId: "b1" },
    { id: "c1", type: "expense", desc: "Known", merchant: "Known", amount: 50, date: d4, accId: "b1", catId: "food", catIds: ["food"] }]);
  set("arth_bills", []); localStorage.setItem("arth_master_user_setup_complete", "true"); }, [day(-1), day(-2), day(-3), day(-4)]);
const p = await ctx.newPage(); const errors = []; p.on("pageerror", e => errors.push(String(e)));
const T = id => p.getByTestId(id); const body = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
await p.goto(APP); await p.waitForTimeout(1300);
for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); }
await T("nav-money").click(); await p.waitForTimeout(900);
rec("B1 the banner counts the three expenses with no category (not the categorised one)", (await T("uncat-banner").count()) === 1 && /3 expenses have no category/.test(await T("uncat-banner").innerText()), await T("uncat-banner").innerText().catch(() => ""));
await T("uncat-sort").click(); await p.waitForTimeout(500);
rec("B2 'Sort them' opens Select with the three ticked and the action bar shows", /3 selected/.test(await body()) && (await T("uncat-banner").count()) === 0, (await body()).match(/\d+ selected/)?.[0]);
await p.getByRole("button", { name: /Category/ }).first().click(); await p.waitForTimeout(500);
await p.getByRole("button", { name: /Groceries|Food/ }).first().click(); await p.waitForTimeout(600);
rec("B3 setting a category on the ticked ones leaves nothing uncategorised: the banner is gone", (await T("uncat-banner").count()) === 0, {});
await p.getByRole("button", { name: /^Select$/ }).first().click(); await p.waitForTimeout(400);
rec("B4 in Select mode, 'Select all shown' ticks every listed entry (4)", await (async () => { await T("select-all-shown").click(); await p.waitForTimeout(300); return /4 selected/.test(await body()); })(), (await body()).match(/\d+ selected/)?.[0]);
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await b.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);

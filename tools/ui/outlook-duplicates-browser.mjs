// Outlook: possible duplicates are flagged on the rows and listed in a card, and "These are different" clears a pair. SYNTHETIC data, real app in Chromium. CHROMIUM check only. Run: node tools/ui/outlook-duplicates-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4571, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 1400 } });
const day = n => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
await ctx.addInitScript(([d5, d6, yy, tt]) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem("arth_nav_v2", "1");
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01" }]); set("arth_people", [{ id: "me", name: "Me", isMe: true }]); set("arth_txns", []); set("arth_wealth_snapshots", [{ date: yy, netWorth: 1000, cash: 500 }, { date: tt, netWorth: 1500, cash: 300 }]);
  set("arth_bills", [
    { id: "r1", name: "Rent", billDate: d5, dueDate: d5, status: "unpaid", amount: 20000 },
    { id: "r2", name: "Rent payment", billDate: d6, dueDate: d6, status: "unpaid", amount: 20000 },
    { id: "w1", name: "Water", billDate: d5, dueDate: d5, status: "unpaid", amount: 500 }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); }, [day(5), day(6), day(-1), day(0)]);
const p = await ctx.newPage(); const errors = []; p.on("pageerror", e => errors.push(String(e)));
const T = id => p.getByTestId(id); const body = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
await p.goto(APP); await p.waitForTimeout(1300);
for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); }
const yday = (() => { const x = new Date(); x.setDate(x.getDate() - 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; })();
await T("nav-plan").click(); await p.waitForTimeout(600); await T("section-outlook").click(); await p.waitForTimeout(900);
let t = await body();
rec("D1 Outlook itself no longer carries payment flags or the repeated links", (await T("dup-badge").count()) === 0 && (await T("dup-card").count()) === 0 && !/All bills in Payments/.test(t), {});
rec("D2 Available cash and Buffer appear once each (no 'Available now', no 'Ends at buffer')", !/Available now/.test(t) && !/Ends at (buffer|short by)/.test(t) && (t.match(/Available cash/g) || []).length === 1, (t.match(/Available cash/g) || []).length);
rec("D3 'What changed' is gone from Outlook", !/WHAT CHANGED/i.test(t), {});
await p.getByTestId("home-bell").first().click().catch(async () => { await T("nav-today").click(); await p.waitForTimeout(500); await p.getByTestId("home-bell").click(); }); await p.waitForTimeout(600);
t = await body();
rec("D4 the bell lists 'Possible duplicate payments · 1' with what it means", (await T("notif-dups").count()) === 1 && /Possible duplicate payments · 1/.test(t) && /Tap to check only those/.test(t), t.match(/Possible duplicate payments[^.]*/)?.[0]);
await T("notif-dups").click(); await p.waitForTimeout(900);
rec("D5 tapping it shows only the possible pair in Outlook, with the Rent rows and no other Outlook content", (await T("dup-review").count()) === 1 && (await T("dup-pair").count()) === 1 && /Rent payment/.test(await body()) && !/Water/.test(await body()) && !/BUFFER/.test(await body()), (await body()).slice(0, 160));
await T("dup-not").click(); await p.waitForTimeout(500);
rec("D6 'These are different' empties the check and it is remembered", /No possible duplicates left to check/.test(await body()), {});
await T("dup-show-all").click(); await p.waitForTimeout(500);
rec("D7 Show all of Outlook goes back to the full page", (await T("dup-review").count()) === 0 && /BUFFER/i.test(await body()), {});
await p.getByTestId("home-bell").first().click().catch(() => {}); await p.waitForTimeout(400);
rec("D8 the bell no longer lists it", (await T("notif-dups").count()) === 0, {});
await T("nav-money").click().catch(() => {}); await p.waitForTimeout(500); await p.getByTestId("section-accounts").click().catch(() => {}); await p.waitForTimeout(500);
for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click().catch(() => {}); await p.waitForTimeout(100); } await p.waitForTimeout(700);
rec("D9 'What changed' now sits under net worth on Money → Accounts", /WHAT CHANGED — SINCE YESTERDAY/.test(await body()) && /Net Worth \+₹|Net Worth ₹?-?/.test(await body()), (await body()).match(/WHAT CHANGED[^C]*C?[^₹]*₹[\d,]*/)?.[0]);
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await b.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);

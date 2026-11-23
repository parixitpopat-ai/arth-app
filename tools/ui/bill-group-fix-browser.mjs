// A payment linked to a bill that never got the bill's group: the bell lists it, a review sheet shows now/after, Fix writes it once. SYNTHETIC data, real app in Chromium. Run: node tools/ui/bill-group-fix-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4579, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 1400 } });
const day = n => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
await ctx.addInitScript(([d1, d2]) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem("arth_nav_v2", "1");
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01" }]); set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "x", name: "Xena" }, { id: "y", name: "Yash" }]);
  set("arth_groups", [{ id: "g1", name: "Neighbours", icon: "🏘️", color: "#0ea5e9", typeId: "other", type: "Other", members: ["x", "y"], includeMe: false, manualLimit: 0, defaultIntent: "split", modules: [] }]);
  set("arth_bills", [{ id: "bb", name: "Goa Electricity", billDate: d1, dueDate: d1, status: "paid", paidByTxnId: "p1", amount: 4000, groupId: "g1", groupCollectiveAmount: 3445, splitPeople: {} }]);
  set("arth_txns", [{ id: "p1", type: "expense", desc: "Goa Electricity", merchant: "Goa Electricity", amount: 4000, date: d2, accId: "b1", paidBillId: "bb", paidBillName: "Goa Electricity", isBillPayment: true }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); }, [day(-5), day(-4)]);
const p = await ctx.newPage(); const errors = []; p.on("pageerror", e => errors.push(String(e)));
const T = id => p.getByTestId(id); const body = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
await p.goto(APP); await p.waitForTimeout(1300);
for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); }
await T("nav-today").click().catch(() => {}); await p.waitForTimeout(500);
await T("home-bell").click(); await p.waitForTimeout(600);
rec("F1 the bell lists 'Linked payments missing the bill's group · 1'", (await T("notif-billgroup").count()) === 1 && /missing the bill's group · 1/.test(await T("notif-billgroup").innerText()), await T("notif-billgroup").innerText().catch(() => ""));
await T("notif-billgroup").click(); await p.waitForTimeout(600);
const sheet = await T("billfix-sheet").innerText().catch(() => "");
rec("F2 the review sheet shows the payment with Now: no group and After: Neighbours, collect ₹3,445", (await T("billfix-row").count()) === 1 && /no group, nothing to collect/.test(sheet) && /Neighbours/.test(sheet) && /3,445/.test(sheet), sheet.slice(0, 300));
const before = await p.evaluate(() => JSON.parse(localStorage.getItem("arth_txns")).find(t => t.id === "p1"));
rec("F3 nothing is written before Fix", !before.groupId && !before.groupCollectiveAmount, before.groupId);
await T("billfix-apply").click(); await p.waitForTimeout(900);
const after = await p.evaluate(() => JSON.parse(localStorage.getItem("arth_txns")).find(t => t.id === "p1"));
rec("F4 Fix writes the bill's group and the collect amount, marked as a split", after.groupId === "g1" && after.groupCollectiveAmount === 3445 && after.trackingMode === "split", [after.groupId, after.groupCollectiveAmount, after.trackingMode]);
await T("home-bell").click().catch(() => {}); await p.waitForTimeout(500);
rec("F5 the notification is gone afterwards", (await T("notif-billgroup").count()) === 0, {});
await p.reload(); await p.waitForTimeout(1500);
const reloaded = await p.evaluate(() => JSON.parse(localStorage.getItem("arth_txns")).find(t => t.id === "p1"));
rec("F6 after the app reloads, the collect amount is still there (the loader resets it for entries marked only 'tag')", reloaded.groupCollectiveAmount === 3445 && reloaded.trackingMode === "split", [reloaded.groupCollectiveAmount, reloaded.trackingMode]);
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await b.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);

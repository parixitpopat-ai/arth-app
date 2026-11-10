// Prepaid plan alerts + the Ended/Paused connection wording, in the real app (Chromium, local Vite dev server, SYNTHETIC data). A CHROMIUM check only.
// Run: node tools/bills/prepaid-alerts-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4205, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const errors = [];
const ymd = off => { const d = new Date(); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
async function newPage(untilOffset, relStatus) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
  await ctx.addInitScript(({ until, from, relStatus }) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
    set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "p1", name: "Priya Test" }]);
    set("arth_biller_accounts", [{ id: "ba1", name: "Jio Test Line", type: "Mobile Prepaid", consumerNo: "9000000000" }]);
    set("arth_bills", [{ id: "bill1", billerAccountId: "ba1", billerCategory: "Mobile Prepaid", name: "Jio Test Line", merchant: "Jio", amount: 899, billDate: from, validFrom: from, validUntil: until, dueDate: from, status: "paid", paidDate: from, catIds: [] }]);
    if (relStatus) set("arth_membership_relationships", [{ id: "rel1", billerAccountId: "ba1", personId: "p1", targetType: "person", targetId: "p1", status: relStatus, statusHistory: [{ status: "active", effectiveDate: from }, ...(relStatus !== "active" ? [{ status: relStatus, effectiveDate: until }] : [])] }]);
    localStorage.setItem("arth_master_user_setup_complete", "true"); }, { until: ymd(untilOffset), from: ymd(untilOffset - 91), relStatus });
  const page = await ctx.newPage(); page.on("pageerror", e => errors.push(String(e)));
  return page;
}
const unlockOf = page => async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
const text = page => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
try {
  // 1 ── plan ended 10 days ago, connection live (no relationship): one 'ended' alert, bell badge, Recharge/Dismiss
  {
    const page = await newPage(-10, null), unlock = unlockOf(page), T = id => page.getByTestId(id);
    await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(500);
    rec("A1 the Home bell shows a count of 1", (await T("home-bell-badge").count()) === 1 && (await T("home-bell-badge").innerText()) === "1", {});
    await T("home-bell").dispatchEvent("click"); await page.waitForTimeout(500);
    const t = await text(page);
    rec("A2 Notifications says 'Jio Test Line ended 10 days ago' (stage post) with Recharge and Dismiss", /Jio Test Line ended 10 days ago/.test(t) && (await T("prepaid-alert").getAttribute("data-stage")) === "post" && (await T("prepaid-alert-recharge").count()) === 1, t.slice(0, 200));
    await T("prepaid-alert-dismiss").click(); await page.waitForTimeout(400);
    rec("A3 Dismiss removes it and the bell badge goes", (await T("prepaid-alert").count()) === 0, {});
    await page.close();
  }
  // 2 ── plan ends in 2 days: 'pre' stage; ends today: 'day' stage
  {
    const page = await newPage(2, null), unlock = unlockOf(page), T = id => page.getByTestId(id);
    await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(500);
    await T("home-bell").dispatchEvent("click"); await page.waitForTimeout(500);
    rec("B1 ends in 2 days -> 'ends in 2 days' (pre)", /Jio Test Line ends in 2 days/.test(await text(page)) && (await T("prepaid-alert").getAttribute("data-stage")) === "pre", {});
    await page.close();
    const p2 = await newPage(0, null), u2 = unlockOf(p2), T2 = id => p2.getByTestId(id);
    await p2.goto(APP); await p2.waitForTimeout(1200); await u2(); await p2.waitForTimeout(500);
    await T2("home-bell").dispatchEvent("click"); await p2.waitForTimeout(500);
    rec("B2 ends today -> 'ends today' (day)", /Jio Test Line ends today/.test(await text(p2)) && (await T2("prepaid-alert").getAttribute("data-stage")) === "day", {});
    await p2.close();
  }
  // 3 ── an active connection, expired: the alert is raised and the connection screen keeps the red warning + Recharge; then the person ENDS it
  {
    const page = await newPage(-10, "active"), unlock = unlockOf(page), T = id => page.getByTestId(id);
    await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(500);
    rec("C1 an active connection still alerts", (await T("home-bell-badge").count()) === 1, {});
    await page.getByText(/^payments$/i).last().dispatchEvent("click"); await page.waitForTimeout(800);
    await page.getByText("Billers", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(600);
    await page.getByText(/Broadband & Recharges/).first().dispatchEvent("click"); await page.waitForTimeout(500);
    await page.getByText(/Jio Test Line/).first().dispatchEvent("click"); await page.waitForTimeout(700);
    rec("C2 its screen says 'Expired 10 days ago' with the big Recharge button", /Expired 10 days ago/.test(await text(page)) && (await T("prepaid-recharge-btn").count()) === 1, {});
    await page.getByRole("button", { name: "End", exact: true }).first().click(); await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Confirm", exact: true }).first().click(); await page.waitForTimeout(500);
    rec("C2b ending without a reason asks for one (it used to crash to 'Something went wrong')", /Add a short reason/.test(await text(page)) && !/Something went wrong/.test(await text(page)), {});
    await page.getByPlaceholder(/Moved away/).fill("No longer needed"); await page.getByRole("button", { name: "Confirm", exact: true }).first().click(); await page.waitForTimeout(700);
    const t = await text(page);
    rec("C3 after the person taps End: the screen says 'Connection ended' (not 'Expired 10 days ago'), no big Recharge button, only a quiet 'Record a recharge anyway'", /Connection ended/.test(t) && !/Expired 10 days ago/.test(t) && (await T("prepaid-recharge-btn").count()) === 0 && (await T("prepaid-recharge-quiet").count()) === 1, t.slice(0, 120));
    await T("connection-sheet-close").click(); await page.waitForTimeout(500);
    rec("C4 and the bell badge is gone: an ended connection raises no alert", (await T("home-bell-badge").count()) === 0, {});
    await page.close();
  }
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);

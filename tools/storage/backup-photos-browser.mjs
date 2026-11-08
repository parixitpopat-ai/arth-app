// Backup copies without photos, in the real app (Chromium, local Vite dev server, SYNTHETIC photos). A CHROMIUM check only.
// Run: node tools/storage/backup-photos-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4194, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata", acceptDownloads: true });
await ctx.addInitScript(() => {
  if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  const photo = (seed, dots) => { const c = document.createElement("canvas"); c.width = 1400; c.height = 1000; const x = c.getContext("2d"); x.fillStyle = "#e8dcc8"; x.fillRect(0, 0, 1400, 1000);
    let s = seed; const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < dots; i++) { x.fillStyle = `rgba(${Math.floor(r() * 255)},${Math.floor(r() * 255)},${Math.floor(r() * 255)},.6)`; x.fillRect(r() * 1400, r() * 1000, 40, 40); } return c.toDataURL("image/jpeg", 0.85); };
  const shared = photo(5, 700), other = photo(11, 500);
  window.__shared = shared;
  localStorage.setItem("arth_accounts", JSON.stringify([{ id: "b1", name: "Test Bank", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]));
  localStorage.setItem("arth_txns", JSON.stringify([
    { id: "t1", type: "expense", amount: 111, date: "2026-11-01", merchant: "Synthetic A", desc: "A", imageBase64: shared },
    { id: "t2", type: "expense", amount: 222, date: "2026-11-02", merchant: "Synthetic B", desc: "B", imageBase64: other }]));
  localStorage.setItem("arth_bills", JSON.stringify([{ id: "bl1", name: "Synthetic power", amount: 900, dueDate: "2026-11-20", status: "paid", imageBase64: shared }]));
  localStorage.setItem("arth_master_user_setup_complete", "true");
});
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
page.on("dialog", d => d.accept());
const unlock = async () => { for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
const state = () => page.evaluate(async () => { const { unpackList } = await import("/src/sync/packedList.js");
  const auto = unpackList(localStorage.getItem("arth_auto_backups"));
  return { txns: JSON.parse(localStorage.getItem("arth_txns") || "[]"), bills: JSON.parse(localStorage.getItem("arth_bills") || "[]"), autoLen: (localStorage.getItem("arth_auto_backups") || "").length, liveLen: (localStorage.getItem("arth_txns") || "").length + (localStorage.getItem("arth_bills") || "").length, auto: auto.map(a => ({ omitted: (a.omitted || []).length, t1: a.snapshot?.txns?.[0]?.imageBase64?.length ?? null, t2: a.snapshot?.txns?.[1]?.imageBase64?.length ?? null, amounts: (a.snapshot?.txns || []).map(t => t.amount) })) }; });
try {
  await page.goto(APP); await page.waitForTimeout(1500); await unlock(); await page.waitForTimeout(1500);
  const s = await state();
  const origT1 = s.txns[0].imageBase64.length;
  rec("B0 the app made an automatic backup of the seeded data", s.auto.length >= 1, s.auto);
  rec("B1 that backup left out the photo the live data also holds, and records it", s.auto[0].t1 === 0 && s.auto[0].omitted >= 2 && s.auto[0].amounts.join() === "111,222", s.auto[0]);
  rec("B2 the live data still has every photo, untouched", origT1 > 50000 && s.txns[1].imageBase64.length > 50000 && s.bills[0].imageBase64.length === origT1, { t1: origT1 });
  rec("B3 the stored backup is far smaller than the live photos it stands for", s.autoLen < s.liveLen / 3, { backupChars: s.autoLen, liveChars: s.liveLen });

  // restore it through the real screen: the photos must come back
  await page.getByText("☰", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(400);
  await page.getByText("⚙️", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(400);
  await page.getByText("Backup & Restore", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Restore", exact: true }).first().click(); await page.waitForTimeout(2500);
  const r = await state();
  rec("B4 restoring that backup brings every photo back from the live data (nothing lost)", r.txns[0].imageBase64.length === origT1 && r.txns[1].imageBase64.length === s.txns[1].imageBase64.length && r.bills[0].imageBase64.length === origT1 && r.txns.map(t => t.amount).join() === "111,222", { t1: r.txns[0].imageBase64.length, bill: r.bills[0].imageBase64.length });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }), page.getByRole("button", { name: "Download", exact: true }).first().click()]);
  const fs = await import("node:fs"); const file = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
  const dlTxns = (file.snapshot || file).txns || [];
  rec("B5 downloading that backup as a file also has the photos back in it", dlTxns[0]?.imageBase64?.length === origT1, { len: dlTxns[0]?.imageBase64?.length });
  rec("B6 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
finally { await browser.close(); try { process.kill(-server.pid); } catch {} }
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);

// "Phone storage is full" guard, in the real app (Chromium, local Vite dev server, SYNTHETIC data, phone-width viewport).
// A CHROMIUM check with storage filled to the browser's own limit. It says nothing about Android or about the size limit on any phone.
// Run: node tools/storage/storage-full-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import fs from "node:fs";
const PORT = 4191, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata", acceptDownloads: true });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  localStorage.setItem("arth_accounts", JSON.stringify([{ id: "b1", name: "Test Bank", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]));
  localStorage.setItem("arth_txns", JSON.stringify([{ id: "live_1", type: "expense", amount: 123, date: "2026-11-01", vendor: "Test Shop" }])); localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const downloads = []; page.on("download", async d => { const p = await d.path(); downloads.push({ name: d.suggestedFilename(), text: fs.readFileSync(p, "utf8") }); });
const T = id => page.getByTestId(id);
const reload = async () => { await page.goto(APP); await page.waitForTimeout(1200); };
const unlock = async () => { for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
// Fill storage until the browser itself refuses a write; `backups` are real-looking copies of the data that the free-up step may remove.
const fillStorage = (withBackups) => page.evaluate((withBackups) => {
  const snap = { txns: Array.from({ length: 1500 }, (_, i) => ({ id: "t" + i, amount: i, note: "synthetic" })), savedAt: "2026-11-03T00:00:00Z" };
  if (withBackups) {
    const safety = Array.from({ length: 3 }, (_, i) => ({ id: "sb_" + i, reason: "r" + i, at: "2026-11-0" + (i + 1) + "T00:00:00Z", digest: "d" + i, txnCount: 1500, snapshot: snap, ...(i === 0 ? { pinned: true, conflictId: "c0", conflictIds: ["c0"] } : {}) }));
    localStorage.setItem("arth_sync_safety_backups", JSON.stringify(safety));
    localStorage.setItem("arth_auto_backups", JSON.stringify([{ id: "a1", backupType: "auto", exportedAt: "2026-11-03T00:00:00Z", snapshot: snap }]));
  }
  let n = 0, chunk = 100000;
  while (chunk >= 10) { try { localStorage.setItem("zz_fill_" + (n++), "x".repeat(chunk)); } catch { chunk = Math.floor(chunk / 4); } }
  try { localStorage.setItem("zz_probe", "x".repeat(32 * 1024)); localStorage.removeItem("zz_probe"); return false; } catch { return true; }
}, withBackups);

try {
  await reload(); await unlock();
  rec("S0 with room to spare the guard is not shown", (await T("storage-full-guard").count()) === 0, {});

  const full = await fillStorage(true);
  rec("S1 storage is genuinely full in Chromium (a 32 KB write is refused by the browser)", full, {});
  await reload();
  rec("S2 after reopening with full storage the guard appears over the app, with plain words and a size report", (await T("storage-full-guard").count()) === 1 && /Phone storage for Arth is full/.test(await T("storage-full-guard").innerText()) && /Backup copies kept on this phone/.test(await T("storage-report").innerText()), (await T("storage-report").count()) ? (await T("storage-report").innerText()).replace(/\n/g, " | ") : null);
  rec("S3 the free-up button is locked until both files are saved and confirmed", await T("storage-free").isDisabled() && await T("storage-confirm").isDisabled(), {});

  await T("storage-save-files").click(); await page.waitForTimeout(1500);
  const names = downloads.map(d => d.name);
  rec("S4 two files are downloaded", downloads.length === 2 && /arth-backup-copies/.test(names[0]) && /arth-everything-on-this-phone/.test(names[1]), names);
  const copies = JSON.parse(downloads[0]?.text || "{}"), raw = JSON.parse(downloads[1]?.text || "{}");
  rec("S5 the backup-copies file holds all 3 safety copies (incl. the pinned one) and the automatic copy", copies.safetyBackups?.length === 3 && copies.autoBackups?.length === 1 && copies.safetyBackups.some(b => b.pinned) && !!copies.snapshot, { safety: copies.safetyBackups?.length, auto: copies.autoBackups?.length });
  rec("S6 the raw file holds the live transaction and no sign-in token", String(raw.keys?.arth_txns || "").includes("live_1") && !Object.keys(raw.keys || {}).some(k => /^sb-/.test(k)), Object.keys(raw.keys || {}).length);

  await T("storage-confirm").check(); await page.waitForTimeout(200);
  rec("S7 after confirming, the free-up button unlocks", await T("storage-free").isEnabled(), {});
  const liveBefore = await page.evaluate(() => localStorage.getItem("arth_txns"));
  await T("storage-free").click(); await page.waitForTimeout(2500); await unlock();
  const after = await page.evaluate(async () => { const { unpackList } = await import("/src/sync/packedList.js"); return ({ txns: localStorage.getItem("arth_txns"), safety: unpackList(localStorage.getItem("arth_sync_safety_backups")).length, oldAuto: unpackList(localStorage.getItem("arth_auto_backups")).some(b => b.id === "a1"), oldSafety: unpackList(localStorage.getItem("arth_sync_safety_backups")).map(b => b.id), filler: Object.keys(localStorage).filter(k => k.startsWith("zz_fill_")).length }); });
  rec("S8 only backup copies were removed: live data identical, 1 safety copy kept, old automatic copy gone (the app may write a fresh one on reopening), unrelated keys untouched", after.txns === liveBefore && after.safety === 1 && after.oldSafety[0] === "sb_2" && !after.oldAuto && after.filler > 0, after.safety + " safety, filler " + after.filler);
  rec("S9 the guard is gone after the app reloads, and it can save again", (await T("storage-full-guard").count()) === 0 && await page.evaluate(() => { try { localStorage.setItem("zz_ok", "x".repeat(32 * 1024)); localStorage.removeItem("zz_ok"); return true; } catch { return false; } }), {});

  // Negative control: nothing left to free -> the guard must say so honestly instead of claiming success
  await page.evaluate(() => { localStorage.removeItem("arth_sync_safety_backups"); });
  await fillStorage(false); await reload();
  rec("S10 (control) full again with no backup copies: guard appears", (await T("storage-full-guard").count()) === 1, {});
  downloads.length = 0; await T("storage-save-files").click(); await page.waitForTimeout(1200); await T("storage-confirm").check(); await T("storage-free").click(); await page.waitForTimeout(800);
  rec("S11 (control) it does not claim success when nothing could be freed", /still tight/.test(await T("storage-result").innerText()) && (await T("storage-full-guard").count()) === 1, await T("storage-result").innerText());
  await T("storage-not-now").click(); await page.waitForTimeout(300);
  rec("S12 'Not now' hides it", (await T("storage-full-guard").count()) === 0, {});
  // early warning: some room (about 100 KB) but not a comfortable amount
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("zz_fill_")) localStorage.removeItem(k); });
  await page.evaluate(() => { let n = 0; try { for (;;) localStorage.setItem("zz_sq_" + (n++), "x".repeat(50000)); } catch {} let removed = 0; for (const k of Object.keys(localStorage)) if (k.startsWith("zz_sq_") && removed < 2) { localStorage.removeItem(k); removed++; } });
  await reload();
  rec("S14 with only ~100 KB of room left, a small early warning shows instead of the full-screen guard", (await T("storage-low-strip").count()) === 1 && (await T("storage-full-guard").count()) === 0, {});
  await T("storage-low-dismiss").click(); await page.waitForTimeout(300);
  rec("S15 the early warning can be dismissed", (await T("storage-low-strip").count()) === 0, {});
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("zz_sq_")) localStorage.removeItem(k); });
  await reload();
  rec("S16 (control) with plenty of room neither shows", (await T("storage-low-strip").count()) === 0 && (await T("storage-full-guard").count()) === 0, {});
  rec("S13 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 300)); }
finally { await browser.close(); try { process.kill(-server.pid); } catch {} }
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);

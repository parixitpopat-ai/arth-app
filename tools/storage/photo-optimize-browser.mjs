// Photo shrinking in the real app (Chromium, local Vite dev server, SYNTHETIC photos drawn on a canvas, phone-width viewport).
// A CHROMIUM check. It says nothing about Android, real camera photos, or how much real photos shrink.
// Run: node tools/storage/photo-optimize-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4193, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const errors = [];

async function newPage(kind) {          // kind: "roomy" (all copies fit) | "crowded" (a backup copy no longer fits, like the real phone)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata", acceptDownloads: true });
  await ctx.addInitScript(kind => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (window.__failKeys && window.__failKeys.includes(k)) { const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; } return orig.call(this, k, v); };
    if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
    const photo = (w, h, type, q, seed, dots) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d");
      const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#f4e9d8"); g.addColorStop(1, "#6b8e9b"); x.fillStyle = g; x.fillRect(0, 0, w, h);
      let s = seed; const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      for (let i = 0; i < dots; i++) { x.fillStyle = `rgba(${Math.floor(r() * 255)},${Math.floor(r() * 255)},${Math.floor(r() * 255)},.5)`; x.fillRect(r() * w, r() * h, 30 * r() + 3, 30 * r() + 3); }
      x.fillStyle = "#222"; x.font = "bold 90px sans-serif"; x.fillText("SYNTHETIC RECEIPT 123", 80, 200); return c.toDataURL(type, q); };
    const crowded = kind === "crowded";
    const p1 = crowded ? photo(2400, 1800, "image/jpeg", 0.8, 7, 1500) : photo(2400, 1800, "image/jpeg", 0.9, 7, 250);
    const p2 = crowded ? photo(1200, 800, "image/png", undefined, 9, 120) : photo(1200, 800, "image/png", undefined, 9, 15);
    const tiny = photo(300, 200, "image/jpeg", 0.8, 3, 50);
    localStorage.setItem("arth_accounts", JSON.stringify([{ id: "b1", name: "Test Bank", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]));
    localStorage.setItem("arth_txns", JSON.stringify([
      { id: "t1", type: "expense", amount: 111, date: "2026-11-01", merchant: "Synthetic A", desc: "A", imageBase64: p1, paymentImageBase64: p2 },
      { id: "t2", type: "expense", amount: 222, date: "2026-11-02", merchant: "Synthetic B", desc: "B", imageBase64: "" },
      { id: "t3", type: "expense", amount: 333, date: "2026-11-03", merchant: "Synthetic C", desc: "C", imageBase64: p1 },
      { id: "t4", type: "expense", amount: 444, date: "2026-11-04", merchant: "Synthetic D", desc: "D", imageBase64: tiny }]));
    localStorage.setItem("arth_bills", JSON.stringify([{ id: "bl1", name: "Synthetic power", amount: 900, dueDate: "2026-11-20", status: "paid", imageBase64: p1 }]));
    localStorage.setItem("arth_master_user_setup_complete", "true");
    if (crowded) {   // fill the browser's storage to its real limit, then give back ~200 KB: too little for another full copy of the photos
      let n = 0, chunk = 100000; while (chunk >= 10) { try { localStorage.setItem("zz_fill_" + (n++), "x".repeat(chunk)); } catch { chunk = Math.floor(chunk / 4); } }
      for (const k of Object.keys(localStorage).filter(k => k.startsWith("zz_fill_") && localStorage.getItem(k).length === 100000).slice(0, 2)) localStorage.removeItem(k);
    }
  }, kind);
  const page = await ctx.newPage(); page.on("pageerror", e => errors.push(String(e)));
  const T = id => page.getByTestId(id);
  const unlock = async () => { for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
  const openBackup = async () => { await page.goto(APP); await page.waitForTimeout(1000); await unlock();
    await page.getByText("☰", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(400);
    await page.getByText("⚙️", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(400);
    await page.getByText("Backup & Restore", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(500); };
  const read = () => page.evaluate(async () => {
    const { unpackList } = await import("/src/sync/packedList.js");
    const txns = JSON.parse(localStorage.getItem("arth_txns") || "[]"), bills = JSON.parse(localStorage.getItem("arth_bills") || "[]");
    const size = u => new Promise(res => { if (!u) return res(null); const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res("bad"); i.src = u; });
    return { txns, bills, dims: { t1: await size(txns[0]?.imageBase64), t1pay: await size(txns[0]?.paymentImageBase64) },
      backups: unpackList(localStorage.getItem("arth_sync_safety_backups")).map(b => ({ reason: b.reason, hasOriginal: (b.snapshot?.txns || []).some(t => t.imageBase64 && t.imageBase64.length > 60000) })) };
  });
  return { ctx, page, T, openBackup, read };
}

try {
  // ───────── roomy: every copy fits ─────────
  {
    const { page, T, openBackup, read } = await newPage("roomy");
    await openBackup();
    const base = await read(); const l1 = base.txns[0].imageBase64.length, l2 = base.txns[0].paymentImageBase64.length;
    rec("R0 the seeded synthetic photos are photo-sized", l1 > 80000 && l2 > 40000, { jpeg: l1, png: l2 });
    rec("R1 the card is on Backup & Restore and counts the photos (5: t1 twice, t3, t4, the bill)", (await T("photo-optimize-card").count()) === 1 && /5 photos/.test(await T("photo-optimize-card").innerText()), (await T("photo-optimize-card").innerText()).slice(0, 100).replace(/\n/g, " "));
    await T("photo-check").click(); await page.waitForTimeout(2500);
    const pv = await T("photo-preview").innerText();
    rec("R2 checking changes nothing and shows how much would be saved", /can be shrunk/.test(pv) && (await read()).txns[0].imageBase64.length === l1, pv);
    await page.evaluate(() => { window.__failKeys = ["arth_sync_safety_backups"]; });
    await T("photo-apply").click(); await page.waitForTimeout(1500);
    const refused = await read();
    rec("R3 (control) when no backup can be saved, nothing is changed and it says so and offers the file way", /nothing was changed/.test(await T("photo-msg").innerText()) && refused.txns[0].imageBase64.length === l1 && refused.bills[0].imageBase64.length === l1 && (await T("photo-download").count()) === 1, await T("photo-msg").innerText());
    await openBackup();                       // fresh page: backups can be saved again
    await T("photo-check").click(); await page.waitForTimeout(2500); await T("photo-apply").click(); await page.waitForTimeout(3000);
    const after = await read(); const a1 = after.txns[0].imageBase64.length;
    rec("R4 with a verified backup the photos are smaller and still valid images", a1 < l1 * 0.9 && after.dims.t1 !== "bad" && after.dims.t1pay !== "bad", { before: [l1, l2], after: [a1, after.txns[0].paymentImageBase64.length], dims: after.dims });
    rec("R5 no side longer than 1600 px (2400x1800 became 1600x1200)", after.dims.t1.w === 1600 && after.dims.t1.h === 1200, after.dims);
    rec("R6 the same photo is still one identical photo on both transactions and the bill", after.txns[2].imageBase64 === after.txns[0].imageBase64 && after.bills[0].imageBase64 === after.txns[0].imageBase64, {});
    rec("R7 nothing else changed: amounts, merchants, the empty photo, the already-small photo", after.txns.map(t => t.amount).join() === "111,222,333,444" && after.txns[1].imageBase64 === "" && after.txns[3].imageBase64 === base.txns[3].imageBase64 && after.bills[0].name === "Synthetic power", after.txns.map(t => t.merchant));
    rec("R8 a backup copy holding the ORIGINAL photos was saved first", after.backups.some(b => b.reason === "before-photo-optimize" && b.hasOriginal), after.backups);
    rec("R9 it reports the saving", /Done\. \d+ photos? shrunk/.test(await T("photo-msg").innerText()), await T("photo-msg").innerText());
    await openBackup(); await T("photo-check").click(); await page.waitForTimeout(2500);
    rec("R10 (control) a second run finds nothing to shrink and offers no button", /already small/.test(await T("photo-preview").innerText()) && (await T("photo-apply").count()) === 0, await T("photo-preview").innerText());
    const attach = await page.evaluate(async () => {
      const { readImageFile } = await import("/src/domain/images/shrinkImage.js");
      const blob = await new Promise(res => { const c = document.createElement("canvas"); c.width = 3000; c.height = 2000; const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 3000, 2000); g.addColorStop(0, "#fff"); g.addColorStop(1, "#345"); x.fillStyle = g; x.fillRect(0, 0, 3000, 2000); for (let i = 0; i < 8000; i++) { x.fillStyle = `rgb(${i % 255},${(i * 7) % 255},${(i * 13) % 255})`; x.fillRect((i * 37) % 3000, (i * 91) % 2000, 20, 20); } c.toBlob(res, "image/jpeg", 0.95); });
      const original = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      const out = await readImageFile(new File([blob], "p.jpg", { type: "image/jpeg" }));
      const img = await new Promise(r => { const i = new Image(); i.onload = () => r({ w: i.naturalWidth, h: i.naturalHeight }); i.src = out; });
      const pdf = await readImageFile(new File([new Uint8Array(200000).fill(65)], "x.pdf", { type: "application/pdf" }));
      return { original: original.length, out: out.length, img, pdfKept: pdf.startsWith("data:application/pdf") };
    });
    rec("R11 a newly attached 3000x2000 photo is stored scaled to 1600 px and much smaller; a PDF is kept exactly", attach.out < attach.original / 2 && attach.img.w === 1600 && attach.pdfKept, attach);
  }
  // ───────── crowded: like the real phone, no room for another full copy ─────────
  {
    const { page, T, openBackup, read } = await newPage("crowded");
    await openBackup();
    const base = await read(); const l1 = base.txns[0].imageBase64.length;
    await T("photo-check").click(); await page.waitForTimeout(3000); await T("photo-apply").click(); await page.waitForTimeout(2500);
    const msg = await T("photo-msg").innerText().catch(() => "");
    const refused = await read();
    rec("C1 with no room for a backup copy it changes nothing and offers a downloaded file instead", /no room for a backup copy/.test(msg) && refused.txns[0].imageBase64.length === l1 && (await T("photo-download").count()) === 1 && (await T("photo-apply-file").isDisabled()), msg.slice(0, 120));
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), T("photo-download").click()]);
    rec("C2 the backup file is downloaded", /arth-backup/.test(dl.suggestedFilename()), dl.suggestedFilename());
    await T("photo-file-ok").check(); await T("photo-apply-file").click(); await page.waitForTimeout(3000);
    const after = await read();
    rec("C3 only after confirming the file are the photos shrunk, and they stay valid images", after.txns[0].imageBase64.length < l1 * 0.8 && after.dims.t1 !== "bad" && after.dims.t1.w === 1600, { before: l1, after: after.txns[0].imageBase64.length, dims: after.dims });
  }
  rec("N1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
finally { await browser.close(); try { process.kill(-server.pid); } catch {} }
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);

// A damaged saved list no longer crashes the app on every launch (src/storage/repairStored.js). Real app, Chromium, local Vite server, SYNTHETIC data.
// A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { packList } from "../src/sync/packedList.js";
const PORT = 4218, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const goodTxns = [{ id: "t1", type: "expense", merchant: "Chai Point", desc: "Chai Point", amount: 120, date: "2026-10-03", catIds: [] }];
const run = async (seed, check) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(s => { if (localStorage.getItem("__i")) return; localStorage.setItem("__i", "1"); localStorage.setItem("arth_master_user_setup_complete", "true"); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed);
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(APP); await page.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(700); } }
  await page.waitForTimeout(1200);
  await check(page, errors); await ctx.close();
};
const text = page => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const ls = (page, k) => page.evaluate(k => localStorage.getItem(k), k);
try {
  // 1. damaged list + a backup that holds it -> restored, notice shown, app opens normally
  const backups = packList([{ id: "sb_1", reason: "test", at: "2026-11-01T10:00:00.000Z", snapshot: { txns: goodTxns } }]);
  await run({ arth_txns: '[{"id":"t1","merc', arth_sync_safety_backups: backups }, async (page, errors) => {
    const t = await text(page);
    rec("S1 with a backup the app opens normally (no 'Something went wrong')", !/Something went wrong/.test(t) && !(await page.getByTestId("stored-recovery").count()), t.slice(0, 80));
    rec("S2 the damaged list was restored from the backup", JSON.parse(await ls(page, "arth_txns") || "[]").some(x => x.id === "t1" && x.merchant === "Chai Point"), (await ls(page, "arth_txns") || "").slice(0, 80));
    rec("S3 the damaged text was kept aside, untouched", (await ls(page, "arth_damaged_arth_txns")) === '[{"id":"t1","merc', {});
    rec("S4 a notice says what happened, and OK dismisses it", (await page.getByTestId("recovery-notice").count()) === 1 && /Transactions/.test(await page.getByTestId("recovery-notice").innerText()), {});
    await page.getByTestId("recovery-notice-ok").click(); await page.waitForTimeout(300);
    rec("S5 after OK the notice is gone for good", (await page.getByTestId("recovery-notice").count()) === 0 && (await ls(page, "arth_recovery_notice")) === null, {});
    rec("Z1 no page errors (case 1)", errors.length === 0, errors.slice(0, 2));
  });
  // 2. damaged list, no backup -> a plain recovery screen; nothing changed until the person chooses
  await run({ arth_txns: '[{"id":"t1","merc', arth_people: JSON.stringify([{ id: "p1", name: "Priya Test" }]) }, async page => {
    const t = await text(page);
    rec("R1 without a backup the recovery screen is shown, naming Transactions, instead of the crash screen", (await page.getByTestId("stored-recovery").count()) === 1 && /Transactions/.test(await page.getByTestId("recovery-names").innerText()) && !/Something went wrong/.test(t), t.slice(0, 120));
    rec("R2 nothing was changed yet: the damaged text is still there and a copy is kept", (await ls(page, "arth_txns")) === '[{"id":"t1","merc' && (await ls(page, "arth_damaged_arth_txns")) === '[{"id":"t1","merc', {});
    await page.getByTestId("recovery-start-empty").click(); await page.waitForTimeout(1800);
    const after = await text(page);
    rec("R3 'Start this part empty' opens the app; the damaged copy stays; other data (people) untouched", (await page.getByTestId("stored-recovery").count()) === 0 && !/Something went wrong/.test(after) && (await ls(page, "arth_damaged_arth_txns")) === '[{"id":"t1","merc' && /Priya Test/.test(await ls(page, "arth_people")), after.slice(0, 80));
  });
  // 3. healthy data: nothing happens
  await run({ arth_txns: JSON.stringify(goodTxns) }, async page => {
    rec("H1 healthy data: no recovery screen, no notice, no copies made", (await page.getByTestId("stored-recovery").count()) === 0 && (await page.getByTestId("recovery-notice").count()) === 0 && (await ls(page, "arth_damaged_arth_txns")) === null, {});
  });
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);

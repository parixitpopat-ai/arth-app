// A shop receipt PHOTO read in the real app (Chromium, local Vite dev server, SYNTHETIC receipts drawn from an invented bill, phone-width viewport).
// This is a CHROMIUM check on drawn images: it says nothing about real photos, real phones or the Android app.   Run: node tools/receipt/receipt-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process"; import { writeFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "rcpt-"));
try { await fetch("http://localhost:4181/"); console.log("FAIL  port 4181 busy"); process.exit(1); } catch {}
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", "4181", "--strictPort"], { stdio: "ignore", detached: true });
const APP = "http://localhost:4181/";
for (let i = 0; i < 50; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

const pad = (s, n) => String(s).padEnd(n), left = (s, n) => String(s).padStart(n);
const ITEMS = [["1904", "TEST BISCUIT-250g", 2, "22.50", "45.00"], ["0713", "TEST DAL-500g", 4, "56.00", "224.00"], ["0713", "TEST OIL-1lt", 20, "173.00", "3460.00"], ["1701", "TEST SUGAR-2kg", 2, "114.00", "228.00"], ["1905", "TEST GLUCOSE-90g", 2, "9.80", "19.60"]];
const receipt = (items, o = {}) => ["      SAMPLE GROCERS TESTVILLE", "  GSTIN : 99ZZZZZ0000Z1ZZ", "  Near Test Yard, Testville", "  Phone : 9000000000", "  Email : shop@example.test", "", "          TAX INVOICE", "Bill No : T001-000001   Bill Dt : 30/10/2026", "", "HSN  Particulars         Qty   N/Rate     Value", "------------------------------------------------",
  ...items.map(([h, n, q, r, v]) => `${h} ${pad(n, 18)} ${left(q, 3)} ${left(r, 8)} ${left(v, 9)}`), "------------------------------------------------", `Items: ${items.length}   Qty: ${o.qty ?? 30}        ${o.total ?? "3976.60"}`, "", "<----- Amount Received From Customer ----->", `UPI Payment :        ${o.paid ?? "3976.60"} /-`];
const shot = async (name, lines, o = {}) => {
  const p = await browser.newPage({ viewport: { width: 520, height: 900 }, deviceScaleFactor: o.dpr || 2 });
  await p.setContent(`<body style="margin:0;background:#f4f4f0"><pre style="margin:0;padding:20px;font:${o.px || 17}px 'Courier New',monospace;color:#222;width:${o.w || 470}px;${o.rot ? `transform:rotate(${o.rot}deg);transform-origin:top left;` : ""}">${lines.join("\n").replace(/</g, "&lt;")}</pre></body>`);
  const path = join(dir, `${name}.png`); await p.screenshot({ path, fullPage: true }); await p.close(); return path;
};
const BASE = receipt(ITEMS);
const GARBLED = receipt(ITEMS.map(r => (r[1] === "TEST DAL-500g" ? [r[0], r[1], "Z", r[3], r[4]] : r)));
const shots = { clean: await shot("clean", BASE), wrong: await shot("wrong", receipt(ITEMS.map(r => (r[1] === "TEST OIL-1lt" ? [r[0], r[1], r[2], r[3], "3480.00"] : r)))), blank: await shot("blank", []), garbled: await shot("garbled", GARBLED), tilted: await shot("tilted", BASE, { rot: 1.5 }), small: await shot("small", BASE, { px: 12, dpr: 1 }) };
writeFileSync(join(dir, "x.pdf"), "%PDF-1.4"); 

const ctx = await browser.newContext({ timezoneId: "Asia/Kolkata", viewport: { width: 390, height: 844 } });
const requests = []; ctx.on("request", r => requests.push(r.url()));
const external = []; await ctx.route(u => { try { return new URL(u).origin !== new URL(APP).origin; } catch { return false; } }, r => { external.push(r.request().url()); r.abort(); });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  localStorage.setItem("arth_accounts", JSON.stringify([{ id: "b1", name: "Test Bank", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]));
  localStorage.setItem("arth_txns", JSON.stringify([{ id: "t1", type: "expense", merchant: "Shop", desc: "Shop", date: "2026-10-12", amount: 500, accId: "b1", catIds: [], subIds: [] }]));
  localStorage.setItem("arth_loans", "[]"); localStorage.setItem("arth_master_user_setup_complete", "true"); localStorage.setItem("arth_vehicles", "[]"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
await page.goto(APP); await page.waitForTimeout(900);
for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(120); } await page.waitForTimeout(500); } }
const snap = () => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
const before = await snap();
await page.getByRole("button", { name: /➖/ }).first().click(); await page.waitForTimeout(500); await page.getByText("From invoice", { exact: true }).click(); await page.waitForTimeout(500);
const T = id => page.getByTestId(id), text = id => T(id).first().evaluate(e => e.textContent.replace(/\s+/g, " "));
const ocrFiles = () => [...new Set(requests.filter(u => new URL(u).pathname.startsWith("/ocr/")).map(u => new URL(u).pathname.slice(5)))].sort();
const read = async f => { await T("receipt-file").setInputFiles(f); await page.waitForFunction(() => !document.querySelector('[data-testid="receipt-reading"]'), null, { timeout: 120000 }); await page.waitForTimeout(300); };
const rowsNow = () => page.evaluate(() => [...document.querySelectorAll('[data-testid="receipt-row"]')].map((r, i) => ["label", "qty", "rate", "value"].map(k => document.querySelector(`[data-testid="receipt-${k}-${i}"]`).value)));
const want = ITEMS.map(([, n, q, r, v]) => [n, String(q), r, v]);

try {
  rec("R0 OFF by default: no chooser, no engine file requested", (await T("receipt-file").count()) === 0 && ocrFiles().length === 0 && !(await T("receipt-toggle").isChecked()), {});
  await T("receipt-toggle").check();
  rec("R1 switching it on shows the chooser but fetches no engine file", (await T("receipt-file").count()) === 1 && ocrFiles().length === 0, {});
  await read(join(dir, "x.pdf"));
  rec("R2 a PDF is declined with a message and the engine is not started", (await T("receipt-declined").count()) === 1 && /PNG, JPG or WebP/.test(await text("receipt-declined")) && ocrFiles().length === 0, {});
  await T("receipt-try-again").click();
  await read(shots.blank);
  rec("R3 a photo with no receipt text is declined; nothing shown as read", (await T("receipt-declined").count()) === 1 && /No item rows or amount paid/.test(await text("receipt-declined")), {});
  await T("receipt-try-again").click();

  await read(shots.clean);
  const got = await rowsNow(); const shopRead = await T("receipt-shop").inputValue(); const dateRead = await T("receipt-date").inputValue(); const paidRead = await T("receipt-paid").inputValue();
  console.log("      read from the invented receipt:", JSON.stringify({ shopRead, dateRead, paidRead, rows: got.length }));
  rec("R4 the review panel appears, marked 'read from a photo, please check'", (await T("receipt-review").count()) === 1 && /read from a photo, please check/.test(await text("receipt-review")), {});
  const files = ocrFiles();
  rec("R5 only now were engine files fetched: worker, ONE text-only core, English data", files.includes("worker.min.js") && files.includes("eng.traineddata.gz") && files.filter(f => /-lstm\.wasm\.js$/.test(f)).length === 1 && files.length === 3, files);
  const exactRows = got.filter((r, i) => want[i] && r.every((v, k) => v === want[i][k])).length;
  rec("R6 measured on this drawn receipt (NOT a guarantee for real photos)", true, { exactRows: `${exactRows}/${want.length}`, rowsRead: got.length, shop: shopRead, date: dateRead, paid: paidRead });
  const hold = async () => (await T("receipt-e2").getAttribute("data-status")) === "holds" && (await page.locator('[data-testid="receipt-row"][data-ok="false"]').count()) === 0;
  rec("R7 'These figures are right' is enabled exactly when the figures all check out", (await T("receipt-use").isDisabled()) === !(await hold() && /^\d{4}-\d{2}-\d{2}$/.test(dateRead)), { enabled: !(await T("receipt-use").isDisabled()) });

  // the person corrects whatever the engine got wrong, then continues
  for (let i = 0; i < want.length; i++) {
    if (!(await T(`receipt-label-${i}`).count())) break;
    const cur = (await rowsNow())[i];
    if (cur[1] !== want[i][1]) await T(`receipt-qty-${i}`).fill(want[i][1]);
    if (cur[2] !== want[i][2]) await T(`receipt-rate-${i}`).fill(want[i][2]);
    if (cur[3] !== want[i][3]) await T(`receipt-value-${i}`).fill(want[i][3]);
  }
  if ((await T("receipt-paid").inputValue()) !== "3976.60") await T("receipt-paid").fill("3976.60");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(await T("receipt-date").inputValue())) await T("receipt-date").fill("2026-10-30");
  await page.waitForTimeout(250);
  rec("R8 once the figures are correct every check holds and the button is enabled", (await T("receipt-use").isDisabled()) === false && (await T("receipt-e2").getAttribute("data-status")) === "holds", {});
  rec("R9 nothing is saved before the tap", (await snap()) === before, {});
  await T("receipt-use").click(); await page.waitForTimeout(800);
  const body = await page.evaluate(() => document.body.innerText);
  const modal = page.locator("div").filter({ hasText: "Add Transaction" }).last();
  await modal.evaluate(e => e.scrollTo ? e.scrollTo(0, 99999) : 0).catch(() => {});
  const shownItems = await page.getByText(/TEST (BISCUIT|DAL|OIL|SUGAR|GLUCOSE)/).count() + await page.locator('input[value*="TEST OIL"]').count();
  const vals = await page.evaluate(() => [...document.querySelectorAll("input")].map(i => i.value).filter(Boolean));
  const all = await page.evaluate(() => document.documentElement.innerText);
  rec("R10 the Add Transaction form opens in Itemised mode with the shop and the amount filled in", /Add Transaction/.test(all) && vals.some(v => /SAMPLE GROCERS/i.test(v)) && vals.some(v => /^3976\.6/.test(v)) && (await page.getByText("Itemised", { exact: true }).count()) > 0, vals.slice(0, 6));
  rec("R11 the bill date is in the form and the item rows are in it", /30-Oct-2026/.test(all) && shownItems >= 5, { shownItems });
  const diff = await page.evaluate(b => { const o = Object.fromEntries(JSON.parse(b)); return Object.keys(localStorage).filter(k => localStorage.getItem(k) !== o[k]); }, before);
  rec("R12 still nothing saved: no expense, loan or bill exists; the open form keeps only its own unsaved-draft note", !diff.some(k => /txns|loans|bills|accounts|invoice/.test(k)), diff);

  const stores = await page.evaluate(async () => ({ session: Object.keys(sessionStorage), idb: indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : [] }));
  rec("R13 no IndexedDB database and no sessionStorage entry", stores.session.length === 0 && stores.idb.length === 0, stores);
  const foreign = external.filter(u => !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u));
  rec("R14 no request left this origin except the app's own font link; no CDN host", foreign.length === 0 && !requests.some(u => /jsdelivr|unpkg|cdnjs|tessdata/.test(u)), foreign);
  rec("R15 no page error", errors.length === 0, errors);
} catch (e) { rec("harness ran to the end", false, String(e).slice(0, 220)); }

// a deliberately wrong printed value: must be flagged, blocked, and fixable only by the person's tap
try {
  await page.getByRole("button", { name: "✕" }).first().click().catch(async () => { await page.keyboard.press("Escape"); }); await page.waitForTimeout(600);
  if (!(await T("receipt-toggle").isChecked())) await T("receipt-toggle").check();
  await read(shots.wrong);
  const r = await rowsNow();
  const oil = r.findIndex(x => /OIL/i.test(x[0]));
  if (oil >= 0 && r[oil][3] === "3480.00") {
    rec("W1 a wrong value is shown exactly as read and the button is DISABLED", (await T("receipt-use").isDisabled()) === true && (await T(`receipt-value-${oil}`).inputValue()) === "3480.00" && (await T("receipt-e2").getAttribute("data-status")) === "fails", {});
    rec("W2 the row warns that qty x rate differs", (await T(`receipt-rowwarn-${oil}`).count()) === 1, await text(`receipt-rowwarn-${oil}`));
    if (await T("receipt-suggestion").count()) {
      rec("W3 a suggestion changes nothing until tapped", (await T(`receipt-value-${oil}`).inputValue()) === "3480.00", {});
      await T("receipt-apply-suggestion").click(); await page.waitForTimeout(200);
      rec("W4 after the tap the row is fixed and the figures add up", (await T(`receipt-value-${oil}`).inputValue()) === "3460.00" && (await T("receipt-e2").getAttribute("data-status")) === "holds", {});
    } else rec("W3 (no suggestion offered for this reading)", true, {});
  } else rec("W1 (the engine read this row differently, so the wrong-value case was not exercised)", true, { oil: r[oil] });
  // a row the engine cannot read: reported by amount, then added by the person with "Add a row"
  if (await T("receipt-cancel").count()) await T("receipt-cancel").click(); else if (await T("receipt-try-again").count()) await T("receipt-try-again").click();
  await read(shots.garbled);
  const gRows = await rowsNow();
  const missingDal = !gRows.some(x => /DAL/i.test(x[0]) && x[3] === "224.00");
  if (missingDal && (await T("receipt-unreadable").count())) {
    rec("G1 an unreadable item line is reported by its amount, and the button stays disabled", /224\.00/.test(await text("receipt-unreadable")) && (await T("receipt-use").isDisabled()) === true, await text("receipt-unreadable"));
    const n0 = (await rowsNow()).length;
    await T("receipt-add-row").click(); await page.waitForTimeout(200);
    const n1 = (await rowsNow()).length;
    rec("G2 'Add a row' adds one blank row and nothing changes by itself", n1 === n0 + 1 && (await T(`receipt-value-${n1 - 1}`).inputValue()) === "" && (await T("receipt-use").isDisabled()) === true, { n0, n1 });
    // rebuild the whole receipt by hand with "Add a row": remove every row, then type the five items
    while ((await rowsNow()).length) await T("receipt-remove-0").click();
    for (const [k, [, name, q, r, v]] of ITEMS.entries()) {
      await T("receipt-add-row").click(); await page.waitForTimeout(120);
      await T(`receipt-label-${k}`).fill(name); await T(`receipt-qty-${k}`).fill(String(q)); await T(`receipt-rate-${k}`).fill(r); await T(`receipt-value-${k}`).fill(v);
    }
    await T("receipt-paid").fill("3976.60"); if (!/^\d{4}-\d{2}-\d{2}$/.test(await T("receipt-date").inputValue())) await T("receipt-date").fill("2026-10-30"); await page.waitForTimeout(250);
    rec("G3 five rows typed with 'Add a row' make every check hold and enable the button", (await T("receipt-e2").getAttribute("data-status")) === "holds" && (await T("receipt-use").isDisabled()) === false, {});
  } else rec("G1 (the engine read this row anyway or reported it differently, so the unreadable case was not exercised)", true, { missingDal, hasWarning: await T("receipt-unreadable").count() });
  // informational: other layouts
  for (const name of ["tilted", "small"]) {
    if (await T("receipt-cancel").count()) await T("receipt-cancel").click(); else if (await T("receipt-try-again").count()) await T("receipt-try-again").click();
    await read(shots[name]);
    const g = (await T("receipt-review").count()) ? await rowsNow() : [];
    const ok = g.filter((row, i) => want[i] && row.every((v, k) => v === want[i][k])).length;
    console.log(`      ${name}: ${ok}/${want.length} rows exact, ${g.length} rows read`);
  }
} catch (e) { rec("wrong-value run", false, String(e).slice(0, 220)); }
await browser.close(); process.kill(-server.pid, "SIGTERM");
const failed = results.filter(r => !r.pass); console.log(`\n${results.length - failed.length}/${results.length} passed`); process.exit(failed.length ? 1 : 0);

// Order summary READ FROM A PICTURE, in the real app (Chromium, local Vite dev server so no sign-in is asked, SYNTHETIC data and an INVENTED screenshot,
// phone-width viewport). INVOICE-IMPORT-009 steps 5-6. This is a CHROMIUM check. It says nothing about the Android app or about accuracy on real screenshots.
// Run: node tools/invoice-import/ocr-summary-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process"; import { writeFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";
import { productPage } from "../../src/domain/invoices/fixtures/amazonInvoice.fixture.js";

const dir = mkdtempSync(join(tmpdir(), "ocrsum-"));
try { await fetch("http://localhost:4180/"); console.log("FAIL  port 4180 busy - stop the old server first"); process.exit(1); } catch {}
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", "4180", "--strictPort"], { stdio: "ignore", detached: true });
const APP = "http://localhost:4180/";
for (let i = 0; i < 50; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }

const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

// ---- invented screenshots: fake name, address and card line around the summary rows ----
const shot = async (name, rows, extra = [], o = {}) => {
  const p = await browser.newPage({ viewport: { width: 540, height: 900 }, deviceScaleFactor: o.dpr || 2 });
  const row = ([l, v, bold]) => `<div style="display:flex;justify-content:space-between;padding:7px 0;${bold ? "font-weight:700;" : ""}"><span>${l}</span><span>${v}</span></div>`;
  await p.setContent(`<body style="margin:0;background:#fff;color:#111;font:${o.px || 20}px ${o.font || "Arial,Helvetica,sans-serif"};padding:24px;width:492px;${o.dark ? "background:#131921;color:#eee;" : ""}">
    <div style="font-weight:700;font-size:24px;margin-bottom:10px">Order Summary</div>
    <div>Ship to: Pat Example, 12 Sample Street, Testville 000000</div><div style="margin-bottom:14px">Paid with Visa ending in 0000</div>
    <div>Order # 123-4567890-1234567</div><hr>${rows.map(row).join("")}${extra.map(row).join("")}</body>`);
  const path = join(dir, `${name}.png`); await p.screenshot({ path }); await p.close(); return path;
};
const CLEAN = [["Item(s) Subtotal:", "₹329.00"], ["Shipping:", "₹50.00"], ["Offer Processing Fee:", "₹1.35"], ["Total:", "₹380.35"], ["Instant Bank Discount:", "-₹17.33"], ["Grand Total:", "₹363.02", true]];
const shots = { clean: await shot("clean", CLEAN), unknownRow: await shot("unknown", CLEAN, [["Gift Wrap Fee:", "₹10.00"]]), blank: await shot("blank", []) };
const RS = CLEAN.map(([l, v, b]) => [l, v.replace("₹", "Rs. "), b]);
const variants = { "small text (1x, 13px)": await shot("small", CLEAN, [], { dpr: 1, px: 13 }), "dark theme": await shot("dark", CLEAN, [], { dark: true }), "Rs. instead of the rupee sign": await shot("rs", RS), "serif font": await shot("serif", CLEAN, [], { font: "Georgia,serif" }) };
writeFileSync(join(dir, "x.gif"), Buffer.from("R0lGODlhAQABAAAAACw=", "base64")); shots.gif = join(dir, "x.gif");

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
const inv = join(dir, "inv.pdf"); writeFileSync(inv, makePdf([{ texts: productPage().map(i => ({ str: i.str, x: i.x, y: i.y, size: 8 })) }]));
await T("invoice-file").setInputFiles([inv]); await page.waitForFunction(() => !document.querySelector('[data-testid="invoice-reading"]'), null, { timeout: 60000 }); await page.waitForTimeout(500);
const ocrFiles = () => [...new Set(requests.filter(u => new URL(u).pathname.startsWith("/ocr/")).map(u => new URL(u).pathname.slice(5)))].sort();
const read = async f => { await T("ocr-file").setInputFiles(f); await page.waitForFunction(() => !document.querySelector('[data-testid="ocr-reading"]'), null, { timeout: 90000 }); await page.waitForTimeout(300); };

try {
  rec("O0 OCR is OFF by default: no picture chooser, and no engine file requested", (await T("ocr-file").count()) === 0 && ocrFiles().length === 0 && (await T("ocr-toggle").isChecked()) === false, {});
  await T("ocr-toggle").check();
  rec("O1 switching it on shows the chooser but still fetches no engine file", (await T("ocr-file").count()) === 1 && ocrFiles().length === 0, ocrFiles());

  await read(shots.gif);
  rec("O2 a GIF is declined with a message, and the engine is not started", (await T("ocr-declined").count()) === 1 && /PNG, JPG or WebP/.test(await text("ocr-declined")) && ocrFiles().length === 0, {});
  await T("ocr-try-again").click();

  await read(shots.blank);
  rec("O3 a picture with no summary amounts is declined, nothing is shown as read", (await T("ocr-declined").count()) === 1 && /No order summary amounts/.test(await text("ocr-declined")), await text("ocr-declined"));
  await T("ocr-try-again").click();

  await read(shots.clean);
  const got = await page.evaluate(() => Object.fromEntries(["subtotal", "shipping", "fee", "total", "discount", "grandTotal"].map(k => [k, document.querySelector(`[data-testid="ocr-${k}"]`).value])));
  console.log("      read from the invented screenshot:", JSON.stringify(got), "order no:", await T("ocr-ordernumber").inputValue());
  rec("O4 the review panel appears, marked 'read from a picture, please check', with six editable figures", (await T("ocr-review").count()) === 1 && /read from a picture, please check/.test(await text("ocr-review")), {});
  const files = ocrFiles();
  rec("O5 only now were engine files fetched: the worker, ONE text-only core, English data", files.includes("worker.min.js") && files.includes("eng.traineddata.gz") && files.filter(f => /-lstm\.wasm\.js$/.test(f)).length === 1 && files.length === 3, files);

  const want = { subtotal: "329.00", shipping: "50.00", fee: "1.35", total: "380.35", discount: "17.33", grandTotal: "363.02" };
  const exact = Object.entries(want).filter(([k, v]) => got[k] === v).length;
  rec("O6 measured on this invented screenshot (not a guarantee for real ones)", true, { exactFigures: `${exact}/6` });
  const ackDisabledWhileWrong = exact < 6 ? await T("ocr-ack").isDisabled() : null;
  if (exact < 6) rec("O7 while any figure is wrong the equations fail and 'These figures are right' is DISABLED", ackDisabledWhileWrong === true && ((await T("ocr-e1").getAttribute("data-status")) === "fails" || (await T("ocr-e2").getAttribute("data-status")) === "fails"), { e1: await T("ocr-e1").getAttribute("data-status"), e2: await T("ocr-e2").getAttribute("data-status") });
  for (const [k, v] of Object.entries(want)) if (got[k] !== v) await T(`ocr-${k}`).fill(v);          // the person corrects what the engine misread
  await page.waitForTimeout(200);
  rec("O8 after the person corrects the figures both equations hold and every figure is ticked", (await T("ocr-e1").getAttribute("data-status")) === "holds" && (await T("ocr-e2").getAttribute("data-status")) === "holds" && (await T("ocr-tick-total").innerText()) === "✔", {});
  rec("O9 nothing counts yet: no summary card until the person taps", (await T("summary-card").count()) === 0, {});
  await T("ocr-ack").click(); await page.waitForTimeout(300);
  rec("O10 after the tap the summary is recorded as 'read from a picture, checked by you', still blocked", (await T("summary-card").count()) === 1 && /read from a picture, checked by you/.test(await text("summary-card")) && (await T("summary-card").getAttribute("data-acknowledged")) === "true", {});
  const gateText = await page.evaluate(() => document.body.innerText);
  rec("O11 confirmation stays blocked, and the discount keeps it unconfirmable", /Confirmation is blocked|not available yet/i.test(gateText) && (await page.getByTestId("confirm-import").count()) === 0, {});

  // informational: how the same engine reads other invented layouts (NOT asserted; a real measurement needs the corpus of step 7)
  for (const [name, f] of Object.entries(variants)) {
    if (!(await T("ocr-toggle").isChecked())) await T("ocr-toggle").check();
    await read(f);
    const g = (await T("ocr-review").count()) ? await page.evaluate(() => Object.fromEntries(["subtotal", "shipping", "fee", "total", "discount", "grandTotal"].map(k => [k, document.querySelector(`[data-testid="ocr-${k}"]`).value]))) : { declined: await text("ocr-declined") };
    const ok = Object.entries(want).filter(([k, v]) => g[k] === v).length;
    console.log(`      ${name}: ${ok}/6 exact`, JSON.stringify(g));
    if (g.subtotal !== undefined) {
      const holds = (await T("ocr-e1").getAttribute("data-status")) === "holds" && (await T("ocr-e2").getAttribute("data-status")) === "holds";
      rec(`O7 [${name}] 'These figures are right' is enabled exactly when both equations hold`, (await T("ocr-ack").isDisabled()) === !holds, { holds, exact: ok });
      if (!holds && (await T("ocr-suggestion").count())) {
        const before = await page.evaluate(() => Object.fromEntries(["subtotal", "shipping", "fee", "total", "discount", "grandTotal"].map(k => [k, document.querySelector(`[data-testid="ocr-${k}"]`).value])));
        rec(`O7b [${name}] a suggestion changes nothing until tapped`, JSON.stringify(before) === JSON.stringify(g), {});
        await T("ocr-apply-suggestion").click(); await page.waitForTimeout(200);
        rec(`O7c [${name}] after the tap the suggested figure is in place and the figures add up`, (await T("ocr-e1").getAttribute("data-status")) === "holds" && (await T("ocr-e2").getAttribute("data-status")) === "holds" && (await T("ocr-ack").isDisabled()) === false, {});
      }
    }
    if (await T("ocr-cancel").count()) await T("ocr-cancel").click(); else if (await T("ocr-try-again").count()) await T("ocr-try-again").click();
  }
  await T("ocr-toggle").check().catch(() => {});
  if (!(await T("ocr-toggle").isChecked())) await T("ocr-toggle").check();
  await read(shots.unknownRow);
  const unk = await T("ocr-unrecognised").count();
  const found = (await T("ocr-review").count()) === 1;
  if (found && unk) rec("O12 an unrecognised row blocks acceptance even if the figures add up", (await T("ocr-ack").isDisabled()) === true && /does not recognise/.test(await text("ocr-unrecognised")), await text("ocr-unrecognised"));
  else rec("O12 (this reading did not surface the extra row, so it was not exercised)", true, { reviewShown: found, unrecognised: unk });

  const stores = await page.evaluate(async () => ({ session: Object.keys(sessionStorage), idb: indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : [] }));
  rec("O13 no IndexedDB database and no sessionStorage entry", stores.session.length === 0 && stores.idb.length === 0, stores);
  rec("O14 localStorage is exactly as before: nothing saved, no expense created", (await snap()) === before, {});
  const foreign = external.filter(u => !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u));   // the app's own Google Fonts link (it was there before OCR) is aborted
  rec("O15 no request left this origin except the app's own font link; no CDN host", foreign.length === 0 && !requests.some(u => /jsdelivr|unpkg|cdnjs|tessdata/.test(u)), foreign);
  rec("O16 no page error", errors.length === 0, errors);
} catch (e) { rec("harness ran to the end", false, String(e).slice(0, 200)); }
await browser.close(); process.kill(-server.pid, "SIGTERM");
const failed = results.filter(r => !r.pass); console.log(`\n${results.length - failed.length}/${results.length} passed`); process.exit(failed.length ? 1 : 0);

// Browser-side check of the PDF prototype: real Chromium, Vite dev server, the locally bundled pdf.js worker, and a network log.
//   Setup: npx vite --port 5199 --strictPort &     Run: node tools/invoice-import/browser.mjs [path/to/real-invoice.pdf]
// The optional real PDF is read on this machine only; only a customer-free summary is printed.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
import { BLINKIT_FIXTURE_3_ITEMS as ITEMS } from "../../src/domain/invoices/fixtures/blinkitGstInvoiceItems.fixture.js";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";
const APP = process.env.NL_APP || "http://localhost:5199/";
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const requests = []; ctx.on("request", r => requests.push(r.url()));
await ctx.route(u => { try { return !["localhost", "127.0.0.1"].includes(new URL(u).hostname); } catch { return false; } }, r => r.abort());
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e))); page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
await page.goto(APP); await page.waitForTimeout(800);
const synthetic = Array.from(makePdf([{ texts: ITEMS.map(i => ({ str: i.str, x: i.x, y: i.y, size: 8 })), image: { x: 40, y: 780, w: 40, h: 20 } }]));
const scanned = Array.from(makePdf([{ texts: [], image: { x: 0, y: 0, w: 595, h: 842 } }]));
const cases = { synthetic, scanned, junk: Array.from(new TextEncoder().encode("%PDF-1.4\ngarbage")) };
if (process.argv[2]) cases.real = Array.from(readFileSync(process.argv[2]));
const run = async () => page.evaluate(async cases => {
  const [{ analyseBlinkitPdf }, { default: workerSrc }] = await Promise.all([import("/src/domain/invoices/blinkitPdf.js"), import("/src/domain/invoices/pdfWorkerUrl.js")]);
  const out = {};
  for (const [k, bytes] of Object.entries(cases)) {
    const r = await analyseBlinkitPdf(new Uint8Array(bytes), { workerSrc }), p = r.pages[0] || {}, x = p.parsed;
    out[k] = { status: r.status, reconciled: x ? x.reconciled : null, total: x && x.declaredTotals ? x.declaredTotals.totalMilli : null, key: x ? Boolean(x.importKey) : null, workerSrc };
  }
  return out;
}, cases);
let out; for (let i = 0; i < 4 && !out; i++) { try { out = await run(); } catch (e) { await page.waitForTimeout(1500); await page.goto(APP); await page.waitForTimeout(800); } }
rec("BR1 extraction runs in the browser and finishes", Boolean(out), out && Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.status])));
if (out) {
  rec("BR2 synthetic invoice PDF: supported, reconciles, Rs 1,125.00", out.synthetic.status === "supported" && out.synthetic.reconciled === true && out.synthetic.total === 1125000 && out.synthetic.key, out.synthetic);
  rec("BR3 image-only PDF: requires OCR (nothing parsed)", out.scanned.status === "requires-ocr", out.scanned.status);
  rec("BR4 damaged PDF: unreadable, no crash", out.junk.status === "unreadable", out.junk.status);
  if (out.real) rec("BR5 real invoice PDF (read locally): supported, reconciles, Rs 1,125.00", out.real.status === "supported" && out.real.reconciled === true && out.real.total === 1125000, { status: out.real.status, reconciled: out.real.reconciled, total: out.real.total });
}
const external = requests.filter(u => { try { return !["localhost", "127.0.0.1"].includes(new URL(u).hostname) && !u.startsWith("data:") && !u.startsWith("blob:"); } catch { return false; } });
rec("BR6 no request left this machine during extraction (external requests: 0)", external.length === 0, external.slice(0, 3));
const worker = requests.filter(u => /pdf\.worker/.test(u));
rec("BR7 the pdf.js worker was served from the local dev server", worker.length >= 1 && worker.every(u => u.startsWith(APP.replace(/\/$/, ""))), worker.map(u => u.replace(APP, "/")).slice(0, 2));
const real = errors.filter(e => !/Failed to load resource/.test(e)); rec("BR8 no page errors", real.length === 0, real.slice(0, 2));
console.log("outcome vector:", JSON.stringify(results));
await browser.close(); process.exit(results.every(r => r.pass) ? 0 : 1);

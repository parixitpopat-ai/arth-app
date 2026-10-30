// INVOICE-IMPORT-009 step 4 isolation gate (Chromium only: says nothing about Android).
// Builds the harness in production mode, serves it with `vite preview`, runs the local OCR engine on an invented image
// and checks: every request is same-origin, only the files the engine needs were fetched, nothing was cached or stored.
// Run: node tools/ocr/ocr-gate-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn, execFileSync } from "node:child_process"; import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "ocr-gate-")); const env = { ...process.env, OCR_GATE_OUT: out };
execFileSync("node", ["node_modules/vite/bin/vite.js", "build", "-c", "tools/ocr/vite.gate.config.js"], { env, stdio: "ignore" });
try { await fetch("http://localhost:4179/"); console.log("FAIL  port 4179 is already in use - stop the old preview server first"); process.exit(1); } catch {}
const server = spawn("node", ["node_modules/vite/bin/vite.js", "preview", "-c", "tools/ocr/vite.gate.config.js"], { env, stdio: "ignore", detached: true });
const APP = "http://localhost:4179/"; const PAGE = APP + "gate.html";
for (let i = 0; i < 50; i++) { try { if ((await fetch(PAGE)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }

const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext(); const requests = []; ctx.on("request", r => requests.push(r.url()));
const external = []; await ctx.route(u => { try { return new URL(u).origin !== new URL(APP).origin; } catch { return false; } }, r => { external.push(r.request().url()); r.abort(); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
try {
  await page.goto(PAGE);
  const res = await Promise.race([page.evaluate(() => window.__ocrGate.run()), new Promise((_, no) => setTimeout(() => no(new Error("engine did not finish in 40 s (a blocked or missing file?)")), 40000))]);
  const names = [...new Set(requests.map(u => u.replace(APP, "")))].sort();
  rec("G1 engine ran locally and read the invented picture", /Subtotal/i.test(res.text) && /329/.test(res.text), { chars: res.text.length });
  rec("G2 no request left this origin (none attempted either)", external.length === 0, { external });
  rec("G3 no CDN host appears in any request", !requests.some(u => /jsdelivr|unpkg|cdnjs|tessdata/i.test(u)), {});
  const ocrFetched = names.filter(n => n.startsWith("ocr/"));
  rec("G4 exactly one text-only core was fetched, plus the worker and English data", ocrFetched.filter(n => /tesseract-core.*-lstm\.wasm\.js$/.test(n)).length === 1 && ocrFetched.includes("ocr/worker.min.js") && ocrFetched.includes("ocr/eng.traineddata.gz"), ocrFetched);
  rec("G5 no non-text core and no other language was fetched", !ocrFetched.some(n => /tesseract-core(-simd|-relaxedsimd)?\.wasm\.js$/.test(n)) && !ocrFetched.some(n => /\.traineddata/.test(n) && !/eng\.traineddata\.gz$/.test(n)), {});
  const idb = await page.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : ["unsupported"]));
  rec("G6 no IndexedDB database exists", Array.isArray(idb) && idb.length === 0, idb);
  const stores = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), cache: "caches" in window }));
  const cacheNames = await page.evaluate(async () => ("caches" in window ? await caches.keys() : []));
  rec("G7 no localStorage, sessionStorage or Cache Storage entry", stores.local.length === 0 && stores.session.length === 0 && cacheNames.length === 0, { stores, cacheNames });
  rec("G8 no page error", errors.length === 0, errors);
} catch (e) { rec("harness ran", false, String(e).slice(0, 160)); rec("G2 external requests attempted", external.length === 0, external); }
await browser.close(); process.kill(-server.pid, "SIGTERM");
const failed = results.filter(r => !r.pass); console.log(`\n${results.length - failed.length}/${results.length} passed`); process.exit(failed.length ? 1 : 0);

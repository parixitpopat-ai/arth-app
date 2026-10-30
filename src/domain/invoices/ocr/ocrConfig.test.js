import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ocrWorkerOptions, OCR_LANGUAGE, OCR_ENGINE_MODE_LSTM_ONLY } from "./ocrConfig.js";
import { OCR_FILES } from "../../../../tools/ocr/viteOcrAssets.js";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const read = rel => readFileSync(join(ROOT, rel), "utf8");

test("every engine path is a file of this app under ocr/, never a CDN; no engine cache; English; text-only core", () => {
  for (const base of ["https://arth-app.vercel.app/", "http://localhost:4179/", "https://example.test/sub/app/"]) {
    const o = ocrWorkerOptions(base);
    const root = new URL("ocr/", base).href;
    assert.equal(o.workerPath, `${root}worker.min.js`);
    assert.equal(o.corePath, root.replace(/\/$/, ""));
    assert.equal(o.langPath, root.replace(/\/$/, ""));
    assert.equal(o.cacheMethod, "none");
    assert.equal(o.legacyCore, false);
    assert.equal(o.gzip, true);
    for (const p of [o.workerPath, o.corePath, o.langPath]) assert.equal(new URL(p).origin, new URL(base).origin);
  }
  assert.equal(OCR_LANGUAGE, "eng");
  assert.equal(OCR_ENGINE_MODE_LSTM_ONLY, 1);
});

test("a base that is not the app's own page is refused", () => {
  assert.throws(() => ocrWorkerOptions("data:text/html,x"));
  assert.throws(() => ocrWorkerOptions("blob:https://x/y"));
});

test("only the worker, the three text-only cores and the English data are shipped - no other core, no other language", () => {
  const names = OCR_FILES.map(([out]) => out).sort();
  assert.deepEqual(names, ["ocr/eng.traineddata.gz", "ocr/tesseract-core-lstm.wasm.js", "ocr/tesseract-core-relaxedsimd-lstm.wasm.js", "ocr/tesseract-core-simd-lstm.wasm.js", "ocr/worker.min.js"]);
  assert.equal(OCR_FILES.every(([, from]) => !/\.traineddata/.test(from) || /eng\.traineddata\.gz$/.test(from)), true);
});

test("the dependency is pinned exactly and the data package is dev-only", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies["tesseract.js"], "7.0.0");
  assert.equal(pkg.devDependencies["@tesseract.js-data/eng"], "1.0.0");
  assert.equal(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter(k => /tesseract/.test(k)).length, 2);
});

test("nothing in the app imports the engine yet, and the engine is only ever imported on demand", () => {
  const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const offenders = walk(join(ROOT, "src")).filter(f => /\.(js|jsx)$/.test(f) && !f.includes("/ocr/") && /ocrEngine|tesseract\.js/.test(readFileSync(f, "utf8")));
  assert.deepEqual(offenders.map(f => f.replace(ROOT, "")).filter(f => !/testInventory/.test(f)), []);
  const engine = read("src/domain/invoices/ocr/ocrEngine.js");
  assert.equal(/^import .*tesseract/m.test(engine), false);
  assert.match(engine, /await import\("tesseract\.js"\)/);
});

test("no CDN address appears in the app's OCR code, and a normal build does not copy the engine's files", () => {
  for (const f of ["src/domain/invoices/ocr/ocrConfig.js", "src/domain/invoices/ocr/ocrEngine.js", "tools/ocr/viteOcrAssets.js"]) assert.equal(/jsdelivr|unpkg|cdnjs/i.test(read(f)), false, f);
  assert.match(read("vite.config.js"), /process\.env\.ARTH_OCR_ASSETS === '1' \? \[ocrAssets\(\)\] : \[\]/);
});

// Emits the OCR engine's files into the build under ocr/ so nothing is fetched from a CDN (INVOICE-IMPORT-009 §9.1):
// the worker script, the three text-only ("lstm") core variants (the engine picks one by feature detection on
// the device) and the English data. The other core variants and every other language are never copied.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const nm = rel => fileURLToPath(new URL(`../../node_modules/${rel}`, import.meta.url));

export const OCR_FILES = [
  ["ocr/worker.min.js", "tesseract.js/dist/worker.min.js"],
  ["ocr/tesseract-core-lstm.wasm.js", "tesseract.js-core/tesseract-core-lstm.wasm.js"],
  ["ocr/tesseract-core-simd-lstm.wasm.js", "tesseract.js-core/tesseract-core-simd-lstm.wasm.js"],
  ["ocr/tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["ocr/eng.traineddata.gz", "@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz"],
];

const serve = server => server.middlewares.use((req, res, next) => {
  const hit = OCR_FILES.find(([out]) => req.url && req.url.split("?")[0] === `/${out}`);
  if (!hit) return next();
  res.setHeader("Content-Type", hit[0].endsWith(".gz") ? "application/gzip" : "text/javascript");
  res.end(readFileSync(nm(hit[1])));
});

export default function ocrAssets() {
  return {
    name: "arth-ocr-assets",
    // The same files, served under /ocr/ by the dev and preview servers.
    configureServer(server) { serve(server); },
    configurePreviewServer(server) { serve(server); },
    generateBundle() {
      for (const [fileName, from] of OCR_FILES) this.emitFile({ type: "asset", fileName, source: readFileSync(nm(from)) });
    },
  };
}

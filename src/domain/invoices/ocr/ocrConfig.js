// src/domain/invoices/ocr/ocrConfig.js - the ONLY place the OCR engine's options are decided (INVOICE-IMPORT-009 §9.1).
// Every path is a file of this app under ocr/ (see tools/ocr/viteOcrAssets.js); nothing is fetched from a CDN, nothing
// is cached by the engine (cacheMethod "none": no IndexedDB), only English, only the text-only core. Pure: no I/O.

export const OCR_LANGUAGE = "eng";
export const OCR_ENGINE_MODE_LSTM_ONLY = 1; // tesseract.js OEM.LSTM_ONLY

/** @param {string} baseUrl absolute URL of the app root, e.g. new URL("./", document.baseURI).href */
export function ocrWorkerOptions(baseUrl) {
  const root = new URL("ocr/", baseUrl);
  if (!/^https?:$/.test(root.protocol) && root.protocol !== "capacitor:" && root.protocol !== "file:") throw new Error("OCR assets must be served by the app itself");
  const at = name => new URL(name, root).href;
  return {
    workerPath: at("worker.min.js"),
    corePath: root.href.replace(/\/$/, ""),   // a folder: the engine picks tesseract-core[-simd|-relaxedsimd]-lstm.wasm.js
    langPath: root.href.replace(/\/$/, ""),   // holds eng.traineddata.gz
    cacheMethod: "none",                      // never read or write the engine's IndexedDB cache
    gzip: true,
    legacyCore: false,                        // text-only core
  };
}

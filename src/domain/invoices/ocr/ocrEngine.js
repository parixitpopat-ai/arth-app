// src/domain/invoices/ocr/ocrEngine.js - loads the OCR engine on demand and releases it. Gate harness only
// (INVOICE-IMPORT-009 step 4): nothing in the app imports this yet, there is no parsing here and no flag.
import { OCR_LANGUAGE, OCR_ENGINE_MODE_LSTM_ONLY, ocrWorkerOptions } from "./ocrConfig.js";

/** Starts one local English worker. The engine itself is imported only now, so it is never part of the main bundle. */
export async function createLocalOcrWorker(baseUrl) {
  const { createWorker } = await import("tesseract.js");
  return createWorker(OCR_LANGUAGE, OCR_ENGINE_MODE_LSTM_ONLY, ocrWorkerOptions(baseUrl));
}

/** Terminates the worker so its memory is released. Safe to call twice. */
export async function releaseOcrWorker(worker) {
  if (worker) await worker.terminate();
}

// src/domain/invoices/ocr/ocrBill.js - reads a PHOTO of a printed utility bill on this device, with the same local engine as the receipt and order-summary readers
// (bundled files only, no cache, English, released after every reading). Only the parsed fields leave this module (domain/bills/billPhotoParse.js; this file lives in ocr/ because only that folder may import the engine);
// the recognised text and the picture are local variables and are dropped when it returns. The name and address printed on the bill are never returned.
import { parseBillText } from "../../bills/billPhotoParse.js";
import { checkImage, imageSize } from "./ocrSummary.js";
import { createLocalOcrWorker, releaseOcrWorker } from "./ocrEngine.js";

/** @returns {Promise<({ok:true}&ReturnType<typeof parseBillText>)|{ok:false, reason:string}>} */
export async function readBillFromImage(file, { baseUrl, makeWorker = createLocalOcrWorker, sizeOf = imageSize } = {}) {
  let worker = null;
  try {
    const size = await sizeOf(file).catch(() => null);
    const verdict = checkImage(file, size);
    if (!verdict.ok) return verdict;
    worker = await makeWorker(baseUrl);
    const r = await worker.recognize(file, {}, { text: true });
    return { ok: true, ...parseBillText(String(r.data.text || "")) };
  } catch {
    return { ok: false, reason: "engine" };
  } finally {
    await releaseOcrWorker(worker).catch(() => {});
  }
}

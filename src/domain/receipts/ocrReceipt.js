// src/domain/receipts/ocrReceipt.js - reads a PHOTO of a printed shop receipt on this device, with the same local engine as the order-summary reader
// (bundled files only, no cache, English, released after every reading). Only the parsed fields leave this module: shop name, date, item rows, the
// printed items total and the amount paid. The recognised text and the picture are local variables and are dropped when it returns.
import { parseReceiptLines } from "./receiptParse.js";
import { checkImage, imageSize } from "../invoices/ocr/ocrSummary.js";
import { createLocalOcrWorker, releaseOcrWorker } from "../invoices/ocr/ocrEngine.js";

const PSM_SINGLE_BLOCK = "6";   // a receipt is one column of text

/** @returns {Promise<{ok:true, found:boolean, merchant:string, date:string|null, items:Array, printed:object|null, paidPaise:number|null, conflictingPayments:boolean}|{ok:false, reason:string}>} */
export async function readReceiptFromImage(file, { baseUrl, makeWorker = createLocalOcrWorker, sizeOf = imageSize } = {}) {
  let worker = null;
  try {
    const size = await sizeOf(file).catch(() => null);
    const verdict = checkImage(file, size);
    if (!verdict.ok) return verdict;
    worker = await makeWorker(baseUrl);
    await worker.setParameters({ tessedit_pageseg_mode: PSM_SINGLE_BLOCK, preserve_interword_spaces: "1" });
    const r = await worker.recognize(file, {}, { text: true });
    const parsed = parseReceiptLines(String(r.data.text || "").split("\n"));
    return { ok: true, found: parsed.items.length > 0 || parsed.paidPaise != null, ...parsed };
  } catch {
    return { ok: false, reason: "engine" };
  } finally {
    await releaseOcrWorker(worker).catch(() => {});
  }
}

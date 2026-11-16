// src/domain/invoices/ocr/ocrBill.js - reads a PHOTO of a printed utility bill on this device, with the same local engine as the receipt and order-summary readers
// (bundled files only, no cache, English, released after every reading). Only the parsed fields leave this module (domain/bills/billPhotoParse.js; this file lives in ocr/ because only that folder may import the engine);
// the recognised text and the picture are local variables and are dropped when it returns. The name and address printed on the bill are never returned.
import { parseBillText } from "../../bills/billPhotoParse.js";
import { checkImage, imageSize } from "./ocrSummary.js";
import { createLocalOcrWorker, releaseOcrWorker } from "./ocrEngine.js";

// A phone camera photo is often 12 to 50 megapixels. The shared limits (10 MB / 16 MP, never shrunk) are meant for screenshots and would refuse a normal
// photo of a bill, so for BILL photos a big picture is shrunk to a size that still reads well (a bill text line is tall) before it is read.
export const BILL_MAX_SIDE = 2600;
const SHRINK_ABOVE_PIXELS = 6_000_000, SHRINK_ABOVE_BYTES = 4 * 1024 * 1024;

/** Shrinks a big picture with the browser's own canvas; returns the new File, or the original when it is small enough or cannot be shrunk. */
export async function shrinkForBill(file, size, { maxSide = BILL_MAX_SIDE } = {}) {
  if (!size || (size.width * size.height <= SHRINK_ABOVE_PIXELS && file.size <= SHRINK_ABOVE_BYTES)) return file;
  const scale = Math.min(1, maxSide / Math.max(size.width, size.height));
  const w = Math.max(1, Math.round(size.width * scale)), h = Math.max(1, Math.round(size.height * scale));
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.92));
    return blob ? new File([blob], "bill.jpg", { type: "image/jpeg" }) : file;
  } finally { bitmap.close?.(); }
}

/** @returns {Promise<({ok:true}&ReturnType<typeof parseBillText>)|{ok:false, reason:string, detail?:string}>} detail = the technical reason, shown so a failure can be told apart */
export async function readBillFromImage(file, { baseUrl, makeWorker = createLocalOcrWorker, sizeOf = imageSize, shrink = shrinkForBill } = {}) {
  let worker = null;
  try {
    const size = await sizeOf(file).catch(() => null);
    if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) return checkImage(file, size);
    if (!size || !(size.width > 0) || !(size.height > 0)) return { ok: false, reason: "unreadable" };
    let input = file;
    try { input = await shrink(file, size); } catch (e) { return { ok: false, reason: "shrink", detail: String(e && e.message || e).slice(0, 120) }; }
    const verdict = checkImage(input, input === file ? size : await sizeOf(input).catch(() => null));
    if (!verdict.ok) return verdict;
    worker = await makeWorker(baseUrl);
    const r = await worker.recognize(input, {}, { text: true });
    return { ok: true, ...parseBillText(String(r.data.text || "")) };
  } catch (e) {
    return { ok: false, reason: "engine", detail: String(e && e.message || e).slice(0, 120) };
  } finally {
    await releaseOcrWorker(worker).catch(() => {});
  }
}

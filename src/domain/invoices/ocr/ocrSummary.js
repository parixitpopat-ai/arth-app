// src/domain/invoices/ocr/ocrSummary.js - reads an Amazon ORDER SUMMARY picture on this device (INVOICE-IMPORT-009 steps 5-6).
// Recipe (spec 4.6): pass A reads the whole picture to find the rows by their allow-listed LABELS; pass B re-reads only the amount to the right
// of each label as one line of digits, "." and ",". Only the six allow-listed figures, the order number and the order date leave this module.
// The recognised text, the words and the picture are local variables and are dropped when the function returns: nothing is stored, logged or
// synced, a name, address or card line is never looked at beyond "is this one of the allow-listed labels", and no figure is ever corrected here.
import { FIGURE_KEYS, LABEL_ONLY, parseOrderSummaryLines, toPaise } from "../orderSummary.js";
import { createLocalOcrWorker, releaseOcrWorker } from "./ocrEngine.js";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;       // provisional: real limits come from the phone measurement (spec 9.5)
export const MAX_IMAGE_PIXELS = 16_000_000;            // provisional, same reason
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const PSM_SINGLE_LINE = "7";
const AMOUNT_CHARS = "0123456789.,";

/** @returns {{ok:true}|{ok:false, reason:"type"|"too-big"|"too-many-pixels"|"unreadable"}} - declined, never down-scaled. */
export function checkImage(file, size) {
  if (!file || !IMAGE_TYPES.includes(file.type)) return { ok: false, reason: "type" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "too-big" };
  if (!size || !(size.width > 0) || !(size.height > 0)) return { ok: false, reason: "unreadable" };
  if (size.width * size.height > MAX_IMAGE_PIXELS) return { ok: false, reason: "too-many-pixels" };
  return { ok: true };
}
export const DECLINE_MESSAGE = {
  type: "Choose a PNG, JPG or WebP picture.",
  "too-big": "This picture is larger than 10 MB. Arth does not shrink it, because that makes the reading worse. Take a plain screenshot instead.",
  "too-many-pixels": "This picture is very large. Arth does not shrink it, because that makes the reading worse. Take a plain screenshot instead.",
  unreadable: "This picture could not be opened.",
};

/** Which allow-listed figure does this recognised line label, and where does its label end? Only labels are matched; any other line returns null. */
export function labelOfLine(line) {
  const words = (line.words || []).filter(w => w && w.bbox);
  if (!words.length) return null;
  for (const key of FIGURE_KEYS) {
    const re = LABEL_ONLY[key];
    let acc = "";
    for (const w of words) {
      acc = `${acc} ${w.text}`.trim();
      if (re.test(acc)) { const m = re.exec(acc); if (m && !/\d/.test(m[0])) return { key, labelRight: w.bbox.x1, y0: line.bbox.y0, y1: line.bbox.y1 }; }
    }
  }
  return null;
}

/** Rows to re-read: the first line found for each label. A later line with the same label is ignored (never overrides). */
export function planAmountReads(lines, size) {
  const rows = new Map();
  for (const line of lines) { const l = labelOfLine(line); if (l && !rows.has(l.key)) rows.set(l.key, l); }
  return [...rows.values()].map(r => {
    const pad = Math.max(2, Math.round((r.y1 - r.y0) * 0.25));
    const left = Math.min(size.width - 1, r.labelRight + 2);
    const top = Math.max(0, r.y0 - pad);
    return { key: r.key, rectangle: { left, top, width: Math.max(1, size.width - left), height: Math.min(size.height - top, r.y1 - r.y0 + 2 * pad) } };
  });
}

/**
 * Join pass A (the labelled-line parse) and pass B (the amounts re-read beside each label). A pass-B amount that is a plain amount wins; otherwise the
 * pass-A value is kept. Nothing is corrected: whatever was read is what is returned, and the equations judge it later.
 */
export function assembleFigures(passA, passB) {
  const figures = { ...passA.figures };
  for (const [key, text] of Object.entries(passB)) { const p = toPaise(String(text || "").replace(/[^0-9.,]/g, "")); if (p != null) figures[key] = p; }
  return { ...passA, figures };
}

/** @param {Array} lines recognised lines of pass A ({text, bbox, words}) @returns the pass-A parse of the allow-listed lines only */
export function parsePassA(lines) {
  return parseOrderSummaryLines(lines.map(l => rupeeAsWord(String(l.text || ""))));
}
// "Rs." and "INR" are ways of writing the rupee sign; nothing else is touched here.
const rupeeAsWord = t => t.replace(/\b(?:rs|inr)\.?\s*(?=\d)/gi, "₹");

const linesOf = data => (data && data.blocks ? data.blocks.flatMap(b => b.paragraphs.flatMap(p => p.lines)) : []);

/**
 * @param {Blob} file the picture. @param {{baseUrl:string, makeWorker?:Function, sizeOf?:Function}} deps
 * @returns {Promise<{ok:true, found:boolean, figures:object, unrecognised:Array, conflictingFigures:string[], orderNumber:string|null, orderDate:string|null}|{ok:false, reason:string}>}
 */
export async function readSummaryFromImage(file, { baseUrl, makeWorker = createLocalOcrWorker, sizeOf = imageSize } = {}) {
  let worker = null;
  try {
    const size = await sizeOf(file).catch(() => null);
    const verdict = checkImage(file, size);
    if (!verdict.ok) return verdict;
    worker = await makeWorker(baseUrl);
    const a = await worker.recognize(file, {}, { blocks: true });
    const lines = linesOf(a.data);
    const passA = parsePassA(lines);
    const rows = planAmountReads(lines, size);
    const passB = {};
    if (rows.length) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM_SINGLE_LINE, tessedit_char_whitelist: AMOUNT_CHARS });
      for (const r of rows) { const b = await worker.recognize(file, { rectangle: r.rectangle }, { text: true }); passB[r.key] = b.data.text; }
    }
    const out = assembleFigures(passA, passB);
    const found = FIGURE_KEYS.some(k => out.figures[k] != null);
    return { ok: true, found, figures: out.figures, unrecognised: out.unrecognised, orderNumber: out.orderNumber, orderDate: out.orderDate, conflictingFigures: out.conflictingFigures };
  } catch {
    return { ok: false, reason: "engine" };
  } finally {
    await releaseOcrWorker(worker).catch(() => {});
  }
}

export async function imageSize(file) {
  const bmp = await createImageBitmap(file);
  const size = { width: bmp.width, height: bmp.height };
  bmp.close();
  return size;
}

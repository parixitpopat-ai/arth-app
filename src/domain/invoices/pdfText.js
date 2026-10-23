// src/domain/invoices/pdfText.js — read the TEXT LAYER of a PDF on the device with pdf.js. Nothing is uploaded; no OCR; no scripts are run.
//
// Returns positioned text items per page and counts of image-painting operators (used only to explain a PDF that has pictures and no text).
// Dynamic import keeps pdf.js out of the main bundle. In a browser the caller must provide `workerSrc` (see pdfWorkerUrl.js); in Node pdf.js uses its fake worker.
// Uses pdfjs-dist's "legacy" build (the one meant for older browsers/WebViews).

export const PDF_LIMITS = Object.freeze({ maxBytes: 10 * 1024 * 1024, maxPages: 10, minTextChars: 40 });

const fail = (status, reason) => ({ status, reason, pages: [] });

/** @param {Uint8Array|ArrayBuffer} input @param {{pdfjs?:object, workerSrc?:string}} [opts] */
export async function readPdfLayout(input, opts = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || 0);
  if (!bytes.length) return fail("unreadable", "The file is empty.");
  if (bytes.length > PDF_LIMITS.maxBytes) return fail("too-large", `This PDF is larger than ${PDF_LIMITS.maxBytes / 1024 / 1024} MB.`);
  // pdf.js tolerates leading junk; we do not: a real PDF starts with the %PDF- marker within the first 1 KB.
  if (!new TextDecoder("latin1").decode(bytes.subarray(0, 1024)).includes("%PDF-")) return fail("unreadable", "This file is not a PDF.");
  const pdfjs = opts.pdfjs || await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (opts.workerSrc && pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = opts.workerSrc;
  let doc;
  try {
    // data: is copied because pdf.js transfers (detaches) the buffer it is given.
    doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, enableScripting: false, verbosity: 0 }).promise;
  } catch (e) {
    const name = e && e.name;
    if (name === "PasswordException") return fail("password", "This PDF is password-protected. Remove the password and try again.");
    if (name === "InvalidPDFException" || name === "FormatError" || name === "MissingPDFException") return fail("unreadable", "This PDF is damaged or not a valid PDF.");
    return fail("unreadable", "This PDF could not be read.");
  }
  try {
    if (doc.numPages > PDF_LIMITS.maxPages) return fail("too-many-pages", `This PDF has ${doc.numPages} pages; up to ${PDF_LIMITS.maxPages} are read at a time.`);
    const imageOpIds = ["paintImageXObject", "paintInlineImageXObject", "paintImageMaskXObject", "paintJpegXObject"].map(k => pdfjs.OPS && pdfjs.OPS[k]).filter(v => v !== undefined);
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n), tc = await page.getTextContent(), ops = await page.getOperatorList();
      const items = tc.items.filter(i => typeof i.str === "string" && i.str.trim()).map(i => ({ str: i.str.trim(), x: i.transform[4], y: i.transform[5], w: i.width, h: i.height }));
      pages.push({ number: n, items, textChars: items.reduce((s, i) => s + i.str.replace(/\s+/g, "").length, 0), imageOps: ops.fnArray.filter(f => imageOpIds.includes(f)).length });
    }
    return { status: "ok", pages };
  } catch {
    return fail("unreadable", "This PDF could not be read.");
  } finally {
    try { await doc.destroy(); } catch { /* nothing to clean up */ }
  }
}

export async function sha256Hex(bytes) {
  const d = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}

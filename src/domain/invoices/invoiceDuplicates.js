// src/domain/invoices/invoiceDuplicates.js — explainable duplicate detection for INVOICES (not for transactions). Pure; nothing is deleted or merged.
// Identity = seller GSTIN + invoice number (importKey). The order ID is not part of it. A same-key invoice with a different total is a CONFLICT, never a silent duplicate.

/** @param {Array<{importKey:string|null, fileHash?:string, totalMilli?:number|null, label?:string}>} candidates @param {{existingKeys?:Iterable<string>, existingFileHashes?:Iterable<string>}} [known] */
export function assessInvoiceDuplicates(candidates, known = {}) {
  const keys = new Set(known.existingKeys || []), hashes = new Set(known.existingFileHashes || []), seen = new Map(), seenHash = new Set();
  return candidates.map(c => {
    let status = "new", why = "No invoice with this seller registration and invoice number has been imported.";
    if (!c.importKey) { status = "no-key"; why = "The seller registration or invoice number is missing, so this invoice cannot be checked for duplicates. Review it manually."; }
    else if (keys.has(c.importKey)) { status = "already-imported"; why = `Invoice ${c.importKey.split("|").slice(1).join(" / ")} was imported before.`; }
    else if (seen.has(c.importKey)) {
      const first = seen.get(c.importKey);
      if (first.totalMilli != null && c.totalMilli != null && first.totalMilli !== c.totalMilli) { status = "conflict"; why = "Same seller and invoice number as an earlier file in this batch, but a different total. Neither is assumed correct."; }
      else { status = "duplicate-in-batch"; why = "Same seller, invoice number and total as an earlier file in this batch."; }
    } else if (c.fileHash && (hashes.has(c.fileHash) || seenHash.has(c.fileHash))) { status = "same-file"; why = "This exact file (same content hash) was seen before."; }
    if (c.importKey && !seen.has(c.importKey)) seen.set(c.importKey, c);
    if (c.fileHash) seenHash.add(c.fileHash);
    return { ...c, status, why };
  });
}

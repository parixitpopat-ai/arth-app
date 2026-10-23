// Fixture 1 = hand transcription of one real Blinkit GST invoice image (no personal data). Every expected number below was computed by hand
// from the printed values (see the reconciliation notes in the discovery report), not copied from parser output.
import test from "node:test";
import assert from "node:assert/strict";
import { parseBlinkitGstInvoice, wordsToMilli } from "./blinkitGst.js";
import { BLINKIT_FIXTURE_1 as F } from "./fixtures/blinkitGstInvoice.fixture.js";
import { BLINKIT_FIXTURE_2 as P } from "./fixtures/blinkitGstInvoicePdf.fixture.js";

const clone = o => JSON.parse(JSON.stringify(o));
const parse = (f = F) => parseBlinkitGstInvoice(clone(f));
const byCode = (r, code) => r.findings.filter(f => f.code === code);

test("merchant and identifiers are separate fields; absent ones stay null and are flagged, never guessed", () => {
  const r = parse();
  assert.deepEqual(r.merchant, { legalName: "Blink Commerce Private Limited", formerName: "Grofers India Private Limited", pan: "AAFCG9846E", cin: "U74140HR2015FTC055568" });
  assert.equal(r.registeredOfficeGstin, "06AAFCG9846E1ZF");
  assert.equal(r.seller, null);                                            // the image does not include the seller block
  assert.equal(r.importKey, null);                                         // no de-duplication key without seller GSTIN + invoice number
  assert.deepEqual(r.identifiers, { invoiceNumber: null, orderId: null });
  assert.equal(r.invoiceDate, null);
  assert.equal(r.placeOfSupply, "Goa");
  assert.deepEqual(["invoiceNumber-absent", "orderId-absent", "invoiceDate-absent"].map(c => byCode(r, c).length), [1, 1, 1]);
  assert.equal(byCode(r, "pan-gstin")[0].level, "ok");
});

test("three products with quantities, MRP, discount, taxable, CGST/SGST, total (printed values, thousandths of a rupee)", () => {
  const r = parse();
  assert.deepEqual(r.items.map(i => [i.srNo, i.qty, i.mrpMilli, i.discountMilli, i.taxableMilli, i.cgstMilli, i.sgstMilli, i.totalMilli]), [
    [1, 1, 60000, 0, 57140, 1430, 1430, 60000],
    [2, 1, 120000, 0, 114290, 2860, 2860, 120000],
    [3, 2, 606000, 280000, 887620, 22190, 22190, 932000],
  ]);
  assert.deepEqual(r.items.map(i => i.hsn), ["21069099", "21069099", "11010000"]);
  assert.deepEqual(r.items.map(i => i.upc), ["8904004403732", "8904004400083", "8906000210321"]);
  assert.equal(r.items[2].cgstRate, 2.5);
});

test("each 'Delivery and other charges' row is attached to the item row it follows, with its source row kept", () => {
  const r = parse();
  assert.deepEqual(r.chargeRows.map(c => [c.followsSrNo, c.taxableMilli, c.cgstMilli, c.sgstMilli, c.totalMilli]), [[1, 670, 20, 20, 700], [2, 1330, 30, 30, 1400], [3, 10380, 260, 260, 10900]]);
  assert.deepEqual(r.items.map(i => i.charges.length), [1, 1, 1]);
  assert.deepEqual(r.chargeRows[0].source.raw.slice(2, 3), ["Delivery and other charges"]);
});

test("the three charge rows are ONE shared charge: they equal the annexure Handling charge (decided by the numbers)", () => {
  const r = parse();
  assert.equal(r.annexure.length, 1);
  assert.deepEqual([r.annexure[0].nature, r.annexure[0].taxRate, r.annexure[0].taxableMilli, r.annexure[0].cgstMilli], ["Handling charge", 5, 12381, 310]);
  assert.equal(r.chargeAllocation.linked, true);
  assert.equal(r.chargeAllocation.chargeRowsTotalMilli, 13000);        // 0.70 + 1.40 + 10.90
  assert.equal(r.chargeAllocation.annexureInclusiveMilli, 13001);      // 12.381 + 0.310 + 0.310
  assert.match(r.chargeAllocation.reading, /ONE charge shared/);
});

test("declared totals are read, the wrapped '1125.0' + '0' cell is repaired visibly, and the total reconciles to Rs 1,125.00", () => {
  const r = parse();
  assert.deepEqual([r.declaredTotals.qty, r.declaredTotals.taxableMilli, r.declaredTotals.cgstMilli, r.declaredTotals.sgstMilli, r.declaredTotals.totalMilli], [4, 1071430, 26790, 26790, 1125000]);
  assert.equal(byCode(r, "wrapped-total-cell").length, 1);
  assert.equal(byCode(r, "sum-line-totals")[0].level, "ok");          // 60.00+0.70+120.00+1.40+932.00+10.90 = 1125.00
  for (const c of ["sum-taxable", "sum-cgst", "sum-sgst", "sum-qty", "amount-in-words"]) assert.equal(byCode(r, c)[0].level, "ok", c);
  assert.equal(r.reconciled, true);
});

test("printed rounding differences are reported, not corrected: rows 2, charge 1 and charge 2 are Rs 0.01 off; grand taxable+tax is 1125.01", () => {
  const r = parse();
  const diffs = byCode(r, "row-identity").filter(f => f.diffMilli !== 0).map(f => f.diffMilli).sort((a, b) => a - b);
  assert.deepEqual(diffs, [-10, 10, 10]);
  assert.ok(byCode(r, "row-identity").filter(f => f.diffMilli !== 0).every(f => f.level === "warn"));
  const g = byCode(r, "grand-identity")[0];
  assert.deepEqual([g.level, g.diffMilli], ["warn", 10]);
  assert.equal(r.items[1].totalMilli, 120000);                          // printed total kept as printed
  assert.equal(r.declaredTotals.totalMilli, 1125000);
});

test("the discount is line-level: MRP x qty - discount equals the printed total for every item (606 x 2 - 280 = 932)", () => {
  assert.deepEqual(byCode(parse(), "mrp-less-discount").map(f => f.level), ["ok", "ok", "ok"]);
});

test("no payment account, payment mode or transaction is produced", () => {
  const r = parse(), keys = Object.keys(r).join(",");
  assert.doesNotMatch(keys, /pay|account|transaction|accId/i);
});

test("a tampered line total is an ERROR, not silently fixed", () => {
  const f = clone(F); f.itemRows[5][13] = "902.00";                       // item 3 total 932.00 -> 902.00
  const r = parse(f);
  assert.equal(r.reconciled, false);
  assert.equal(byCode(r, "sum-line-totals")[0].level, "error");
  assert.equal(byCode(r, "sum-line-totals")[0].diffMilli, -30000);
  assert.equal(r.items[2].totalMilli, 902000);                           // value kept as printed
});

test("a wrapped total that does not match the lines is an error", () => {
  const f = clone(F); f.itemRows[7][14] = "5";                           // "1125.0" + "5" = 1125.05
  const r = parse(f);
  assert.equal(r.reconciled, false);
  assert.equal(byCode(r, "sum-line-totals")[0].level, "error");          // 1125.05 vs 1125.00: 5 paise, beyond the Rs 0.01 printed-rounding tolerance
});

test("without the annexure the charge rows are NOT assumed to be one shared charge", () => {
  const f = clone(F); f.annexureRows = [];
  const r = parse(f);
  assert.equal(r.chargeAllocation, undefined);
  assert.equal(byCode(r, "charges-unlinked").length, 1);
});

test("charge rows that do not match the annexure are reported as unlinked and as an error", () => {
  const f = clone(F); f.annexureRows[1][4] = "9.000"; f.annexureRows[1][5] = "0.225"; f.annexureRows[1][6] = "0.225";
  const r = parse(f);
  assert.equal(r.chargeAllocation.linked, false);
  assert.equal(byCode(r, "charges-vs-annexure")[0].level, "error");
});

test("a printed-line-wrapped header ('Discou' + 'nt', 'Addition' + 'al Cess Val') is still recognised; unknown rows are excluded and flagged", () => {
  const f = clone(F); f.itemRows.splice(2, 0, ["", "", "Something unexpected", "", "", "", "", "", "", "", "", "", "", ""]);
  const r = parse(f);
  assert.equal(r.items.length, 3);
  assert.equal(r.unrecognisedRows.length, 1);
  assert.equal(byCode(r, "unrecognised-rows").length, 1);
});

test("missing table headings give an error and no figures", () => {
  const r = parseBlinkitGstInvoice({ textLines: [], itemRows: [["a", "b"], ["1", "2"]] });
  assert.equal(r.reconciled, false);
  assert.equal(r.items.length, 0);
});

test("amount in words", () => {
  assert.equal(wordsToMilli("Rupees One Thousand One Hundred Twenty Five Only"), 1125000);
  assert.equal(wordsToMilli("Rupees Two Lakh Three Thousand Only"), 203000000);
  assert.equal(wordsToMilli("Rupees Banana Only"), null);
});

test("the supplied fixture contains no personal data fields", () => {
  const txt = JSON.stringify(F);
  assert.doesNotMatch(txt, /@|\+91|\bphone\b|\bmobile\b/i);                // no email or phone markers (UPC codes are product codes, not phones)
  assert.doesNotMatch(txt, /customer|deliver(?:y)? to|address|signature/i);
});

// ---------------- fixture 2: text layer of the real PDF (redacted) ----------------
test("PDF fixture: header fields are separate and complete (placeholders stand in for the redacted real values)", () => {
  const r = parse(P);
  assert.deepEqual(r.identifiers, { invoiceNumber: "C00000T000000001", orderId: "0000000001" });
  assert.deepEqual([r.invoiceDate, r.invoiceDateIso, r.placeOfSupply], ["2026-01-15", "2026-01-15", "Goa"]);
  assert.deepEqual(r.merchant, { legalName: "Blink Commerce Private Limited", formerName: "Grofers India Private Limited", pan: "AAFCG9846E", cin: "U74140HR2015FTC055568" });
  assert.deepEqual(r.seller, { gstin: "30AAFCG9846E1ZO", pan: "AAFCG9846E", fssai: "10624002000077", address: "NR. Tarsamzor Aquem Margao Goa-403601" });
  assert.equal(r.registeredOfficeGstin, "06AAFCG9846E1ZF");
  assert.equal(r.importKey, "blinkit|30AAFCG9846E1ZO|C00000T000000001");
  for (const c of ["invoiceNumber-absent", "orderId-absent", "invoiceDate-absent"]) assert.equal(byCode(r, c).length, 0, c);
});

test("PDF fixture: the invoice and order number are different fields and the order id is not part of the duplicate key", () => {
  const r = parse(P);
  assert.notEqual(r.identifiers.invoiceNumber, r.identifiers.orderId);
  assert.ok(!r.importKey.includes(r.identifiers.orderId));
});

test("PDF fixture: seller GSTIN contains the PAN; seller state equals place of supply so CGST + SGST is expected", () => {
  const r = parse(P);
  assert.deepEqual(byCode(r, "pan-gstin").map(f => f.level), ["ok", "ok"]);
  assert.equal(byCode(r, "supply-intra-state")[0].level, "ok");
});

test("PDF fixture: cells with embedded line breaks are normalised (UPC, headings, descriptions) and the wrapped total is joined visibly", () => {
  const r = parse(P);
  assert.deepEqual(r.items.map(i => i.upc), ["8904004403732", "8904004400083", "8906000210321"]);
  assert.equal(r.items[2].description, "Pillsbury Fresh Chakki Atta (0% Maida)(Bag) (HSN-11010000)");
  const w = byCode(r, "wrapped-total-cell");
  assert.equal(w.length, 1);
  assert.deepEqual(w[0].cells, ["1125.0", "0"]);
  assert.equal(r.declaredTotals.totalMilli, 1125000);
});

test("PDF fixture reconciles exactly as the image fixture does: Rs 1,125.00, three Rs 0.01 row differences, one shared charge", () => {
  const r = parse(P);
  assert.equal(r.reconciled, true);
  assert.equal(byCode(r, "sum-line-totals")[0].level, "ok");
  assert.deepEqual(byCode(r, "row-identity").filter(f => f.diffMilli !== 0).map(f => f.diffMilli).sort((a, b) => a - b), [-10, 10, 10]);
  assert.equal(byCode(r, "grand-identity")[0].diffMilli, 10);
  assert.equal(r.chargeAllocation.linked, true);
  assert.equal(r.chargeAllocation.chargeRowsTotalMilli, 13000);
});

test("image transcription and PDF text layer agree on every printed figure (two independent sources, same invoice)", () => {
  const a = parse(F), b = parse(P), pick = r => ({ items: r.items.map(i => [i.srNo, i.upc, i.qty, i.mrpMilli, i.discountMilli, i.taxableMilli, i.cgstMilli, i.sgstMilli, i.totalMilli]), charges: r.chargeRows.map(c => [c.followsSrNo, c.taxableMilli, c.cgstMilli, c.sgstMilli, c.totalMilli]), totals: r.declaredTotals && [r.declaredTotals.qty, r.declaredTotals.taxableMilli, r.declaredTotals.cgstMilli, r.declaredTotals.sgstMilli, r.declaredTotals.totalMilli], annexure: r.annexure.map(x => [x.nature, x.taxableMilli, x.cgstMilli, x.sgstMilli]) });
  assert.deepEqual(pick(a), pick(b));
});

test("PDF fixture: the customer block is never in the fixture or in the parser output, and no payment or transaction fields exist", () => {
  const r = parse(P);
  assert.equal(byCode(r, "customer-block-ignored").length, 1);
  assert.doesNotMatch(JSON.stringify(P), /Invoice To|Name\s*:|Pin code|Address/);
  assert.doesNotMatch(Object.keys(r).join(","), /pay|account|transaction|accId|customer/i);
});

test("an invoice date in DD/MM form is kept as printed but NOT normalised (day/month order is never guessed)", () => {
  const f = clone(P); f.metaText = f.metaText.replace("2026-01-15", "03/04/2026");
  const r = parse(f);
  assert.deepEqual([r.invoiceDate, r.invoiceDateIso], ["03/04/2026", null]);
  assert.equal(byCode(r, "invoice-date-unnormalised").length, 1);
});

test("an impossible ISO date is an error", () => {
  const f = clone(P); f.metaText = f.metaText.replace("2026-01-15", "2026-02-31");
  assert.equal(byCode(parse(f), "invoice-date-invalid")[0].level, "error");
});

test("seller state different from place of supply with CGST+SGST printed is flagged", () => {
  const f = clone(P); f.metaText = f.metaText.replace("Place of Supply : Goa", "Place of Supply : Haryana");
  assert.equal(byCode(parse(f), "supply-inter-state")[0].level, "warn");
});

test("PDF fixture: a tampered seller GSTIN that no longer contains the PAN is an error", () => {
  const f = clone(P); f.sellerText = f.sellerText.replace("30AAFCG9846E1ZO", "30AAFCG9999E1ZO");
  const r = parse(f);
  assert.equal(byCode(r, "pan-gstin-mismatch").length, 1);
  assert.equal(r.reconciled, false);
});

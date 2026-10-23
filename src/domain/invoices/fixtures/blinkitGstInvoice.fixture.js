// FIXTURE 1: a transcription of the printed values on ONE real Blinkit GST invoice page (the lower part of the page only).
// Source type: an IMAGE of the invoice. This file is NOT the output of any OCR or PDF extractor; it is a hand transcription, laid out the way a
// table extractor would return it (cells as printed, including the printed line wraps such as "Discou"+"nt" and "1125.0"+"0").
// Redacted/omitted on purpose: customer name and address, order and invoice numbers and invoice date (none of these are in the supplied
// image), the authorised signatory's name and signature. Retained: the merchant's company identifiers (business, not personal) and the items.
export const BLINKIT_FIXTURE_1 = {
  textLines: [
    "State : Goa",
    "Blink Commerce Private Limited (formerly known as Grofers India Private Limited)",
    "GSTIN 06AAFCG9846E1ZF PAN AAFCG9846E",
    "CIN U74140HR2015FTC055568",
    "Amount in Words: Rupees One Thousand One Hundred Twenty Five Only",
    "Whether the tax is payable on reverse charge - No",
  ],
  itemRows: [
    ["Sr. no", "UPC", "Item Description", "MRP", "Discou nt", "Qty.", "Taxable Value", "CGST (%)", "CGST (INR)", "SGST (%)", "SGST (INR)", "Cess (%)", "Addition al Cess Val", "Total"],
    ["1", "8904004403 732", "Haldiram's Nagpur Moong Dal Namkeen(Pack) (HSN-21069099)", "60.00", "0.00", "1", "57.14", "2.50", "1.43", "2.50", "1.43", "0.00", "0.00", "60.00"],
    ["-", "-", "Delivery and other charges", "-", "-", "-", "0.67", "2.50", "0.02", "2.50", "0.02", "0.00", "0.00", "0.70"],
    ["2", "8904004400 083", "Haldiram's Nagpur Sev Bhujia(Pack) (HSN-21069099)", "120.00", "0.00", "1", "114.29", "2.50", "2.86", "2.50", "2.86", "0.00", "0.00", "120.00"],
    ["-", "-", "Delivery and other charges", "-", "-", "-", "1.33", "2.50", "0.03", "2.50", "0.03", "0.00", "0.00", "1.40"],
    ["3", "8906000210 321", "Pillsbury Fresh Chakki Atta (0% Maida)(Bag) (HSN-11010000)", "606.00", "280.00", "2", "887.62", "2.50", "22.19", "2.50", "22.19", "0.00", "0.00", "932.00"],
    ["-", "-", "Delivery and other charges", "-", "-", "-", "10.38", "2.50", "0.26", "2.50", "0.26", "0.00", "0.00", "10.90"],
    ["Total", "", "", "", "", "4", "1071.43", "", "26.79", "", "26.79", "", "", "1125.0", "0"],
  ],
  annexureRows: [
    ["S.No.", "Nature of charge", "Tax Rate", "Cess Rate", "Taxable Value", "CGST", "SGST", "Cess"],
    ["1", "Handling charge", "5.00", "0.00", "12.381", "0.310", "0.310", "0.000"],
    ["Total", "", "", "", "12.381", "0.310", "0.310", "0.000"],
  ],
};

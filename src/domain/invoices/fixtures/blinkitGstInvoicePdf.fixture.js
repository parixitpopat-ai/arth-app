// FIXTURE 2: the TEXT-LAYER extraction (table cells exactly as a table extractor returned them, line breaks inside cells included, e.g. "1125.0\n0") of ONE real
// Blinkit tax invoice PDF (one page). It supersedes fixture 1 (image transcription); the printed figures are identical and a test asserts that.
// Extracted offline with a Python table extractor in a scratch directory, NOT with anything that ships in the app.
// REDACTED / ALTERED on purpose: the whole "Invoice To" block (customer name, address, pin code) is not copied; invoice number, order id and invoice date are
// replaced with same-shape placeholders (C00000T000000001, 0000000001, 2026-01-15); the authorised signatory is not present. Everything else is as printed
// (seller identity and registrations are business information; items, amounts and taxes are the real printed values).
export const BLINKIT_FIXTURE_2 = {
  "sellerText": "Sold By / Seller\nBlink Commerce Private Limited\nNR. Tarsamzor Aquem Margao Goa-403601\n403601\nGSTIN : 30AAFCG9846E1ZO\nFSSAI License Number : 10624002000077\nCIN : U74140HR2015FTC055568\nPAN : AAFCG9846E",
  "metaText": "Invoice Number: C00000T000000001\nOrder Id : 0000000001\nInvoice Date : 2026-01-15\nPlace of Supply : Goa",
  "footerText": "Blink Commerce Private Limited (formerly known as Grofers India Private Limited)\nGSTIN 06AAFCG9846E1ZF PAN AAFCG9846E\nCIN U74140HR2015FTC055568",
  "textLines": [
    "Amount in Words: Rupees One Thousand One Hundred Twenty Five Only",
    "Whether the tax is payable on reverse charge - No"
  ],
  "itemRows": [
    [
      "Sr.\nno",
      "UPC",
      "Item Description",
      "MRP",
      "Discou\nnt",
      "Qty.",
      "Taxable\nValue",
      "CGST\n(%)",
      "CGST\n(INR)",
      "SGST\n(%)",
      "SGST\n(INR)",
      "Cess\n(%)",
      "Addition\nal Cess\nVal",
      "Total"
    ],
    [
      "1",
      "8904004403\n732",
      "Haldiram's Nagpur Moong Dal\nNamkeen(Pack) (HSN-21069099)",
      "60.00",
      "0.00",
      "1",
      "57.14",
      "2.50",
      "1.43",
      "2.50",
      "1.43",
      "0.00",
      "0.00",
      "60.00"
    ],
    [
      "-",
      "-",
      "Delivery and other charges",
      "-",
      "-",
      "-",
      "0.67",
      "2.50",
      "0.02",
      "2.50",
      "0.02",
      "0.00",
      "0.00",
      "0.70"
    ],
    [
      "2",
      "8904004400\n083",
      "Haldiram's Nagpur Sev\nBhujia(Pack) (HSN-21069099)",
      "120.00",
      "0.00",
      "1",
      "114.29",
      "2.50",
      "2.86",
      "2.50",
      "2.86",
      "0.00",
      "0.00",
      "120.00"
    ],
    [
      "-",
      "-",
      "Delivery and other charges",
      "-",
      "-",
      "-",
      "1.33",
      "2.50",
      "0.03",
      "2.50",
      "0.03",
      "0.00",
      "0.00",
      "1.40"
    ],
    [
      "3",
      "8906000210\n321",
      "Pillsbury Fresh Chakki Atta (0%\nMaida)(Bag) (HSN-11010000)",
      "606.00",
      "280.00",
      "2",
      "887.62",
      "2.50",
      "22.19",
      "2.50",
      "22.19",
      "0.00",
      "0.00",
      "932.00"
    ],
    [
      "-",
      "-",
      "Delivery and other charges",
      "-",
      "-",
      "-",
      "10.38",
      "2.50",
      "0.26",
      "2.50",
      "0.26",
      "0.00",
      "0.00",
      "10.90"
    ],
    [
      "Total",
      "",
      "",
      "",
      "",
      "4",
      "1071.43",
      "",
      "26.79",
      "",
      "26.79",
      "",
      "",
      "1125.0\n0"
    ]
  ],
  "annexureRows": [
    [
      "S.No.",
      "Nature of charge",
      "Tax Rate",
      "Cess Rate",
      "Taxable Value",
      "CGST",
      "SGST",
      "Cess"
    ],
    [
      "1",
      "Handling charge",
      "5.00",
      "0.00",
      "12.381",
      "0.310",
      "0.310",
      "0.000"
    ],
    [
      "Total",
      "",
      "",
      "",
      "12.381",
      "0.310",
      "0.310",
      "0.000"
    ]
  ]
};

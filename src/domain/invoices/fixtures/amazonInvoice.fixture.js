// SYNTHETIC Amazon.in invoice pages (pdf.js-style positioned text) shaped like the real layout. Every name, address, id and number here is invented.
export const BUYER = "Test Buyer", ADDR = "99 Sample Lane", CITY = "Testville 400001", PHONE = "+91 90000 00000", TXN = "TXNSECRET123456";
export const T = (str, x, y) => ({ str, x, y, w: str.length * 5 });
const header = (o, { sellerName, pan, gstin, orderNo, invNo }) => [
  T("Tax Invoice/Bill of Supply/Cash Memo", 200, 800),
  T("Sold By :", 30, 770), T("Billing Address :", 300, 770),
  T(sellerName, 30, 755), T(BUYER, 300, 755),
  T("Seller Road 1, Sellertown", 30, 742), T(ADDR, 300, 742), T(CITY, 300, 730), T(PHONE, 300, 718),
  T("PAN No:", 30, 700), T(pan, 130, 700), T("Shipping Address :", 300, 700),
  T("GST Registration No:", 30, 688), T(gstin, 150, 688), T(BUYER, 300, 688),
  T("Order Number:", 30, 640), T(orderNo, 120, 640), T("Invoice Number :", 300, 640), T(invNo, 400, 640),
  T("Order Date:", 30, 628), T("25.10.2026", 120, 628), T("Invoice Details :", 300, 628), T("XX-YYY-1", 400, 628),
  T("Invoice Date :", 300, 616), T("25.10.2026", 400, 616),
];
const footer = totals => [T("TOTAL:", 30, 380), ...totals, T("Payment Transaction ID:", 30, 300), T(TXN, 150, 300), T("Mode of Payment:", 300, 300), T("Credit Card", 400, 300)];

export const productPage = (over = {}) => [
  ...header(0, { sellerName: "Sample Traders", pan: "ABCDE1234F", gstin: "29ABCDE1234F1Z5", orderNo: "123-4567890-1234567", invNo: "SMP-1001", ...over }),
  T("Sl.", 20, 600), T("Unit", 250, 600), T("Net", 300, 600), T("Tax", 340, 600), T("Tax", 380, 600), T("Tax", 420, 600), T("Total", 470, 600),
  T("Description", 80, 590), T("Qty", 270, 590),
  T("No", 20, 580), T("Price", 250, 580), T("Amount", 300, 580), T("Rate", 340, 580), T("Type", 380, 580), T("Amount", 420, 580), T("Amount", 470, 580),
  T("Sample ECR 11 MC Fast Charger + 4X AA 1000mAh", 80, 565), T("1", 20, 553), T("Batteries", 80, 553), T("B0AAAA1111 (", 130, 553), T("IGST", 380, 541),
  T("₹821.19", 250, 541), T("1", 275, 541), T("₹821.19", 300, 541), T("18%", 345, 541), T("₹147.81", 420, 541), T("₹969.00", 470, 541),
  T("SAMPLE_SKU_1 )", 80, 529), T("HSN:8507", 80, 517),
  ...footer([T("₹147.81", 420, 380), T("₹969.00", 470, 380)]),
];
export const feePage = () => [
  ...header(0, { sellerName: "Amazon Seller Services Private Limited", pan: "AAAAA0000A", gstin: "29AAAAA0000A1ZZ", orderNo: "123-4567890-1234567", invNo: "AMZ-2002" }),
  T("Sl. No", 20, 600), T("Description", 80, 600), T("Unit Price", 250, 600), T("Qty", 290, 600), T("Net Amount", 310, 600), T("Tax Rate", 360, 600), T("Tax Type", 400, 600), T("Tax Amount", 440, 600), T("Total Amount", 490, 600),
  T("1", 20, 585), T("Offer Processing Fees", 80, 585), T("IGST", 400, 585),
  T("₹2.82", 250, 585), T("₹2.82", 310, 585), T("18%", 360, 585), T("₹0.51", 440, 585), T("₹3.33", 490, 585),
  ...footer([T("₹0.51", 440, 380), T("₹3.33", 490, 380)]),
];


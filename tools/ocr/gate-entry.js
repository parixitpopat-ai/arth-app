// Test harness for INVOICE-IMPORT-009 step 4. Built only by tools/ocr/vite.gate.config.js, never shipped with the app.
import { createLocalOcrWorker, releaseOcrWorker } from "../../src/domain/invoices/ocr/ocrEngine.js";

// An INVENTED order summary picture (fake name, address and card line) drawn on a canvas.
function drawSample() {
  const c = document.createElement("canvas"); c.width = 900; c.height = 420;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.fillStyle = "#111"; g.font = "28px sans-serif";
  ["Order Summary", "Item(s) Subtotal: Rs. 329.00", "Postage & Packing: Rs. 50.00", "Total: Rs. 379.00", "Grand Total: Rs. 379.00", "Pat Example, 1 Sample Street", "Visa ending in 0000"]
    .forEach((t, i) => g.fillText(t, 30, 50 + i * 55));
  return c.toDataURL("image/png");
}

window.__ocrGate = {
  async run() {
    const worker = await createLocalOcrWorker(new URL("./", document.baseURI).href);
    const result = await worker.recognize(drawSample());
    await releaseOcrWorker(worker);
    await releaseOcrWorker(worker);
    return { text: result.data.text };
  },
};

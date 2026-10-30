/* global process */
// Production-mode build of the OCR gate harness (same plugin as the app's ARTH_OCR_ASSETS build) into OCR_GATE_OUT.
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import ocrAssets from "./viteOcrAssets.js";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [ocrAssets()],
  build: { outDir: process.env.OCR_GATE_OUT, emptyOutDir: true, rollupOptions: { input: fileURLToPath(new URL("./gate.html", import.meta.url)) } },
  preview: { port: 4179, strictPort: true },
});

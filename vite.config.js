/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import ocrAssets from './tools/ocr/viteOcrAssets.js'

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  // The OCR engine's files are copied into the build only when ARTH_OCR_ASSETS=1 (off for every normal build).
  plugins: [react(), ...(process.env.ARTH_OCR_ASSETS === '1' ? [ocrAssets()] : [])],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    // Which Vercel environment is building (production / preview / development; empty off Vercel). See src/cloudConfig.js.
    'import.meta.env.VITE_VERCEL_ENV': JSON.stringify(process.env.VERCEL_ENV || ''),
  },
  server: {
    host: "localhost",
    port: 5174,
  },
})

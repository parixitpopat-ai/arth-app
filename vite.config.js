/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import ocrAssets from './tools/ocr/viteOcrAssets.js'

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  // The OCR engine's own files (worker, text-only cores, English data) ship under ocr/ and are fetched only when the person reads a picture.
  plugins: [react(), ocrAssets()],
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

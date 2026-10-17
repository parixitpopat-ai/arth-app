import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react()],
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

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline reopen: cache the app shell (public/sw.js). Production builds on http(s) only, never inside the native app.
if ('serviceWorker' in navigator && import.meta.env.PROD && /^https?:$/.test(window.location.protocol) && !window.Capacitor?.isNativePlatform?.()) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}

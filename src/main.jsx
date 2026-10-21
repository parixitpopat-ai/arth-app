import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AuthCallbackBanner from './components/AuthCallbackBanner.jsx'
import { supabase } from './cloudSync.js'
import { startNativeAuthLinks } from './nativeAuthLinks.js'
import { createAuthCallbackHandler } from './authCallback.js'

// Returning sign-in links (installed Android app only; inert in a browser or without cloud sync).
const authLinks = createAuthCallbackHandler({ client: supabase })
if (supabase) startNativeAuthLinks({ client: supabase, handler: authLinks, allowDevScheme: import.meta.env.VITE_AUTH_ALLOW_DEV_SCHEME === '1' }).catch(() => {})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <AuthCallbackBanner handler={authLinks} />
  </StrictMode>,
)

// Offline reopen: cache the app shell (public/sw.js). Production builds on http(s) only, never inside the native app.
if ('serviceWorker' in navigator && import.meta.env.PROD && /^https?:$/.test(window.location.protocol) && !window.Capacitor?.isNativePlatform?.()) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}

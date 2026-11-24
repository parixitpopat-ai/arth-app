import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
// Inter and Manrope ship inside the app (they used to load from Google, so offline the system font showed). The rupee sign lives only in the latin-ext files, so both sets are bundled.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-ext-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-ext-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-ext-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-ext-700.css'
import '@fontsource/inter/latin-800.css'
import '@fontsource/inter/latin-ext-800.css'
import '@fontsource/inter/latin-900.css'
import '@fontsource/inter/latin-ext-900.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-ext-600.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/manrope/latin-ext-700.css'
import '@fontsource/manrope/latin-800.css'
import '@fontsource/manrope/latin-ext-800.css'
import './index.css'
import App from './App.jsx'
import StorageFullGuard from './components/StorageFullGuard.jsx'
import StoredDataRecovery, { RecoveryNotice } from './components/StoredDataRecovery.jsx'
import { repairStored, startEmpty } from './storage/repairStored.js'

// Before anything is drawn: a damaged saved list is restored from a backup, or the person is asked (see storage/repairStored.js).
const repair = (() => { try { return repairStored(window.localStorage) } catch { return { restored: [], needsChoice: [] } } })()

function Root() {
  const [pending, setPending] = useState(repair.needsChoice)
  if (pending.length) {
    return <StoredDataRecovery keys={pending} onStartEmpty={() => { startEmpty(window.localStorage, pending.map(p => p.key)); setPending([]) }} />
  }
  return (
    <>
      <App />
      <StorageFullGuard />
      <RecoveryNotice />
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

// Offline reopen: cache the app shell (public/sw.js). Production builds on http(s) only, never inside the native app.
if ('serviceWorker' in navigator && import.meta.env.PROD && /^https?:$/.test(window.location.protocol) && !window.Capacitor?.isNativePlatform?.()) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}

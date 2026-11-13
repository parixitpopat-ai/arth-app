import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
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

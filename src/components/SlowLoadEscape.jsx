import { useEffect, useState } from "react";

// Shown in place of a bare "Loading…" while Arth checks the account and syncs. If that takes too long, the person is offered the way
// in that always works: open the data already saved on this phone (the existing offline-resume mode; sync retries on "Try again").
// Nothing is changed or deleted by waiting, by this button or by reloading.
export default function SlowLoadEscape({ T, label, onOpenLocal, afterMs = 12000 }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), afterMs); return () => clearTimeout(t); }, [afterMs]);
  const btn = primary => ({ width: "100%", minHeight: 48, borderRadius: 12, border: primary ? "none" : `1px solid ${T.border}`, background: primary ? T.accent : "none", color: primary ? "#fff" : T.text, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Nunito,sans-serif", marginTop: 10 });
  return (
    <div data-testid="slow-load" style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.sub, fontSize: 13, fontFamily: "Nunito,sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 340, width: "100%", textAlign: "center" }}>
        <div>{label}</div>
        {slow && (
          <div data-testid="slow-load-escape" style={{ marginTop: 18 }}>
            <div style={{ color: T.text, fontSize: 14, fontWeight: 800 }}>This is taking longer than expected</div>
            <div style={{ marginTop: 6, lineHeight: 1.5 }}>Your data is safe on this phone. You can open it now; Arth keeps trying to reach your account.</div>
            <button data-testid="slow-load-open" onClick={onOpenLocal} style={btn(true)}>Open the data saved on this phone</button>
            <button data-testid="slow-load-reload" onClick={() => window.location.reload()} style={btn(false)}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { notifPermissionStatus, openNotificationSettings, notifBlockedMessage } from "../native/notifPermission.js";

// Notifications screen: what the phone says about Arth's notifications right now, and, after a switch could not be turned on, why. It stays on the screen
// (a toast is too short and too narrow for this). The button goes to Android's own notification settings for Arth.
export default function NotificationStatus({ T, problem }) {
  const [st, setSt] = useState(null);
  useEffect(() => { let gone = false; notifPermissionStatus().then(r => { if (!gone) setSt(r); }); return () => { gone = true; }; }, [problem]);
  if (!st) return null;
  if (st.state === "not-on-phone") return null;
  const ok = st.ok && !problem;
  return (
    <div data-testid="notif-status" style={{ background: ok ? T.success + "14" : T.warn + "16", border: `1px solid ${ok ? T.success : T.warn}44`, borderRadius: 14, padding: "12px 14px", margin: "0 16px 16px" }}>
      <div style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>{ok ? "✓ Your phone lets Arth show notifications" : "Notifications are not working for Arth yet"}</div>
      {!st.ok && <div data-testid="notif-status-reason" style={{ color: T.text, fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>{notifBlockedMessage(st.state)} <span style={{ color: T.sub }}>(phone says: {st.state})</span></div>}
      {problem && <div data-testid="notif-problem" style={{ color: T.text, fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>Last try: {problem}</div>}
      {!ok && <button data-testid="notif-open-settings" onClick={() => openNotificationSettings()} style={{ marginTop: 10, background: T.accent, border: "none", borderRadius: 12, minHeight: 44, padding: "0 16px", color: T.accentInk || "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Inter,sans-serif" }}>Open Arth's notification settings</button>}
    </div>
  );
}

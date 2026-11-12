// src/native/useSmsInbox.js — Arth's bell list of bank messages caught as they arrive (Android app only).
// The phone side (ArthSmsPlugin / SmsReceiver) queues each money-looking message and shows a notification; this hook collects the queue when Arth opens,
// returns to the front, and every 20 seconds while it is open, turns each message into a PROPOSAL and keeps it until the person accepts or discards it.
// Proposals live only on this phone (localStorage, not synced). Nothing is added to the books here: Accept opens the Add form filled in.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { smsAvailable, smsStatus, smsRequest, smsTakePending, smsAckPending } from "./smsBridge.js";
import { toPendingItems, itemStatuses, draftFor } from "../domain/sms/smsPending.js";
import { payeeNamesByUpiId } from "../domain/imports/upiId.js";

const HELD = "arth_sms_pending", HANDLED = "arth_sms_handled";
const load = k => { try { const v = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked: the list just is not kept */ } };

export function useSmsInbox({ accounts, txns, people }) {
  const available = smsAvailable();
  const [held, setHeld] = useState(() => load(HELD));
  const [handled, setHandled] = useState(() => load(HANDLED));
  const [perm, setPerm] = useState({ granted: false, receive: false, notify: false });
  const busy = useRef(false), live = useRef({});
  live.current = { held, handled, accounts };

  const drain = useCallback(async () => {
    if (!available || busy.current) return;
    busy.current = true;
    try {
      const st = await smsStatus(); setPerm(st);
      if (!st.receive) return;
      const q = await smsTakePending();
      if (!q.length) return;
      const { held: h, handled: d, accounts: a } = live.current;
      const r = toPendingItems(q, a, { haveIds: [...h.map(i => i.id), ...d] });
      const add = [...r.items, ...r.unread];
      if (add.length) setHeld(prev => { const n = [...prev, ...add]; save(HELD, n); return n; });
      await smsAckPending(q.map(m => m.id));          // taken: now held, handled, or not a money message
    } finally { busy.current = false; }
  }, [available]);

  useEffect(() => {
    if (!available) return undefined;
    drain();
    const onVis = () => { if (document.visibilityState === "visible") drain(); };
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(() => { if (document.visibilityState === "visible") drain(); }, 20000);
    return () => { document.removeEventListener("visibilitychange", onVis); clearInterval(t); };
  }, [available, drain]);

  const payeeByUpiId = useMemo(() => payeeNamesByUpiId(txns, people), [txns, people]);
  const staged = useMemo(() => itemStatuses(held.filter(i => !i.unreadable), { txns, accounts }), [held, txns, accounts]);

  // an item whose entry is now in the books is finished: move it to "handled"
  useEffect(() => {
    const done = staged.filter(i => i.status === "saved").map(i => i.id);
    if (!done.length) return;
    setHandled(prev => { const n = [...new Set([...prev, ...done])].slice(-500); save(HANDLED, n); return n; });
    setHeld(prev => { const n = prev.filter(i => !done.includes(i.id)); save(HELD, n); return n; });
  }, [staged]);

  const items = useMemo(() => [...staged.filter(i => i.status !== "saved"), ...held.filter(i => i.unreadable)].sort((x, y) => String(y.date || "").localeCompare(String(x.date || ""))), [staged, held]);

  const finish = useCallback(id => {
    setHandled(prev => { const n = [...new Set([...prev, id])].slice(-500); save(HANDLED, n); return n; });
    setHeld(prev => { const n = prev.filter(i => i.id !== id); save(HELD, n); return n; });
  }, []);
  const request = useCallback(async () => { const st = await smsRequest(); setPerm(st); if (st.receive) drain(); return st; }, [drain]);
  const accept = useCallback(item => draftFor(item, accounts, payeeByUpiId), [accounts, payeeByUpiId]);

  return { available, perm, items, request, accept, discard: finish, done: finish, drain };
}

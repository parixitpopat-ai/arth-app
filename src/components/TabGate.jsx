import { useEffect, useRef, useState } from "react";
import TabPausedScreen from "./TabPausedScreen";
import { createTabOwnership, watchForeignWrites } from "../sync/tabOwnership";

// SYNC-SAFETY-004: only ONE tab of this browser profile runs Arth at a time (two tabs share storage but not memory; a stale tab would
// save over the other's data and then sync it). Other tabs mount nothing, so they cannot save or sync; the person can take over explicitly.
export default function TabGate({ children }) {
  const [own, setOwn] = useState("waiting");     // waiting | owner | lost
  const [showWaiting, setShowWaiting] = useState(false);
  const [stale, setStale] = useState(false);
  const ctlRef = useRef(null);
  useEffect(()=>{
    const tabId = `tab_${Math.random().toString(36).slice(2,10)}${Date.now().toString(36)}`;
    const locks = typeof navigator!=="undefined" && navigator.locks && typeof navigator.locks.request==="function" ? navigator.locks : null;
    const o = createTabOwnership({ locks, storage:window.localStorage, tabId, onChange:setOwn });
    ctlRef.current = o; o.start();
    const t = setTimeout(()=>setShowWaiting(true), 700);   // a reload briefly queues behind the old page; do not flash the pause screen for that
    return ()=>{ clearTimeout(t); o.stop(); };
  }, []);
  useEffect(()=>{
    if(own!=="owner") return undefined;
    return watchForeignWrites(window, window.localStorage, ()=>setStale(true));   // another tab changed the synced data under this one
  }, [own]);
  if(own==="owner" && !stale) return children;
  if(own==="waiting" && !showWaiting) return <div style={{ minHeight:"100vh",background:"#08080f" }}/>;
  return <TabPausedScreen reason={stale?"stale":"other"} onTakeOver={()=>{ setStale(false); ctlRef.current?.takeOver(); }} onReload={()=>window.location.reload()}/>;
}

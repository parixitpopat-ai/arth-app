import { useEffect, useState } from "react";

/** Browser connectivity (navigator.onLine + online/offline events). Treated as online when unavailable. */
export default function useOnline() {
  const read = () => (typeof navigator === "undefined" || navigator.onLine !== false);
  const [online, setOnline] = useState(read);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

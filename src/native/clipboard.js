// native/clipboard.js
//
// Reads the text on the clipboard for the "Paste" button. In the Android app the web view does not allow navigator.clipboard.readText
// (it is refused without a permission prompt), so the button did nothing and said nothing. The app uses Capacitor's own Clipboard
// plugin there, and the browser API on the web. Either way a failure is reported to the caller, never swallowed.

import { Capacitor } from "@capacitor/core";
import { Clipboard } from "@capacitor/clipboard";

const isNative = () => { try { return Boolean(Capacitor?.isNativePlatform?.()); } catch { return false; } };

/** @returns {Promise<string>} the clipboard text ("" when it is empty). Rejects when reading is not allowed. */
export async function readClipboardText() {
  if (isNative()) {
    const r = await Clipboard.read();
    return String(r?.value ?? "");
  }
  if (!(typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.readText)) throw new Error("not available");
  return String((await navigator.clipboard.readText()) ?? "");
}

export const PASTE_BLOCKED_MESSAGE = "Automatic paste is not available here. Long-press the box and choose Paste.";
export const PASTE_EMPTY_MESSAGE = "Your clipboard is empty. Copy the bank SMS first.";

import { Capacitor, registerPlugin } from "@capacitor/core";

const ArthSms = registerPlugin("ArthSms");

export const isNativeSmsAvailable = () => {
  try {
    return Boolean(Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
};

export const canUseClipboardSmsImport = () => {
  try {
    return Boolean(window?.isSecureContext && navigator?.clipboard?.readText);
  } catch {
    return false;
  }
};

export const readCopiedSms = async () => {
  if (!canUseClipboardSmsImport()) {
    throw new Error("Clipboard access is not available here. Copy the SMS first or use the Android app.");
  }
  const text = await navigator.clipboard.readText();
  if (!String(text || "").trim()) {
    throw new Error("Your clipboard is empty. Copy the bank SMS first.");
  }
  return { text, source: "clipboard" };
};

export const readLatestPhoneSms = async () => {
  if (isNativeSmsAvailable()) {
    try {
      const result = await ArthSms.readLatestMessages?.({ limit: 12 });
      const messages = Array.isArray(result?.messages) ? result.messages : [];
      const match = messages.find(msg => /debited|credited|spent|received|upi|purchase|sent|refund/i.test(String(msg?.body || msg?.text || "")));
      const text = String(match?.body || match?.text || "").trim();
      if (text) return { text, source: "phone" };
    } catch (err) {
      try {
        return await readCopiedSms();
      } catch {
        throw err;
      }
    }
  }
  return readCopiedSms();
};

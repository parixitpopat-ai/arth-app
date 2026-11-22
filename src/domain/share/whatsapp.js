// domain/share/whatsapp.js
//
// One-tap WhatsApp: a "click to chat" link (https://wa.me/<number>?text=<message>) opens WhatsApp from the person's OWN number with the
// message already typed; they press Send. Arth cannot press Send for them: WhatsApp's official API does not support automated messages from a
// personal number. Pure.

/**
 * Digits only, with the country code. A plain 10-digit number is taken to be Indian (+91); a number that already starts with a country code
 * (a leading + or 00, or more than 10 digits) is kept as given. Returns "" when there is nothing usable.
 */
export function normalisePhone(raw, defaultCountryCode = "91") {
  let s = String(raw || "").trim();
  if (!s) return "";
  const hadPlus = s.startsWith("+");
  s = s.replace(/[^\d]/g, "");
  if (!s) return "";
  if (!hadPlus && s.startsWith("00")) s = s.slice(2);
  else if (!hadPlus) {
    s = s.replace(/^0+/, "");
    if (s.length === 10) s = defaultCountryCode + s;
  }
  return s.length >= 8 && s.length <= 15 ? s : "";
}

/** The link to open. With no usable number it opens WhatsApp's own contact chooser with the text ready. */
export function whatsappLink({ phone, text }) {
  const number = normalisePhone(phone);
  const q = `text=${encodeURIComponent(String(text || ""))}`;
  return number ? `https://wa.me/${number}?${q}` : `https://wa.me/?${q}`;
}

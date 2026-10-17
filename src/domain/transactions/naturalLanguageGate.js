// Feature gate for the typed-sentence input in Quick Add.
//
// On only when the page address carries exactly one `nl` parameter whose value is exactly "1" (for example
// https://host/?nl=1). Anything else leaves it off: no parameter, nl=0, nl=true, nl=11, an empty value, a
// repeated or conflicting nl, or a different parameter name. Nothing is stored: the address is the only
// switch, so opening the app without it always shows the ordinary Quick Add.
export function isNaturalLanguageEntryEnabled(search) {
  try {
    return new URLSearchParams(String(search ?? "")).getAll("nl").join(",") === "1";
  } catch {
    return false;
  }
}

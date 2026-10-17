// Switch for the typed-sentence input in Quick Add.
//
// ON by default. It is turned off only when the page address carries exactly one `nl` parameter equal to "0"
// (for example https://host/?nl=0): an emergency off switch that needs no new deployment. Any other address,
// including ?nl=1, shows it. Nothing is stored: the address is the only switch.
export function isNaturalLanguageEntryEnabled(search) {
  try {
    return new URLSearchParams(String(search ?? "")).getAll("nl").join(",") !== "0";
  } catch {
    return true;
  }
}

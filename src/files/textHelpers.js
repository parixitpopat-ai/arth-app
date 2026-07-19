// Normalizes free text for matching purposes (vendor/merchant names against
// category rules, investment type inference). Lowercase, strip punctuation,
// collapse whitespace. Not a display formatter — output is for comparison,
// never shown to the user directly.
export const normalizeVendorText = value => String(value ?? "")
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

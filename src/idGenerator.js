// Generates a short, random, non-cryptographic ID for new records
// (transactions, people, bills, etc.). Not a UUID — collisions are
// astronomically unlikely at this app's scale, and the shortness matters
// for readability when IDs show up in debug output or URLs.
export const genId = () => Math.random().toString(36).slice(2,9);

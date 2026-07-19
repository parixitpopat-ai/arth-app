// Money input parsing and comparison. Pairs with helpers/formatters.js
// (which handles the *display* direction — number to string); these
// handle the *input* direction — string to number — plus float-safe
// comparison. No validators.js exists separately: checked the codebase,
// there's no distinct "is this valid" logic beyond what's here, and these
// are money-domain functions, not generic validation, per the domain-first
// rule.

// Parses a money string (possibly with ₹, commas, whitespace) into a
// number. Used when reading a stored/typed value that's already complete.
export const parseMoney = v => {
  const cleaned = String(v ?? "").replace(/[₹,\s]/g,"");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

// Cleans a money input *as the user types it* — strips currency symbols
// and non-digit characters, but keeps it as a string (not parsed to a
// number yet) and collapses multiple decimal points down to one. Used on
// onChange handlers where you don't want to force-parse mid-keystroke.
export const cleanMoneyInput = v => {
  const stripped = String(v ?? "").replace(/[₹,\s]/g, "");
  const cleaned = stripped.replace(/[^\d.]/g, "");
  const dotIndex = cleaned.indexOf(".");
  if(dotIndex === -1) return cleaned;
  const whole = cleaned.slice(0, dotIndex);
  const decimal = cleaned.slice(dotIndex + 1).replace(/\./g, "");
  return `${whole}.${decimal}`;
};

// Float-safe equality for money — avoids the classic 0.1 + 0.2 !== 0.3
// class of bugs when comparing computed totals against a stored amount.
export const nearlyEqualMoney = (a,b) => Math.abs(Number(a||0) - Number(b||0)) < 0.01;

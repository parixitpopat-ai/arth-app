import { BUTTON, RADIUS, TOUCH, FONT } from "../../constants/theme";

// Shared style and text helpers for the UI-2C People & Groups sheets (M1).

export const fieldStyles = T => ({
  label: { color: T.sub, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 },
  input: { background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, minHeight: TOUCH.min, padding: "0 14px", color: T.text, fontSize: 15, width: "100%", outline: "none", fontFamily: FONT.sans, boxSizing: "border-box" },
  primary: { ...BUTTON("primary", T), width: "100%" },
  secondary: { ...BUTTON("secondary", T) },
  hint: { color: T.sub, fontSize: 12, lineHeight: 1.45 },
});

export function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export const RELATION_OPTIONS = ["Spouse", "Child", "Parent", "Sibling", "Grandparent", "Grandchild", "In-law", "Uncle", "Aunt", "Cousin", "Friend", "Colleague", "Neighbour", "Other"];

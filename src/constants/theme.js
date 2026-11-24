// Arth theme tokens — split 2026-09-17 per designer's compatibility correction.
// Old TYPE and SPACE are restored to their EXACT original names and shapes — nothing that
// already reads TYPE.h1/strong/h3/h2/label/body or SPACE.xs/sm/md/lg/xl/xxl changes behaviour.
// The new scales from the Design Direction handoff (typeface B — Instrument Sans + IBM Plex
// Mono) are exposed under DISTINCT names, TYPE_SCALE and SPACE_SCALE, per the designer's own
// note: "keep the old TYPE/SPACE exports under their original names and shapes, and expose the
// new scales below under distinct names... migrate call sites deliberately in one commit."
// New components should import TYPE_SCALE / SPACE_SCALE. No existing call site uses either name
// yet, so this is a clean rename with zero migration debt as of this commit.

export const FONT = {
  sans: "Inter, system-ui, sans-serif",
  mono: "Inter, system-ui, sans-serif",   // one typeface throughout (Inter; Manrope only on big money numbers): there is no separate monospace any more
};

export const DARK = {
  // New look, dark: the same sage-green family as LIGHT (a green-tinted charcoal instead of the old blue-violet navy).
  bg: "#0e1411", card: "#161e19", input: "#1b2520", nav: "#121915", pill: "#1f2a24",
  border: "#26332c", borderStrong: "#3a4a41",
  text: "#e6ece8", textStrong: "#ffffff",
  sub: "#9aa9a0",      // 6.9:1 on card
  subDim: "#8a9990",   // 5.7:1 — floor, nothing dimmer ships
  accent: "#3fcf8e", accentSoft: "rgba(63,207,142,0.14)", accentInk: "#06261a", success: "#3fcf8e",
  attention: "#e8ad2f", attentionSoft: "rgba(232,173,47,0.16)", warn: "#e8ad2f", gold: "#e8ad2f",
  danger: "#f06a6a", dangerSoft: "rgba(240,106,106,0.16)", dangerText: "#f58a8a",
  info: "#4fc3d9", infoSoft: "rgba(79,195,217,0.16)", infoText: "#6fd3e6",
  mutedSoft: "rgba(154,169,160,0.18)", mutedText: "#bccac1",
  purple: "#a78bfa", sh: "rgba(0,0,0,0.6)",
  coming: "#7fb0ff", owing: "#f0a56a",   // money coming to you / money you owe (Today, People)
};

export const LIGHT = {
  bg: "#f1f3ef", card: "#ffffff", input: "#e8ece6", nav: "#ffffff", pill: "#e4e8e2",
  border: "#dde2dc", borderStrong: "#bfc8c0",
  text: "#121c17", textStrong: "#0a110d",
  sub: "#56625b", subDim: "#66726b",
  accent: "#0a6b44", accentSoft: "rgba(10,107,68,0.10)", accentInk: "#ffffff", success: "#0a6b44",
  attention: "#a16207", attentionSoft: "rgba(161,98,7,0.12)", warn: "#a16207", gold: "#a16207",
  danger: "#dc2626", dangerSoft: "rgba(220,38,38,0.10)", dangerText: "#b91c1c",
  info: "#0e7490", infoSoft: "rgba(14,116,144,0.10)", infoText: "#0e7490",
  mutedSoft: "rgba(86,98,91,0.10)", mutedText: "#3f4a44",
  purple: "#7c3aed", sh: "rgba(0,0,0,0.06)",
  coming: "#174ea6", owing: "#9a4508",   // money coming to you / money you owe (Today, People)
};

export const PALETTE = ["#f0a500","#22c55e","#3b82f6","#ef4444","#a855f7","#06b6d4","#f97316","#ec4899","#84cc16","#14b8a6","#8b5cf6","#f43f5e","#0ea5e9","#10b981","#f59e0b"];

// --- ORIGINAL, UNCHANGED (do not add new keys here — use SPACE_SCALE / TYPE_SCALE) ---
export const SPACE = { xs:4, sm:8, md:12, lg:16, xl:24, xxl:32 };

export const TYPE = {
  micro:  { fontSize:9,  fontWeight:700 }, // badges, tiny labels
  label:  { fontSize:11, fontWeight:700 }, // field labels, section headers
  body:   { fontSize:13, fontWeight:600 }, // default body text
  strong: { fontSize:14, fontWeight:800 }, // emphasized body, card titles
  h3:     { fontSize:16, fontWeight:900 }, // sheet/modal titles
  h2:     { fontSize:20, fontWeight:900 }, // section headers
  h1:     { fontSize:26, fontWeight:900 }, // screen-level headers, big numbers
};

// --- NEW, per Design Direction handoff (typeface B). Use these in new components. ---
export const SPACE_SCALE = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 10: 40 };
export const RADIUS = { sm: 8, md: 12, lg: 14, pill: 999 };
export const TOUCH = { min: 48, icon: 48 };

export const TYPE_SCALE = {
  heroAmount: { fontFamily: FONT.mono, fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" },
  title:      { fontFamily: FONT.sans, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em" },
  section:    { fontFamily: FONT.sans, fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" },
  cardTitle:  { fontFamily: FONT.sans, fontSize: 17, fontWeight: 600 },
  rowTitle:   { fontFamily: FONT.sans, fontSize: 15, fontWeight: 600 },
  body:       { fontFamily: FONT.sans, fontSize: 15, fontWeight: 400, lineHeight: 1.5 },
  meta:       { fontFamily: FONT.sans, fontSize: 13, fontWeight: 400 },
  label:      { fontFamily: FONT.sans, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" },
};

export const MONEY = {
  hero: { fontFamily: FONT.mono, fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" },
  card: { fontFamily: FONT.mono, fontSize: 22, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  row:  { fontFamily: FONT.mono, fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  meta: { fontFamily: FONT.mono, fontSize: 13, fontWeight: 400, fontVariantNumeric: "tabular-nums" },
};

export const STATUS = {
  scheduled:  { label: "Scheduled",   tone: "muted" },
  upcoming:   { label: "Upcoming",    tone: "muted" },
  dueToday:   { label: "Due today",   tone: "attention" },
  due:        { label: "Due",         tone: "attention" },
  overdue:    { label: "Overdue",     tone: "negative" },
  partial:    { label: "Partial",     tone: "attention" },
  paid:       { label: "Paid",        tone: "positive" },
  completed:  { label: "Completed",   tone: "positive" },
  unsettled:  { label: "Unsettled",   tone: "muted" },
  paused:     { label: "Paused",      tone: "muted" },
  ended:      { label: "Ended",       tone: "muted" },
  writtenOff: { label: "Written off", tone: "muted" },
  // Outlook redesign (WP10) — the two further display statuses its "one row, seven source
  // types" lookup needs (Bill/card statement/loan/SIP already covered by due/scheduled above).
  unpaid:     { label: "Unpaid",      tone: "attention" },
  expected:   { label: "Expected",    tone: "muted" },
};

const TONE = {
  positive:  (T) => ({ background: T.accentSoft,    color: T.accent }),
  attention: (T) => ({ background: T.attentionSoft, color: T.attention }),
  negative:  (T) => ({ background: T.dangerSoft,    color: T.dangerText }),
  muted:     (T) => ({ background: T.mutedSoft,     color: T.mutedText }),
};

export const statusStyle = (id, T) => {
  const s = STATUS[id];
  if (!s) return TONE.muted(T);
  return {
    ...TONE[s.tone](T),
    display: "inline-flex", alignItems: "center", gap: 4,
    borderRadius: RADIUS.pill, padding: "3px 9px",
    fontFamily: FONT.sans, fontSize: 12, fontWeight: 600, lineHeight: 1.3,
  };
};

export const BUTTON = (variant, T) => {
  const base = {
    minHeight: TOUCH.min, borderRadius: RADIUS.md, padding: "0 18px",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    fontFamily: FONT.sans, fontSize: 15, fontWeight: 600,
    cursor: "pointer", border: "1px solid transparent", boxSizing: "border-box",
    color: T.text,
  };
  const v = {
    primary:     { background: T.accent, color: T.accentInk },
    secondary:   { background: "none", color: T.text, borderColor: T.borderStrong },
    ghost:       { background: "none", color: T.accent },
    destructive: { background: "none", color: T.dangerText, borderColor: T.dangerSoft },
  }[variant] || {};
  return { ...base, ...v };
};

export const FOCUS_RING = (T) => ({ outline: `2px solid ${T.accent}`, outlineOffset: 2 });

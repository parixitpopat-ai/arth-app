// Arth theme tokens — merged 2026-09-17: adds every new role/scale from arth-tokens.js
// (Design Direction handoff, typeface B — Instrument Sans + IBM Plex Mono) while keeping every
// existing exported name so nothing that already imports from here breaks. TYPE.label and
// TYPE.body take the NEW values on purpose — the design intentionally supersedes those two.
// Old TYPE.micro/strong/h3/h2/h1 and old SPACE.xs/sm/md/lg/xl/xxl are kept as-is alongside the
// new SPACE 1/2/3/4/6/8/10 scale — new components should prefer the new scale; nothing old
// needs to change to get the contrast/type-floor fixes.

export const FONT = {
  sans: "'Instrument Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
};

export const DARK = {
  bg: "#08080f", card: "#0f0f1a", input: "#0b0b18", nav: "#0a0a16", pill: "#14142a",
  border: "#1a1a2e", borderStrong: "#2b2b45",
  text: "#e8e4dc", textStrong: "#ffffff",
  sub: "#8b8bab",      // was #5a5a7a at 2.9:1 — now 5.8:1
  subDim: "#7d7d9e",   // 4.8:1 — floor, nothing dimmer ships
  accent: "#22c55e", accentSoft: "rgba(34,197,94,0.14)", accentInk: "#062e13", success: "#22c55e",
  attention: "#f0a500", attentionSoft: "rgba(240,165,0,0.16)", warn: "#f0a500", gold: "#f0a500",
  danger: "#ef4444", dangerSoft: "rgba(239,68,68,0.16)", dangerText: "#f87171",
  info: "#06b6d4", infoSoft: "rgba(6,182,212,0.16)", infoText: "#22d3ee",
  mutedSoft: "rgba(139,139,171,0.18)", mutedText: "#b9b9cf",
  purple: "#8b5cf6", sh: "rgba(0,0,0,0.6)",
};

export const LIGHT = {
  bg: "#f4f3ef", card: "#ffffff", input: "#ede9e3", nav: "#ffffff", pill: "#eeecea",
  border: "#e5e1d8", borderStrong: "#cfc9bd",
  text: "#1a1a2e", textStrong: "#08060d",
  sub: "#5f5d72", subDim: "#6e6c80",
  accent: "#15803d", accentSoft: "rgba(21,128,61,0.10)", accentInk: "#ffffff", success: "#15803d",
  attention: "#a16207", attentionSoft: "rgba(161,98,7,0.12)", warn: "#a16207", gold: "#a16207",
  danger: "#dc2626", dangerSoft: "rgba(220,38,38,0.10)", dangerText: "#b91c1c",
  info: "#0e7490", infoSoft: "rgba(14,116,144,0.10)", infoText: "#0e7490",
  mutedSoft: "rgba(95,93,114,0.10)", mutedText: "#4b4959",
  purple: "#7c3aed", sh: "rgba(0,0,0,0.06)",
};

export const PALETTE = ["#f0a500","#22c55e","#3b82f6","#ef4444","#a855f7","#06b6d4","#f97316","#ec4899","#84cc16","#14b8a6","#8b5cf6","#f43f5e","#0ea5e9","#10b981","#f59e0b"];

// Spacing — BOTH scales kept. Prefer the new numeric one going forward.
export const SPACE = { xs:4, sm:8, md:12, lg:16, xl:24, xxl:32, 1:4, 2:8, 3:12, 4:16, 6:24, 8:32, 10:40 };
export const RADIUS = { sm: 8, md: 12, lg: 14, pill: 999 };
export const TOUCH = { min: 48, icon: 48 };

// Typography — old keys kept; label/body use the NEW values on purpose (the actual fix).
export const TYPE = {
  micro:  { fontSize:9,  fontWeight:700 },
  strong: { fontSize:14, fontWeight:800 },
  h3:     { fontSize:16, fontWeight:900 },
  h2:     { fontSize:20, fontWeight:900 },
  h1:     { fontSize:26, fontWeight:900 },
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

// Arth theme tokens. Every screen reads colors through the `T` object
// (T = dark ? DARK : LIGHT), never hardcoded hex values directly, except
// for the small set of standalone screens that render before this theme
// system loads (PIN lock screen, error boundary) — those intentionally
// hardcode the same green/gray values independently.
export const DARK = { bg:"#08080f", card:"#0f0f1a", border:"#1a1a2e", text:"#e8e4dc", accent:"#22c55e", accentSoft:"rgba(34,197,94,0.12)", success:"#22c55e", danger:"#ef4444", input:"#0b0b18", nav:"#0a0a16", sub:"#5a5a7a", pill:"#14142a", sh:"rgba(0,0,0,0.6)", info:"#06b6d4", purple:"#8b5cf6", warn:"#f97316", gold:"#f0a500" };
export const LIGHT = { bg:"#f4f3ef", card:"#ffffff", border:"#e5e1d8", text:"#1a1a2e", accent:"#16a34a", accentSoft:"rgba(22,163,74,0.1)", success:"#16a34a", danger:"#dc2626", input:"#ede9e3", nav:"#ffffff", sub:"#7a7890", pill:"#eeecea", sh:"rgba(0,0,0,0.06)", info:"#0891b2", purple:"#7c3aed", warn:"#ea6c00", gold:"#d4920a" };

// General-purpose color picker options (person/group colors, category colors, etc.)
// — not theme-dependent, same 15 swatches in light or dark mode.
export const PALETTE = ["#f0a500","#22c55e","#3b82f6","#ef4444","#a855f7","#06b6d4","#f97316","#ec4899","#84cc16","#14b8a6","#8b5cf6","#f43f5e","#0ea5e9","#10b981","#f59e0b"];

// Spacing scale — new. Before this, every screen picked its own padding/gap values (8, 10, 12,
// 14, 16, 18, 20... no consistent step), which is exactly why cards, gaps between sections, and
// internal padding all feel slightly different from screen to screen even though nothing was
// "wrong" anywhere individually. Existing inline styles aren't retrofitted in this pass — that's
// a much larger, riskier sweep across the whole file — but every new component built from here
// should use these instead of a fresh guess.
export const SPACE = { xs:4, sm:8, md:12, lg:16, xl:24, xxl:32 };

// Typography scale — new, same reasoning as SPACE. Existing inline fontSize values aren't
// retrofitted; new components should use these.
export const TYPE = {
  micro:  { fontSize:9,  fontWeight:700 }, // badges, tiny labels
  label:  { fontSize:11, fontWeight:700 }, // field labels, section headers
  body:   { fontSize:13, fontWeight:600 }, // default body text
  strong: { fontSize:14, fontWeight:800 }, // emphasized body, card titles
  h3:     { fontSize:16, fontWeight:900 }, // sheet/modal titles
  h2:     { fontSize:20, fontWeight:900 }, // section headers
  h1:     { fontSize:26, fontWeight:900 }, // screen-level headers, big numbers
};

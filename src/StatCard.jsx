import React from "react";
import { SPACE, TYPE } from "../constants/theme";

// Replaces the "icon/value/label in a small bordered box" pattern hand-built at least 4 separate
// times (Financial Health breakdown, Bills Home Quick Summary, Connection Dashboard Analytics,
// Home Stats grid) - each with slightly different font sizes and spacing. `valueSize` covers the
// range those originals used (14-18px) rather than forcing one size that doesn't fit every use.
// Now built from the shared spacing/typography scale (theme.js) instead of one-off numbers.
export default function StatCard({ icon, value, label, color, T, valueSize = TYPE.h3.fontSize }) {
  return (
    <div style={{ background: T.input, borderRadius: 12, padding: `${SPACE.sm+2}px ${SPACE.sm}px`, textAlign: "center" }}>
      {icon && <div style={{ fontSize: 16, marginBottom: SPACE.xs }}>{icon}</div>}
      <div style={{ color: color || T.text, fontSize: valueSize, fontWeight: 900 }}>{value}</div>
      <div style={{ color: T.sub, ...TYPE.micro, marginTop: SPACE.xs/2 }}>{label}</div>
    </div>
  );
}

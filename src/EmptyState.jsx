import React from "react";
import { SPACE, TYPE } from "../constants/theme";

// Replaces 6 independent hand-written empty states found in the audit (Timeline, Goals,
// Events list, Recent Activity, People, Bills) - each with slightly different padding, icon
// sizing, and wording conventions. `action` accepts any element (usually a button), so callers
// keep full control over what the CTA does without EmptyState needing to know about app state.
// Now built from the shared spacing/typography scale (theme.js) instead of one-off numbers.
export default function EmptyState({ icon, title, subtitle, action, T }) {
  return (
    <div style={{ textAlign: "center", padding: `${SPACE.xl+16}px ${SPACE.lg}px` }}>
      {icon && <div style={{ fontSize: 44, marginBottom: SPACE.md }}>{icon}</div>}
      {title && <div style={{ color: T.text, ...TYPE.strong, fontSize: 15, marginBottom: subtitle ? SPACE.xs+2 : 0 }}>{title}</div>}
      {subtitle && <div style={{ color: T.sub, ...TYPE.body, fontSize: 12, marginBottom: action ? SPACE.lg+2 : 0 }}>{subtitle}</div>}
      {action}
    </div>
  );
}

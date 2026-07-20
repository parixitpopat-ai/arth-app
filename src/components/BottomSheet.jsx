import React from "react";

export default function BottomSheet({
  onClose,
  children,
  T,
  maxWidth = 430,
  maxHeight = "85vh",
  zIndex = 300,
  padding = "20px 16px 40px",
}) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        style={{
          background: T.card, borderRadius: "22px 22px 0 0", padding,
          width: "100%", maxWidth, maxHeight, overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from "react";

export default function TextEditorOverlay({ open, value, onChange, onClose, nodeAbsRect }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => ref.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  if (!open || !nodeAbsRect) return null;

  const { left, top, width, height } = nodeAbsRect;

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onClose}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onClose();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
      style={{
        position: "absolute",
        left,
        top,
        width: Math.max(120, width),
        height: Math.max(34, height),
        padding: "8px 10px",
        borderRadius: 10,
        border: "2px solid rgba(91,124,255,0.9)",
        outline: "none",
        fontSize: 16,
        lineHeight: 1.2,
        resize: "none",
        background: "rgba(255,255,255,0.95)",
        boxShadow: "0 12px 25px rgba(0,0,0,0.15)",
        zIndex: 50,
      }}
    />
  );
}

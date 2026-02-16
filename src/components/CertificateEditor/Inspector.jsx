import React from "react";
import { niceFieldLabel } from "../../lib/constants";

export default function Inspector({
  selectedField,
  updateField,
  fontOptions,
  stageRef,
  ensureFontLoaded,
  CW,
}) {
  if (!selectedField) {
    return (
      <div className="inspector-panel">
        <h3 className="panel-title">Inspector</h3>
        <div className="empty-inspector">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4"/>
            <circle cx="24" cy="24" r="3" fill="currentColor"/>
          </svg>
          <p>Select a field on the canvas to edit its style</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inspector-panel active">
      <h3 className="panel-title">Inspector</h3>
      
      <div className="inspector-badge">
        {niceFieldLabel(selectedField.id)}
      </div>

      <div className="form-group">
        <label className="form-label">Text Content</label>
        <textarea
          className="form-textarea"
          rows="2"
          value={selectedField.text}
          onChange={(e) => updateField(selectedField.id, { text: e.target.value })}
        />
        <p className="form-hint">💡 Double-click field on canvas for faster editing</p>
      </div>

      <div className="form-group">
        <label className="form-label">Font Family</label>
        <select
          className="form-select"
          value={selectedField.fontFamily}
          onChange={async (e) => {
            const next = e.target.value;
            updateField(selectedField.id, { fontFamily: next });

            const isBold = (selectedField.fontStyle || "").includes("bold");
            ensureFontLoaded(next, isBold ? 700 : 400).then(() => {
              stageRef.current?.getLayers()?.forEach((l) => l.batchDraw());
            });
          }}
        >
          {fontOptions.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Font Style</label>
          <select
            className="form-select"
            value={selectedField.fontStyle}
            onChange={(e) => updateField(selectedField.id, { fontStyle: e.target.value })}
          >
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
            <option value="italic">Italic</option>
            <option value="bold italic">Bold Italic</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Text Color</label>
          <input
            type="color"
            className="form-color"
            value={selectedField.fill}
            onChange={(e) => updateField(selectedField.id, { fill: e.target.value })}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Text Alignment</label>
        <div className="alignment-buttons">
          <button
            className={`alignment-btn ${selectedField.align === "left" ? "active" : ""}`}
            onClick={() => updateField(selectedField.id, { align: "left" })}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3h12M2 6h8M2 9h10M2 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className={`alignment-btn ${selectedField.align === "center" ? "active" : ""}`}
            onClick={() => updateField(selectedField.id, { align: "center" })}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3h12M4 6h8M3 9h10M5 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className={`alignment-btn ${selectedField.align === "right" ? "active" : ""}`}
            onClick={() => updateField(selectedField.id, { align: "right" })}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3h12M6 6h8M4 9h10M8 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">
          Font Size
          <span className="form-label-value">{selectedField.fontSize}px</span>
        </label>
        <input
          type="range"
          className="form-range"
          min="10"
          max="120"
          value={selectedField.fontSize}
          onChange={(e) => updateField(selectedField.id, { fontSize: Number(e.target.value) })}
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          Text Width
          <span className="form-label-value">{Math.round(selectedField.width)}px</span>
        </label>
        <input
          type="range"
          className="form-range"
          min="120"
          max={Math.max(240, CW)}
          value={Math.round(selectedField.width)}
          onChange={(e) => updateField(selectedField.id, { width: Number(e.target.value) })}
        />
        <p className="form-hint">Controls text wrapping area</p>
      </div>

      <button
        className="btn-secondary full-width"
        onClick={() => {
          const defaults = {
            fontFamily: selectedField.id.includes("Title") || selectedField.id === "name" 
              ? "Playfair Display" 
              : "Inter",
            fontStyle: ["certTitle", "name", "issuer"].includes(selectedField.id) ? "bold" : "normal",
            fill: ["award", "subtitle", "description", "date"].includes(selectedField.id)
              ? "#4a5568"
              : "#1a1a2e",
          };
          updateField(selectedField.id, defaults);
        }}
      >
        Reset to Default Style
      </button>
    </div>
  );
}

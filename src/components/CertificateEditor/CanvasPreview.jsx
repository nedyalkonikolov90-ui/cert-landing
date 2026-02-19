import React from "react";
import CertificateStage from "../CertificateStage";
import TextEditorOverlay from "../TextEditorOverlay";

export default function CanvasPreview({
  cw,
  ch,
  bg,
  fields,
  selectedId,
  setSelectedId,
  updateField,
  stageRef,
  transformerRef,
  openEditorFor,
  editingId,
  editorValue,
  setEditorValue,
  closeEditor,
  editorRect,
  paper,
}) {
  return (
    <div className="canvas-preview">
      <div className="canvas-header">
        <div className="canvas-title-section">
          <h3 className="canvas-title">Live Preview</h3>
          <p className="canvas-subtitle">
            Click to select • Drag to move • Resize handles • Double-click to edit
          </p>
        </div>
        <div className="canvas-badge">{paper}</div>
      </div>

      <div className="canvas-container">
        <CertificateStage
          cw={cw}
          ch={ch}
          bg={bg}
          fields={fields}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          updateField={updateField}
          stageRef={stageRef}
          transformerRef={transformerRef}
          openEditorFor={openEditorFor}
          paper={paper}
        />

        <TextEditorOverlay
          open={!!editingId}
          value={editorValue}
          onChange={setEditorValue}
          onClose={closeEditor}
          nodeAbsRect={editorRect}
        />
      </div>

      <div className="canvas-footer">
        <div className="canvas-hint">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 5v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Exports are pixel-perfect snapshots without editor handles
        </div>
      </div>
    </div>
  );
}

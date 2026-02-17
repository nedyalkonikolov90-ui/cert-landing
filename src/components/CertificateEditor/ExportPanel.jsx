import React from "react";

export default function ExportPanel({
  inputMode,
  manualRows,
  rows,
  busy,
  progress,
  handleExportPdf,
  handleExportZip,
}) {
  const validCount = inputMode === "manual"
    ? manualRows.filter(r => r.name?.trim() && r.award?.trim()).length
    : rows.length;

  const showProgress = busy && progress.total > 0;
  const pct = showProgress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="export-panel">
      <h3 className="panel-title">Export</h3>

      <div className="export-info">
        <div className="export-stat">
          <div className="export-stat-value">{validCount}</div>
          <div className="export-stat-label">Valid Recipients</div>
        </div>
        <div className="export-stat">
          <div className="export-stat-value">{validCount}</div>
          <div className="export-stat-label">Will Export</div>
        </div>
      </div>

      {validCount === 0 && (
        <div className="export-warning">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 5v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>Add at least one recipient to export</span>
        </div>
      )}

      {showProgress && (
        <div style={{ margin: "12px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.6)" }}>
            <span>Processing…</span>
            <span>{progress.done} / {progress.total}</span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 6, height: 6, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${pct}%`,
              background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
              borderRadius: 6,
              transition: "width 0.2s ease",
            }} />
          </div>
        </div>
      )}

      <div className="export-buttons">
        <button
          className="btn-primary"
          onClick={handleExportPdf}
          disabled={busy || validCount === 0}
        >
          {busy ? (
            <>
              <div className="spinner-small"></div>
              {showProgress ? `${pct}%` : "Generating…"}
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 9v6a1 1 0 001 1h10a1 1 0 001-1V9M12 5L9 2 6 5M9 2v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Export PDF
            </>
          )}
        </button>

        <button
          className="btn-secondary"
          onClick={handleExportZip}
          disabled={busy || validCount === 0}
        >
          {busy ? (
            <>
              <div className="spinner-small"></div>
              {showProgress ? `${pct}%` : "Generating…"}
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="3" y="3" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M9 6v6M6 9h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Export ZIP (PNG)
            </>
          )}
        </button>
      </div>

      <div className="export-notes">
        <p className="export-note">
          <strong>Print quality:</strong> Exports at ~288 DPI — suitable for professional printing. ~100 certificates takes roughly 60–90 seconds.
        </p>
      </div>
    </div>
  );
}

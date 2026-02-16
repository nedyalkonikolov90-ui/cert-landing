import React from "react";

export default function ExportPanel({
  inputMode,
  manualRows,
  rows,
  busy,
  handleExportPdf,
  handleExportZip,
}) {
  const validCount = inputMode === "manual"
    ? manualRows.filter(r => r.name?.trim() && r.award?.trim()).length
    : rows.length;

  return (
    <div className="export-panel">
      <h3 className="panel-title">Export</h3>

      <div className="export-info">
        <div className="export-stat">
          <div className="export-stat-value">{validCount}</div>
          <div className="export-stat-label">Valid Recipients</div>
        </div>
        <div className="export-stat">
          <div className="export-stat-value">5</div>
          <div className="export-stat-label">Preview Limit</div>
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

      <div className="export-buttons">
        <button
          className="btn-primary"
          onClick={handleExportPdf}
          disabled={busy || validCount === 0}
        >
          {busy ? (
            <>
              <div className="spinner-small"></div>
              Generating...
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
              Generating...
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
          <strong>Note:</strong> Exports generate up to 5 certificates for preview. For full batch exports, contact support.
        </p>
      </div>
    </div>
  );
}

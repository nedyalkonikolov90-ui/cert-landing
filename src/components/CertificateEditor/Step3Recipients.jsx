import React, { useRef } from "react";
import ManualInputTable from "./ManualInputTable";

export default function Step3Recipients({
  inputMode,
  setInputMode,
  manualRows,
  setManualRows,
  uploadFile,
  handleFileUpload,
  error,
  recipients,
  onBack,
}) {
  const dataInputRef = useRef(null);

  const onDropData = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileUpload(file);
  };

  const onDragOverData = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="step-panel">
      <div className="step-header">
        <div className="step-icon">👥</div>
        <h2 className="step-main-title">Add Recipients</h2>
        <p className="step-subtitle">
          Enter recipient names manually or upload a CSV file. Export options are on the right.
        </p>
      </div>

      <div className="step-body">
        <div className="control-section">
          <h3 className="section-title-step">Choose Input Method</h3>

          <div className="input-mode-tabs">
            <button
              className={`mode-tab-large ${inputMode === "manual" ? "active" : ""}`}
              onClick={() => setInputMode("manual")}
            >
              <div className="mode-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M4 7h16M4 12h16M4 17h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="mode-content">
                <div className="mode-title">Manual Entry</div>
                <div className="mode-desc">Type names directly</div>
              </div>
            </button>

            <button
              className={`mode-tab-large ${inputMode === "upload" ? "active" : ""}`}
              onClick={() => setInputMode("upload")}
            >
              <div className="mode-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 15V3M12 3L8 7M12 3l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="mode-content">
                <div className="mode-title">Upload CSV</div>
                <div className="mode-desc">Bulk import from file</div>
              </div>
            </button>
          </div>

          {inputMode === "manual" ? (
            <ManualInputTable manualRows={manualRows} setManualRows={setManualRows} />
          ) : (
            <div className="upload-area">
              <input
                ref={dataInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
                style={{ display: "none" }}
              />

              {!uploadFile ? (
                <button className="upload-zone" onClick={() => dataInputRef.current?.click()} onDrop={onDropData} onDragOver={onDragOverData}>
                  <div className="upload-icon-large">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <path d="M24 30V12M24 12L18 18M24 12l6 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M6 30v6a4 4 0 004 4h28a4 4 0 004-4v-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="upload-text-large">
                    <div className="upload-title-large">Click to upload CSV or TXT file</div>
                    <div className="upload-subtitle-large">
                      File should have columns: Name, Award, Date (optional), Issuer (optional)
                    </div>
                  </div>
                </button>
              ) : (
                <div className="file-uploaded">
                  <div className="file-icon">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                      <path d="M16 28a12 12 0 100-24 12 12 0 000 24z" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 16l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="file-details">
                    <div className="file-name">{uploadFile.name}</div>
                    <div className="file-size">{recipients.length} recipients found</div>
                  </div>
                  <button className="btn-secondary" onClick={() => dataInputRef.current?.click()}>
                    Change File
                  </button>
                </div>
              )}

              {error && (
                <div className="error-box">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 5v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {recipients.length > 0 && (
            <div className="status-ready">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Ready to export {recipients.length} certificate{recipients.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      <div className="step-footer">
        <button className="btn-secondary btn-large" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
      </div>
    </div>
  );
}

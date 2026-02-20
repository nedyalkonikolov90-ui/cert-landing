import React, { useRef } from "react";
import ManualInputTable from "./ManualInputTable";
import ExportPanel from "./ExportPanel";

export default function Step3Recipients({
  inputMode,
  setInputMode,
  manualRows,
  setManualRows,
  uploadFile,
  handleFileUpload,
  error,
  recipients,
  handleExportPdf,
  handleExportZip,
  exportLoading,
  progress,
  onBack,
}) {
  const dataInputRef = useRef(null);

  return (
    <div className="step-panel step-panel-compact">
      <div className="step-header-compact">
        <div className="step-header-row">
          <div className="step-title-compact">
            <div className="step-icon-small">👥</div>
            <div>
              <h2 className="step-main-title-compact">Add Recipients</h2>
              <p className="step-subtitle-compact">Enter names and export certificates</p>
            </div>
          </div>
          <div className="step-actions-inline">
            <button className="btn-secondary" onClick={onBack}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
            {recipients.length > 0 && (
              <div className="status-ready-inline">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M6 8l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {recipients.length} ready
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="step-body-scroll">
        <div className="step-layout-split">
          <div className="step-col-left">
            <div className="control-section-compact">
              <h3 className="section-title-compact">Add Recipients</h3>

              <div className="input-mode-tabs-compact">
                <button
                  className={`mode-tab-compact ${inputMode === "manual" ? "active" : ""}`}
                  onClick={() => setInputMode("manual")}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Manual Entry
                </button>
                <button
                  className={`mode-tab-compact ${inputMode === "upload" ? "active" : ""}`}
                  onClick={() => setInputMode("upload")}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 10V2M8 2L6 4M8 2l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Upload CSV
                </button>
              </div>

              {inputMode === "manual" ? (
                <ManualInputTable manualRows={manualRows} setManualRows={setManualRows} />
              ) : (
                <div className="upload-area-compact">
                  <input
                    ref={dataInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={(e) => handleFileUpload(e.target.files?.[0])}
                    style={{ display: "none" }}
                  />

                  {!uploadFile ? (
                    <button className="upload-zone-compact" onClick={() => dataInputRef.current?.click()}>
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <path d="M16 20V8M16 8L12 12M16 8l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M4 20v4a2 2 0 002 2h20a2 2 0 002-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <div className="upload-text-compact">
                        <div className="upload-title-compact">Click to upload CSV/TXT</div>
                        <div className="upload-subtitle-compact">Name, Award, Date, Issuer</div>
                      </div>
                    </button>
                  ) : (
                    <div className="file-uploaded-compact">
                      <div className="file-icon-compact">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <path d="M12 20a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="2"/>
                          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className="file-details-compact">
                        <div className="file-name-compact">{uploadFile.name}</div>
                        <div className="file-size-compact">{recipients.length} recipients</div>
                      </div>
                      <button className="btn-secondary btn-small" onClick={() => dataInputRef.current?.click()}>
                        Change
                      </button>
                    </div>
                  )}

                  {error && (
                    <div className="error-box-compact">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M8 5v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="step-col-right">
            <div className="control-section-compact">
              <h3 className="section-title-compact">Export Certificates</h3>
              <p className="section-desc-compact">Download as PDF or PNG files</p>

              <ExportPanel
                recipients={recipients}
                onExportPdf={handleExportPdf}
                onExportZip={handleExportZip}
                exportLoading={exportLoading}
                progress={progress}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useRef } from "react";
import ManualInputTable from "./ManualInputTable";

export default function ControlPanel({
  paper,
  setPaper,
  templates,
  onAddCustomTemplate,
  templateKey,
  setTemplateKey,
  inputMode,
  setInputMode,
  manualRows,
  setManualRows,
  uploadFile,
  handleFileUpload,
  certTitle,
  setCertTitle,
  subtitle,
  setSubtitle,
  description,
  setDescription,
  dateText,
  setDateText,
  issuerText,
  setIssuerText,
  error,
}) {
  const templateInputRef = useRef(null);
  const dataInputRef = useRef(null);

  return (
    <div className="control-panel">
      <div className="panel-section">
        <h3 className="section-title">Configuration</h3>

        <div className="form-group">
          <label className="form-label">Paper Size</label>
          <select
            className="form-select"
            value={paper}
            onChange={(e) => setPaper(e.target.value)}
          >
            <option value="A4">A4 (210 × 297 mm)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Template</label>

          {/* One upload button at top */}
          <div className="template-upload-top">
            <button
              type="button"
              className="btn-secondary full-width"
              onClick={() => templateInputRef.current?.click()}
            >
              + Upload Template
            </button>

            <input
              ref={templateInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                try {
                  if (!onAddCustomTemplate) {
                    throw new Error("Custom template upload is not enabled.");
                  }
                  const newTemplate = await onAddCustomTemplate(file);
                  if (newTemplate?.key) setTemplateKey(newTemplate.key);
                } catch (err) {
                  alert(err?.message || "Failed to upload template");
                } finally {
                  e.target.value = ""; // allow re-uploading same file
                }
              }}
            />
          </div>

          {/* Thumbnails only */}
          <div className="template-gallery thumbs-only">
            {templates.length === 0 ? (
              <div className="empty-state-mini">No templates available</div>
            ) : (
              templates.map((t) => {
                const imgSrc = t.thumbUrl || t.thumbnailUrl || t.previewUrl || t.url;
                const active = templateKey === t.key;

                return (
                  <button
                    key={t.key}
                    type="button"
                    className={`template-thumb-btn ${active ? "active" : ""}`}
                    onClick={() => setTemplateKey(t.key)}
                    title={t.label || "Template"}
                    aria-label={t.label || "Template"}
                  >
                    {imgSrc ? <img src={imgSrc} alt="" loading="lazy" /> : null}
                  </button>
                );
              })
            )}
          </div>

          <div className="form-hint">
            Click a thumbnail to select a template.
          </div>
        </div>
      </div>

      <div className="panel-divider"></div>

      <div className="panel-section">
        <h3 className="section-title">Recipients</h3>

        <div className="mode-tabs">
          <button
            className={`mode-tab ${inputMode === "manual" ? "active" : ""}`}
            onClick={() => setInputMode("manual")}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 4h12M2 8h12M2 12h12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Manual Entry
          </button>
          <button
            className={`mode-tab ${inputMode === "upload" ? "active" : ""}`}
            onClick={() => setInputMode("upload")}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 10V2M8 2L5 5M8 2l3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 14h12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Upload File
          </button>
        </div>

        {inputMode === "manual" ? (
          <ManualInputTable manualRows={manualRows} setManualRows={setManualRows} />
        ) : (
          <div className="upload-section">
            <input
              ref={dataInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
              style={{ display: "none" }}
            />
            <button
              className="upload-button"
              onClick={() => dataInputRef.current?.click()}
              type="button"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 15V3M12 3L8 7M12 3l4 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              {uploadFile ? "Change File" : "Choose CSV or TXT"}
            </button>

            {uploadFile && (
              <div className="file-info">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 14A6 6 0 108 2a6 6 0 000 12z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M8 11.5V8M8 5v.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <span>{uploadFile.name}</span>
              </div>
            )}

            <p className="upload-hint">
              CSV or TXT with columns: Name, Award, Date (optional), Issuer (optional)
            </p>
          </div>
        )}
      </div>

      <div className="panel-divider"></div>

      <div className="panel-section">
        <h3 className="section-title">Certificate Content</h3>

        <div className="form-group">
          <label className="form-label">Title</label>
          <input
            className="form-input"
            value={certTitle}
            onChange={(e) => setCertTitle(e.target.value)}
            placeholder="Certificate of Achievement"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Subtitle (optional)</label>
          <input
            className="form-input"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Below title..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description (optional)</label>
          <input
            className="form-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Below name..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Date</label>
          <input
            type="date"
            className="form-input"
            value={dateText}
            onChange={(e) => setDateText(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Issuer</label>
          <input
            className="form-input"
            value={issuerText}
            onChange={(e) => setIssuerText(e.target.value)}
            placeholder="Organization name"
          />
        </div>

        {error && (
          <div className="error-message">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M8 5v3M8 11h.01"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

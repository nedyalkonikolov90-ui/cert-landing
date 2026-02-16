import React, { useRef } from "react";
import ManualInputTable from "./ManualInputTable";

function TemplateGallery({ templates, templateKey, setTemplateKey }) {
  return (
    <div className="template-gallery" role="radiogroup" aria-label="Certificate templates">
      <div className="template-grid">
        {templates.map((t) => {
          const active = t.key === templateKey;
          const thumbSrc = t.thumbUrl || t.thumbnailUrl || t.previewUrl || t.url;

          return (
            <button
              key={t.key}
              type="button"
              className={`template-card ${active ? "active" : ""}`}
              onClick={() => setTemplateKey(t.key)}
              role="radio"
              aria-checked={active}
              title={t.label}
            >
              <div className="template-thumb">
                {thumbSrc ? (
                  <img
                    src={thumbSrc}
                    alt={t.label}
                    loading="lazy"
                    onError={(e) => {
                      // Prevent broken-image icon while keeping the card usable.
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="template-thumb-fallback">No preview</div>
                )}
              </div>
              <div className="template-label">{t.label}</div>
            </button>
          );
        })}
      </div>

      {templateKey ? (
        <div className="template-selected-hint">
          Selected: <span className="template-selected-value">{templates.find((t) => t.key === templateKey)?.label}</span>
        </div>
      ) : (
        <div className="template-selected-hint">Click a template thumbnail to select it.</div>
      )}
    </div>
  );
}

export default function ControlPanel({
  paper,
  setPaper,
  templates,
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
  const fileInputRef = useRef(null);

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
          {templates.length === 0 ? (
            <div className="empty-state-mini">No templates available</div>
          ) : (
            <TemplateGallery
              templates={templates}
              templateKey={templateKey}
              setTemplateKey={setTemplateKey}
            />
          )}
        </div>
      </div>

      <div className="panel-divider"></div>

      <div className="panel-section">
        <h3 className="section-title">Recipients</h3>
        
        <div className="mode-tabs">
          <button
            className={`mode-tab ${inputMode === "manual" ? "active" : ""}`}
            onClick={() => setInputMode("manual")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Manual Entry
          </button>
          <button
            className={`mode-tab ${inputMode === "upload" ? "active" : ""}`}
            onClick={() => setInputMode("upload")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 10V2M8 2L5 5M8 2l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 14h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Upload File
          </button>
        </div>

        {inputMode === "manual" ? (
          <ManualInputTable 
            manualRows={manualRows} 
            setManualRows={setManualRows} 
          />
        ) : (
          <div className="upload-section">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
              style={{ display: "none" }}
            />
            <button
              className="upload-button"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 15V3M12 3L8 7M12 3l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {uploadFile ? "Change File" : "Choose CSV or TXT"}
            </button>
            {uploadFile && (
              <div className="file-info">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 14A6 6 0 108 2a6 6 0 000 12z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 11.5V8M8 5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

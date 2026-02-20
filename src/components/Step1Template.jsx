import React, { useRef } from "react";

export default function Step1Template({
  paper,
  setPaper,
  templates,
  templateKey,
  setTemplateKey,
  onAddCustomTemplate,
  onNext,
}) {
  const templateInputRef = useRef(null);

  const handleContinue = () => {
    if (templateKey) {
      onNext();
    }
  };

  return (
    <div className="step-panel">
      <div className="step-header">
        <div className="step-icon">🎨</div>
        <h2 className="step-main-title">Choose Your Template</h2>
        <p className="step-subtitle">
          Select a pre-designed template or upload your own custom certificate design
        </p>
      </div>

      <div className="step-body">
        {/* Paper Size */}
        <div className="control-group">
          <label className="control-label">
            <span className="label-text">Paper Size</span>
            <span className="label-hint">💡 Choose standard size or match your template</span>
          </label>
          <select className="form-select" value={paper} onChange={(e) => setPaper(e.target.value)}>
            <option value="A4">A4 Landscape (842 × 595 px)</option>
            <option value="LETTER">Letter Landscape (792 × 612 px)</option>
            <option value="CUSTOM">Custom Size (matches your template)</option>
          </select>
          {paper === "CUSTOM" && (
            <div className="hint-box">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>The canvas will automatically resize to match your uploaded template's dimensions</span>
            </div>
          )}
        </div>

        {/* Upload Button */}
        <div className="control-group">
          <button
            type="button"
            className="btn-upload-large"
            onClick={() => templateInputRef.current?.click()}
          >
            <div className="upload-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4v16M4 12h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="upload-text">
              <div className="upload-title">Upload Custom Template</div>
              <div className="upload-subtitle">PNG, JPG, or SVG • Landscape recommended</div>
            </div>
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
                const newTemplate = await onAddCustomTemplate(file);
                if (newTemplate?.key) setTemplateKey(newTemplate.key);
              } catch (err) {
                alert(err?.message || "Failed to upload template");
              } finally {
                e.target.value = "";
              }
            }}
          />
        </div>

        {/* Template Gallery */}
        <div className="control-group">
          <label className="control-label">
            <span className="label-text">Or Choose from Gallery</span>
            <span className="label-hint">Click to select a pre-designed template</span>
          </label>

          <div className="template-grid-step1">
            {templates.length === 0 ? (
              <div className="empty-templates">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  <rect
                    x="12"
                    y="12"
                    width="40"
                    height="40"
                    rx="4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="6 6"
                  />
                  <circle cx="32" cy="32" r="3" fill="currentColor" />
                </svg>
                <p>No templates available</p>
                <span>Upload a custom template to get started</span>
              </div>
            ) : (
              templates.map((t) => {
                const imgSrc = t.thumbUrl || t.thumbnailUrl || t.previewUrl || t.url;
                const active = templateKey === t.key;

                return (
                  <button
                    key={t.key}
                    type="button"
                    className={`template-card-large ${active ? "active" : ""}`}
                    onClick={() => setTemplateKey(t.key)}
                  >
                    <div className="template-preview">
                      {imgSrc && <img src={imgSrc} alt={t.label || "Template"} loading="lazy" />}
                    </div>
                    <div className="template-info">
                      <div className="template-label">{t.label || "Template"}</div>
                      {active && (
                        <div className="template-badge">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path
                              d="M13 4L6 11L3 8"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Selected
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="step-actions">
        <button
          className="btn-primary btn-large btn-next"
          onClick={handleContinue}
          disabled={!templateKey}
        >
          {templateKey ? (
            <>
              Continue to Customize
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M7 4l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </>
          ) : (
            "Select a Template First"
          )}
        </button>
      </div>
    </div>
  );
}

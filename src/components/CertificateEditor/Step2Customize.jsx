import React from "react";
import Inspector from "./Inspector";

export default function Step2Customize({
  selectedField,
  updateField,
  fontOptions,
  stageRef,
  ensureFontLoaded,
  CW,
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
  onNext,
  onBack,
}) {
  return (
    <div className="step-panel step-panel-compact">
      {/* Header with buttons */}
      <div className="step-header-compact">
        <div className="step-header-row">
          <div className="step-title-compact">
            <div className="step-icon-small">✨</div>
            <div>
              <h2 className="step-main-title-compact">Customize Style</h2>
              <p className="step-subtitle-compact">Edit fonts, colors & layout</p>
            </div>
          </div>
          <div className="step-actions-inline">
            <button className="btn-secondary" onClick={onBack}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
            <button className="btn-primary" onClick={onNext}>
              Continue
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Body with split layout */}
      <div className="step-body-scroll">
        <div className="step-layout-split">
          {/* Left Column - Global Content */}
          <div className="step-col-left">
            <div className="control-section-compact">
              <h3 className="section-title-compact">Certificate Content</h3>

              <div className="control-stack">
                <div className="control-group-compact">
                  <label className="control-label-compact">
                    <span className="label-text">Title</span>
                  </label>
                  <input
                    className="form-input"
                    value={certTitle}
                    onChange={(e) => setCertTitle(e.target.value)}
                    placeholder="Certificate of Achievement"
                  />
                </div>

                <div className="control-group-compact">
                  <label className="control-label-compact">
                    <span className="label-text">Subtitle</span>
                  </label>
                  <input
                    className="form-input"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="This certifies that"
                  />
                </div>

                <div className="control-group-compact">
                  <label className="control-label-compact">
                    <span className="label-text">Description</span>
                  </label>
                  <input
                    className="form-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="has successfully completed..."
                  />
                </div>

                <div className="control-group-compact">
                  <label className="control-label-compact">
                    <span className="label-text">Date</span>
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={dateText}
                    onChange={(e) => setDateText(e.target.value)}
                  />
                </div>

                <div className="control-group-compact">
                  <label className="control-label-compact">
                    <span className="label-text">Issuer</span>
                  </label>
                  <input
                    className="form-input"
                    value={issuerText}
                    onChange={(e) => setIssuerText(e.target.value)}
                    placeholder="Organization name"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Inspector */}
          <div className="step-col-right">
            <div className="control-section-compact">
              <h3 className="section-title-compact">Style Individual Fields</h3>
              <p className="section-desc-compact">Click text on preview to customize</p>

              <Inspector
                selectedField={selectedField}
                updateField={updateField}
                fontOptions={fontOptions}
                stageRef={stageRef}
                ensureFontLoaded={ensureFontLoaded}
                CW={CW}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
  selectedField,
  updateField,
  fontOptions,
  stageRef,
  ensureFontLoaded,
  CW,
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
  onNext,
  onBack,
}) {
  return (
    <div className="step-panel">
      <div className="step-header">
        <div className="step-icon">✨</div>
        <h2 className="step-main-title">Customize Your Certificate</h2>
        <p className="step-subtitle">
          Edit text content, adjust fonts, colors, and positioning. Click any text field on the preview to customize it.
        </p>
      </div>

      <div className="step-body step-customize">
        {/* Global Text Content */}
        <div className="control-section">
          <h3 className="section-title-step">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 6h12M4 10h12M4 14h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Certificate Content
          </h3>
          <p className="section-desc">Set the text that appears on all certificates</p>

          <div className="control-grid">
            <div className="control-group">
              <label className="control-label">
                <span className="label-text">Title</span>
                <span className="label-hint">Main heading (e.g., "Certificate of Achievement")</span>
              </label>
              <input
                className="form-input"
                value={certTitle}
                onChange={(e) => setCertTitle(e.target.value)}
                placeholder="Certificate of Achievement"
              />
            </div>

            <div className="control-group">
              <label className="control-label">
                <span className="label-text">Subtitle</span>
                <span className="label-hint">Text below title (e.g., "This certifies that")</span>
              </label>
              <input
                className="form-input"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="This certifies that"
              />
            </div>

            <div className="control-group">
              <label className="control-label">
                <span className="label-text">Description</span>
                <span className="label-hint">Text below recipient name</span>
              </label>
              <input
                className="form-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="has successfully completed..."
              />
            </div>

            <div className="control-group">
              <label className="control-label">
                <span className="label-text">Date</span>
                <span className="label-hint">Issue date</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={dateText}
                onChange={(e) => setDateText(e.target.value)}
              />
            </div>

            <div className="control-group">
              <label className="control-label">
                <span className="label-text">Issuer</span>
                <span className="label-hint">Organization name</span>
              </label>
              <input
                className="form-input"
                value={issuerText}
                onChange={(e) => setIssuerText(e.target.value)}
                placeholder="Organization name"
              />
            </div>
          </div>
        </div>

        {/* Field Inspector */}
        <div className="control-section">
          <h3 className="section-title-step">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 4h12v12H4V4z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M7 7h6M7 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Style Individual Fields
          </h3>
          <p className="section-desc">Click a text field on the preview to adjust its font, size, and color</p>

          <div className="hint-box hint-interactive">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 6v4M10 13h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div>
              <strong>Tip:</strong> Click any text on the certificate preview to select it. Then use the controls below to change font, size, color, and position. You can also drag text fields directly on the preview.
            </div>
          </div>

          <Inspector
            selectedField={selectedField}
            updateField={updateField}
            fontOptions={fontOptions}
            stageRef={stageRef}
            ensureFontLoaded={ensureFontLoaded}
            CW={CW}
          />
        </div>
      </div>

      <div className="step-actions">
        <button className="btn-secondary btn-large" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M13 4l-6 6 6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Template
        </button>
        <button className="btn-primary btn-large btn-next" onClick={onNext}>
          Continue to Recipients
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M7 4l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

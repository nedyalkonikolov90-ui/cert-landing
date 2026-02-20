import React from "react";

export default function Step2Customize({
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
        <h2 className="step-main-title">Customize Certificate</h2>
        <p className="step-subtitle">
          Edit the text that appears on all certificates. Click text on the preview to style individual fields.
        </p>
      </div>

      <div className="step-body">
        <div className="control-section">
          <h3 className="section-title-step">Certificate Content</h3>

          <div className="control-group">
            <label className="control-label">
              <span className="label-text">Title</span>
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

      <div className="step-footer">
        <button className="btn-secondary btn-large" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <button className="btn-primary btn-large btn-next" onClick={onNext}>
          Continue to Recipients
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

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

      <div className="step-body-scroll">
        <div className="step-layout-split">
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

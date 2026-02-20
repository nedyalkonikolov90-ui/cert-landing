import React from "react";

export default function StepWizard({ currentStep, setCurrentStep, completedSteps, variant = "default" }) {
  const steps = [
    { id: 1, title: "Choose Template", desc: "Select your certificate design" },
    { id: 2, title: "Customize Style", desc: "Adjust fonts, colors & layout" },
    { id: 3, title: "Add Recipients", desc: "Enter names and export" },
  ];

  const isTop = variant === "top";

  const canGoTo = (stepId) => {
    // Always allow going backwards or to the current step.
    if (stepId <= currentStep) return true;

    // Allow going forward only if the step is already completed
    // (or if it's the immediate next step AND the previous step is completed).
    if (completedSteps.includes(stepId)) return true;
    if (stepId === currentStep + 1 && completedSteps.includes(currentStep)) return true;

    return false;
  };

  return (
    <div className={`step-wizard ${isTop ? "step-wizard-fixed" : ""}`}>
      <div className={`step-wizard-inner ${isTop ? "step-wizard-inner-topbar" : ""}`}>
        {isTop && (
          <div className="topbar-left">
            <a className="topbar-brand" href="/" aria-label="Certifyly home">
              <span className="topbar-logo" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M10 16L14 20L22 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="topbar-text">
                <span className="topbar-title">Certifyly</span>
                <span className="topbar-subtitle">Certificate Generator</span>
              </span>
            </a>
          </div>
        )}

        <div className={`step-wizard-steps ${isTop ? "step-wizard-steps-top" : ""}`}>
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <button
                type="button"
                className={`step-item ${currentStep === step.id ? "active" : ""} ${
                  completedSteps.includes(step.id) ? "completed" : ""
                }`}
                onClick={() => {
                  if (canGoTo(step.id)) setCurrentStep(step.id);
                }}
                disabled={!canGoTo(step.id)}
              >
                <div className="step-number">
                  {completedSteps.includes(step.id) && currentStep !== step.id ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M13 4L6 11L3 8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    step.id
                  )}
                </div>
                <div className="step-content">
                  <div className="step-title">{step.title}</div>
                  {!isTop && <div className="step-desc">{step.desc}</div>}
                </div>
              </button>

              {index < steps.length - 1 && (
                <div className={`step-connector ${completedSteps.includes(step.id) ? "completed" : ""}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {isTop && (
          <div className="topbar-right">
            <a className="topbar-back" href="https://budgetwonders.eu" rel="noreferrer">
              ← Back to BudgetWonders
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

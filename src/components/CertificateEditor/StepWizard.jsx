import React from "react";

export default function StepWizard({ currentStep, setCurrentStep, completedSteps }) {
  const steps = [
    { id: 1, title: "Choose Template", desc: "Select your certificate design" },
    { id: 2, title: "Customize Style", desc: "Adjust fonts, colors & layout" },
    { id: 3, title: "Add Recipients", desc: "Enter names and export" },
  ];

  return (
    <div className="step-wizard">
      <div className="step-wizard-inner">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <button
              className={`step-item ${currentStep === step.id ? "active" : ""} ${
                completedSteps.includes(step.id) ? "completed" : ""
              }`}
              onClick={() => {
                if (completedSteps.includes(step.id) || step.id <= currentStep) {
                  setCurrentStep(step.id);
                }
              }}
              disabled={!completedSteps.includes(step.id) && step.id > currentStep}
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
                <div className="step-desc">{step.desc}</div>
              </div>
            </button>
            {index < steps.length - 1 && (
              <div
                className={`step-connector ${
                  completedSteps.includes(step.id) ? "completed" : ""
                }`}
              ></div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

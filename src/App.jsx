import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import HomePage from "./components/HomePage";
import CertificateEditor from "./components/CertificateEditor";

import {
  fetchTemplates,
  loadCustomTemplates,
  saveCustomTemplates,
  createCustomTemplateFromFile,
} from "./lib/templates";

import "./styles/modern.css";

function CertifylyApp() {
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState("");

  // Load templates on mount
  useEffect(() => {
    async function loadTemplates() {
      try {
        const data = await fetchTemplates();
        const custom = loadCustomTemplates();
        // Custom first so users see their uploads at the top
        setTemplates([...(custom || []), ...(data || [])]);
      } catch (err) {
        setTemplatesError(err?.message || "Failed to load templates");
      } finally {
        setTemplatesLoading(false);
      }
    }
    loadTemplates();
  }, []);

  // Add a user-uploaded template (stored locally in the browser)
  const handleAddCustomTemplate = async (file) => {
    const customTemplate = await createCustomTemplateFromFile(file);

    // Keep only custom templates in localStorage
    const currentCustom = loadCustomTemplates();
    const nextCustom = [customTemplate, ...(currentCustom || [])];
    saveCustomTemplates(nextCustom);

    // Update UI list (custom first)
    setTemplates((prev) => [customTemplate, ...(prev || [])]);
    return customTemplate;
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect
                  x="4"
                  y="4"
                  width="24"
                  height="24"
                  rx="4"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M10 16L14 20L22 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="logo-text">
              <h1>Certifyly</h1>
              <p>Professional Certificate Generator</p>
            </div>
          </div>

          {/* Optional “Back to Home” link */}
          <a className="header-link" href="/">
            ← BudgetWonders
          </a>
        </div>
      </div>

      <main className="app-main">
        {templatesLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading templates...</p>
          </div>
        ) : templatesError ? (
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <h3>Failed to Load Templates</h3>
            <p>{templatesError}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Retry
            </button>
          </div>
        ) : (
          <CertificateEditor
            templates={templates}
            onAddCustomTemplate={handleAddCustomTemplate}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/certifyly" element={<CertifylyApp />} />

      {/* optional: support old hash links */}
      <Route path="/#certifyly" element={<Navigate to="/certifyly" replace />} />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

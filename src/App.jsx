import React, { useEffect, useState } from "react";
import CertificateEditor from "./components/CertificateEditor";
import { fetchTemplates } from "./lib/templates";
import "./styles/modern.css";

export default function App() {
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState("");

  // Load templates on mount
  useEffect(() => {
    async function loadTemplates() {
      try {
        const data = await fetchTemplates();
        setTemplates(data);
      } catch (err) {
        setTemplatesError(err.message || "Failed to load templates");
      } finally {
        setTemplatesLoading(false);
      }
    }
    loadTemplates();
  }, []);

  return (
    <div className="app-container">
      <div className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="2"/>
                <path d="M10 16L14 20L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="logo-text">
              <h1>Certifyly</h1>
              <p>Professional Certificate Generator</p>
            </div>
          </div>
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
            <button onClick={() => window.location.reload()} className="btn-primary">
              Retry
            </button>
          </div>
        ) : (
          <CertificateEditor templates={templates} />
        )}
      </main>
    </div>
  );
}

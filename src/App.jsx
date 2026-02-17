import React, { useEffect, useMemo, useState } from "react";
import CertificateEditor from "./components/CertificateEditor";
import HomePage from "./components/HomePage";
import {
  fetchTemplates,
  loadCustomTemplates,
  saveCustomTemplates,
  createCustomTemplateFromFile,
} from "./lib/templates";
import "./styles/modern.css";

export default function App() {
  const [view, setView] = useState(() => (window.location.hash === "#certifyly" ? "certifyly" : "home"));

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState("");

  // Keep view in sync with URL hash (so sharing budgetwonders.eu#certifyly works)
  useEffect(() => {
    const onHashChange = () => setView(window.location.hash === "#certifyly" ? "certifyly" : "home");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Load templates on mount (used by Certifyly)
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

  const openCertifyly = () => {
    if (window.location.hash !== "#certifyly") window.location.hash = "#certifyly";
    setView("certifyly");
    // Ensure we land at the top of the app UI
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goHome = () => {
    if (window.location.hash) window.location.hash = "#";
    setView("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (view === "home") {
    return <HomePage onOpenCertifyly={openCertifyly} />;
  }

  // Certifyly app view
  return (
    <div className="app-container">
      <div className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <button className="bw-back" onClick={goHome} title="Back to BudgetWonders home" aria-label="Back to home">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Home</span>
            </button>

            <div className="logo-icon" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="2" />
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
              <p>Bulk certificates from a template + CSV</p>
            </div>
          </div>
        </div>
      </div>

      <main className="app-main">
        {templatesLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading templates…</p>
          </div>
        ) : templatesError ? (
          <div className="error-state">
            <p>{templatesError}</p>
          </div>
        ) : (
          <CertificateEditor templates={templates} onAddCustomTemplate={handleAddCustomTemplate} />
        )}
      </main>
    </div>
  );
}

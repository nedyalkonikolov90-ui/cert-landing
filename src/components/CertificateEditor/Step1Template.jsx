import React, { useMemo, useRef, useState } from "react";

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
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("All");

  const inferTags = (t) => {
    const label = String(t?.label || "").toLowerCase();
    const tags = new Set();
    if (t?.isCustom) tags.add("Custom");
    if (/(kid|child|children|дет|ученик)/.test(label)) tags.add("Kids");
    if (/(football|soccer|футбол)/.test(label)) tags.add("Football");
    if (/(ballet|dance|балет|танц)/.test(label)) tags.add("Ballet");
    if (/(classic|royal|gold|seal|traditional)/.test(label)) tags.add("Classic");
    if (/(modern|minimal|clean)/.test(label)) tags.add("Modern");
    return Array.from(tags);
  };

  const availableTags = useMemo(() => {
    const set = new Set(["All"]);
    (templates || []).forEach((t) => inferTags(t).forEach((x) => set.add(x)));
    return Array.from(set);
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (templates || []).filter((t) => {
      const label = String(t?.label || "").toLowerCase();
      const matchesQ = !q || label.includes(q) || String(t?.key || "").toLowerCase().includes(q);
      const tags = inferTags(t);
      const matchesTag = tag === "All" || tags.includes(tag);
      return matchesQ && matchesTag;
    });
  }, [templates, search, tag]);

  const handleContinue = () => {
    if (templateKey) {
      onNext();
    }
  };

  const handleTemplateFile = async (file) => {
    if (!file) return;
    try {
      const custom = await onAddCustomTemplate(file);
      if (custom?.key) setTemplateKey(custom.key);
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Failed to add template.");
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    handleTemplateFile(file);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div className="step-panel step-panel-template">
      <div className="step-header">
        <div className="step-icon">🎨</div>
        <h2 className="step-main-title">Choose Your Template</h2>
        <p className="step-subtitle">
          Select a pre-designed template or upload your own custom certificate design
        </p>
      </div>

      <div className="step-body">
        <div className="control-group">
          <label className="control-label">
            <span className="label-text">Paper Size</span>
            <span className="label-hint">Choose standard size or match your template</span>
          </label>
          <select className="form-select" value={paper} onChange={(e) => setPaper(e.target.value)}>
            <option value="A4">A4 Landscape (842 × 595 px)</option>
            <option value="LETTER">Letter Landscape (792 × 612 px)</option>
            <option value="CUSTOM">Custom Size (matches your template)</option>
          </select>
          {paper === "CUSTOM" && (
            <p className="form-hint">
              Canvas will automatically resize to match your uploaded template dimensions
            </p>
          )}
        </div>

        <div className="control-group">
          <label className="control-label">
            <span className="label-text">Select Template</span>
            <span className="label-hint">
              Click a template below or upload your own design (PNG, JPG, SVG)
            </span>
          </label>

          <button
            type="button"
            className="btn-secondary btn-upload-template"
            onClick={() => templateInputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={onDragOver}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 4v12M4 10h12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Upload or Drop Template
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
                if (!onAddCustomTemplate) {
                  throw new Error("Custom template upload is not enabled.");
                }
                const newTemplate = await onAddCustomTemplate(file);
                if (newTemplate?.key) setTemplateKey(newTemplate.key);
              } catch (err) {
                alert(err?.message || "Failed to upload template");
              } finally {
                e.target.value = "";
              }
            }}
          />

                  <div className="template-toolbar">
          <div className="template-search">
            <input
              className="bw-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              aria-label="Search templates"
            />
          </div>
          <div className="template-tags" role="tablist" aria-label="Template tags">
            {availableTags.map((t) => (
              <button
                key={t}
                type="button"
                className={`tag-chip ${tag === t ? "active" : ""}`}
                onClick={() => setTag(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

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
              filteredTemplates.map((t) => {
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

      <div className="step-footer step-footer-right">
        <button className="btn-primary btn-large" onClick={handleContinue} disabled={!templateKey}>
          {templateKey ? (
            <>
              Continue to Customize
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

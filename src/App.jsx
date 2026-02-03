import React, { useEffect, useMemo, useRef, useState } from "react";
import useImage from "use-image";
import JSZip from "jszip";

import CertificateStage from "./components/CertificateStage";
import TextEditorOverlay from "./components/TextEditorOverlay";

import { SIZES, MAX_PREVIEW, FONT_OPTIONS, niceFieldLabel, clamp } from "./lib/constants";
import { parseCsv, parseTxt } from "./lib/parsers";
import { ensureFontLink, fetchTemplates, ensureFontLoaded } from "./lib/templates";
import { exportPdfFromStage, exportZipPngFromStage } from "./lib/export";
import { styles } from "./styles/appStyles";

export default function App() {
  useEffect(() => ensureFontLink(), []);

  // Templates list
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState("");

  const [paper, setPaper] = useState("A4");
  const { w: CW, h: CH } = SIZES[paper];

  const [templateKey, setTemplateKey] = useState("");
  const selectedTemplate = useMemo(() => templates.find((t) => t.key === templateKey) || null, [templates, templateKey]);

  // Input mode
  const [inputMode, setInputMode] = useState("manual"); // manual | upload
  const [uploadFile, setUploadFile] = useState(null);
  const [rows, setRows] = useState([]);

  // ✅ Manual table rows
  const [manualRows, setManualRows] = useState([{ name: "Student Name", award: "For outstanding performance" }]);

  const [dateText, setDateText] = useState(new Date().toISOString().slice(0, 10));
  const [issuerText, setIssuerText] = useState("Issuer / Organization");

  // Texts
  const [certTitle, setCertTitle] = useState("Certificate of Achievement");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Konva refs
  const stageRef = useRef(null);
  const stageContainerRef = useRef(null);
  const transformerRef = useRef(null);

  const [selectedId, setSelectedId] = useState("");

  // ✅ Refs for “Enter-to-new-row” focus control
  const manualNameRefs = useRef([]);
  const manualAwardRefs = useRef([]);

  function addManualRow(focusIndex = null) {
    setManualRows((prev) => {
      const next = [...prev, { name: "", award: "" }];
      // Focus after render
      const idx = focusIndex ?? next.length - 1;
      setTimeout(() => manualNameRefs.current?.[idx]?.focus?.(), 0);
      return next;
    });
  }

  function updateManualRow(idx, patch) {
    setManualRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeManualRow(idx) {
    setManualRows((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== idx);
      // Keep refs aligned
      setTimeout(() => {
        const target = Math.min(idx, next.length - 1);
        manualNameRefs.current?.[target]?.focus?.();
      }, 0);
      return next;
    });
  }

  function parsePastedRows(text) {
    const lines = (text || "")
      .replace(/\r/g, "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const out = [];
    for (const line of lines) {
      // Excel / Sheets tab-separated
      if (line.includes("\t")) {
        const [name, award] = line.split("\t");
        out.push({ name: (name || "").trim(), award: (award || "").trim() });
        continue;
      }
      // CSV-ish
      if (line.includes(",")) {
        const [name, award] = line.split(",");
        out.push({ name: (name || "").trim(), award: (award || "").trim() });
        continue;
      }
      // "Name - Title"
      if (line.includes(" - ")) {
        const [name, ...rest] = line.split(" - ");
        out.push({ name: (name || "").trim(), award: rest.join(" - ").trim() });
        continue;
      }
    }
    return out.filter((r) => r.name || r.award);
  }

  function handleManualPaste(e) {
    const text = e.clipboardData?.getData("text/plain") || "";
    const parsed = parsePastedRows(text);
    if (!parsed.length) return;

    e.preventDefault();

    setManualRows((prev) => {
      // If first row is still default placeholder-ish, replace it
      const first = prev[0] || { name: "", award: "" };
      const firstLooksDefault =
        String(first.name || "").trim().toLowerCase() === "student name" ||
        String(first.award || "").trim().toLowerCase() === "for outstanding performance";

      const cleaned = parsed
        .map((r) => ({ name: (r.name || "").trim(), award: (r.award || "").trim() }))
        .filter((r) => r.name && r.award);

      if (!cleaned.length) return prev;

      const next = firstLooksDefault ? cleaned : [...prev, ...cleaned];

      // Focus the row after paste
      setTimeout(() => {
        const idx = next.length - cleaned.length; // first pasted row index
        manualNameRefs.current?.[idx]?.focus?.();
      }, 0);

      return next;
    });
  }

  // Fields
  const [fields, setFields] = useState(() => [
    { id: "certTitle", text: "Certificate of Achievement", x: CW / 2, y: 110, fontFamily: "Inter", fontSize: 44, fontStyle: "bold", fill: "#1e2233", align: "center", width: 760 },
    { id: "subtitle", text: "", x: CW / 2, y: 165, fontFamily: "Inter", fontSize: 18, fontStyle: "normal", fill: "#2b2f44", align: "center", width: 760 },
    { id: "name", text: "Student Name", x: CW / 2, y: 270, fontFamily: "Inter", fontSize: 38, fontStyle: "bold", fill: "#1e2233", align: "center", width: 760 },
    { id: "description", text: "", x: CW / 2, y: 322, fontFamily: "Inter", fontSize: 16, fontStyle: "normal", fill: "#2b2f44", align: "center", width: 760 },
    { id: "award", text: "For outstanding performance", x: CW / 2, y: 380, fontFamily: "Inter", fontSize: 20, fontStyle: "normal", fill: "#2b2f44", align: "center", width: 760 },
    { id: "date", text: `Date: ${new Date().toISOString().slice(0, 10)}`, x: 115, y: 560, fontFamily: "Inter", fontSize: 14, fontStyle: "normal", fill: "#2b2f44", align: "left", width: 260 },
    { id: "issuer", text: "Issuer / Organization", x: 680, y: 550, fontFamily: "Inter", fontSize: 16, fontStyle: "bold", fill: "#1e2233", align: "right", width: 300 },
  ]);

  function updateField(id, patch) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  // Sync free texts into fields
  useEffect(() => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id === "certTitle") return { ...f, text: certTitle };
        if (f.id === "subtitle") return { ...f, text: subtitle };
        if (f.id === "description") return { ...f, text: description };
        return f;
      })
    );
  }, [certTitle, subtitle, description]);

  // ✅ sampleRow: manual mode uses first valid row (table) for preview
  const sampleRow = useMemo(() => {
    if (inputMode === "manual") {
      const firstValid = manualRows.find((r) => (r.name || "").trim() && (r.award || "").trim());
      return firstValid
        ? { ...firstValid, date: dateText, issuer: issuerText }
        : { name: "Student Name", award: "For outstanding performance", date: dateText, issuer: issuerText };
    }
    return rows[0] || { name: "Student Name", award: "For outstanding performance", date: dateText, issuer: issuerText };
  }, [inputMode, manualRows, dateText, issuerText, rows]);

  // Sync row-based fields to canvas preview
  useEffect(() => {
    const effectiveDate = sampleRow.date || dateText;
    const effectiveIssuer = sampleRow.issuer || issuerText;

    setFields((prev) =>
      prev.map((f) => {
        if (f.id === "name") return { ...f, text: sampleRow.name || "" };
        if (f.id === "award") return { ...f, text: sampleRow.award || "" };
        if (f.id === "date") return { ...f, text: effectiveDate ? `Date: ${effectiveDate}` : "" };
        if (f.id === "issuer") return { ...f, text: effectiveIssuer || "" };
        return f;
      })
    );
  }, [sampleRow, issuerText, dateText]);

  // When paper changes, adjust stage + keep fields proportional-ish
  useEffect(() => {
    const { w, h } = SIZES[paper];
    setFields((prev) =>
      prev.map((f) => ({
        ...f,
        x: clamp((f.x / CW) * w, 0, w),
        y: clamp((f.y / CH) * h, 0, h),
        width: (f.width / CW) * w,
      }))
    );
    setSelectedId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper]);

  // Load templates
  useEffect(() => {
    let alive = true;
    (async () => {
      setTemplatesLoading(true);
      setTemplatesError("");
      try {
        const list = await fetchTemplates();
        if (!alive) return;
        setTemplates(list);
        if (list.length > 0) setTemplateKey(list[0].key);
      } catch (e) {
        if (!alive) return;
        setTemplatesError(String(e?.message || "Failed to load templates"));
      } finally {
        if (!alive) return;
        setTemplatesLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Background image
  const [bg] = useImage(selectedTemplate?.url || "", "anonymous");

  const selectedField = useMemo(() => fields.find((f) => f.id === selectedId) || null, [fields, selectedId]);

  // Inline editor overlay state
  const [editingId, setEditingId] = useState("");
  const [editorValue, setEditorValue] = useState("");
  const [editorRect, setEditorRect] = useState(null);

  function openEditorFor(id) {
    const stage = stageRef.current;
    const container = stageContainerRef.current;
    if (!stage || !container) return;

    const node = stage.findOne(`#${id}`);
    if (!node) return;

    const text = fields.find((f) => f.id === id)?.text ?? "";
    setEditingId(id);
    setEditorValue(text);

    const box = node.getClientRect({ relativeTo: stage });
    const canvasEl = container.querySelector("canvas");
    const canvasRect = canvasEl.getBoundingClientRect();

    const sx = canvasRect.width / CW;
    const sy = canvasRect.height / CH;

    setEditorRect({
      left: canvasRect.left + box.x * sx,
      top: canvasRect.top + box.y * sy,
      width: box.width * sx,
      height: box.height * sy,
    });
  }

  function closeEditor() {
    if (!editingId) return;

    updateField(editingId, { text: editorValue });

    if (editingId === "certTitle") setCertTitle(editorValue);
    if (editingId === "subtitle") setSubtitle(editorValue);
    if (editingId === "description") setDescription(editorValue);
    if (editingId === "issuer") setIssuerText(editorValue);
    if (editingId === "date") {
      const m = editorValue.match(/date:\s*(.*)$/i);
      if (m?.[1]) setDateText(m[1].trim());
    }

    // ✅ In manual mode, update the first valid row (or row 0) when editing on canvas
    if (inputMode === "manual") {
      const idx = manualRows.findIndex((r) => (r.name || "").trim() && (r.award || "").trim());
      const target = idx >= 0 ? idx : 0;
      if (editingId === "name") updateManualRow(target, { name: editorValue });
      if (editingId === "award") updateManualRow(target, { award: editorValue });
    }

    setEditingId("");
    setEditorRect(null);
  }

  async function handleUpload(file) {
    setUploadFile(file);
    setError("");
    const text = await file.text();

    let parsed;
    if (file.name.toLowerCase().endsWith(".csv")) parsed = parseCsv(text);
    else if (file.name.toLowerCase().endsWith(".txt")) parsed = parseTxt(text);
    else parsed = { error: "Upload a .csv or .txt file." };

    if (parsed.error) {
      setRows([]);
      setError(parsed.error);
    } else {
      setRows(parsed.rows);
    }
  }

  function effectiveRows() {
    if (inputMode === "manual") {
      return manualRows
        .map((r) => ({
          name: (r.name || "").trim(),
          award: (r.award || "").trim(),
          date: dateText,
          issuer: issuerText,
        }))
        .filter((r) => r.name && r.award);
    }
    return rows
      .map((r) => ({
        name: (r.name || "").trim(),
        award: (r.award || "").trim(),
        date: (r.date || dateText || "").trim(),
        issuer: (r.issuer || issuerText || "").trim(),
      }))
      .filter((r) => r.name && r.award);
  }

  async function exportPdfPreview() {
    setError("");
    if (!selectedTemplate) return setError("No template selected.");

    const list = effectiveRows();
    if (!list.length) return setError("Provide at least 1 recipient (manual or upload).");

    setBusy(true);
    try {
      await exportPdfFromStage({
        rows: list,
        cw: CW,
        ch: CH,
        stageRef,
        transformerRef,
        selectedId,
        setSelectedId,
        editingId,
        closeEditor,
        max: MAX_PREVIEW,
        beforeEachRow: async (r) => {
          const effectiveDate = r.date || dateText;
          const effectiveIssuer = r.issuer || issuerText;

          setFields((prev) =>
            prev.map((f) => {
              if (f.id === "name") return { ...f, text: r.name || "" };
              if (f.id === "award") return { ...f, text: r.award || "" };
              if (f.id === "date") return { ...f, text: effectiveDate ? `Date: ${effectiveDate}` : "" };
              if (f.id === "issuer") return { ...f, text: effectiveIssuer || "" };
              return f;
            })
          );
        },
        afterExportRestore: () => {
          const effectiveDate = sampleRow.date || dateText;
          const effectiveIssuer = sampleRow.issuer || issuerText;

          setFields((prev) =>
            prev.map((f) => {
              if (f.id === "name") return { ...f, text: sampleRow.name || "" };
              if (f.id === "award") return { ...f, text: sampleRow.award || "" };
              if (f.id === "date") return { ...f, text: effectiveDate ? `Date: ${effectiveDate}` : "" };
              if (f.id === "issuer") return { ...f, text: effectiveIssuer || "" };
              return f;
            })
          );
        },
      });
    } catch (e) {
      setError(String(e?.message || "Export failed"));
    } finally {
      setBusy(false);
    }
  }

  async function exportPngZipPreview() {
    setError("");
    if (!selectedTemplate) return setError("No template selected.");

    const list = effectiveRows();
    if (!list.length) return setError("Provide at least 1 recipient (manual or upload).");

    setBusy(true);
    try {
      const zip = new JSZip();
      await exportZipPngFromStage({
        rows: list,
        stageRef,
        transformerRef,
        selectedId,
        setSelectedId,
        editingId,
        closeEditor,
        zip,
        max: MAX_PREVIEW,
        beforeEachRow: async (r) => {
          const effectiveDate = r.date || dateText;
          const effectiveIssuer = r.issuer || issuerText;

          setFields((prev) =>
            prev.map((f) => {
              if (f.id === "name") return { ...f, text: r.name || "" };
              if (f.id === "award") return { ...f, text: r.award || "" };
              if (f.id === "date") return { ...f, text: effectiveDate ? `Date: ${effectiveDate}` : "" };
              if (f.id === "issuer") return { ...f, text: effectiveIssuer || "" };
              return f;
            })
          );
        },
        afterExportRestore: () => {
          const effectiveDate = sampleRow.date || dateText;
          const effectiveIssuer = sampleRow.issuer || issuerText;

          setFields((prev) =>
            prev.map((f) => {
              if (f.id === "name") return { ...f, text: sampleRow.name || "" };
              if (f.id === "award") return { ...f, text: sampleRow.award || "" };
              if (f.id === "date") return { ...f, text: effectiveDate ? `Date: ${effectiveDate}` : "" };
              if (f.id === "issuer") return { ...f, text: effectiveIssuer || "" };
              return f;
            })
          );
        },
      });
    } catch (e) {
      setError(String(e?.message || "Export failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.brand}>Certifyly</div>
          <div style={styles.subbrand}>Editor</div>
        </div>

        <div style={styles.headerActions}>
          <button onClick={exportPdfPreview} disabled={busy} style={busy ? styles.btnDisabled : styles.btnPrimary}>
            {busy ? "Exporting…" : `Export PDF (max ${MAX_PREVIEW})`}
          </button>
          <button onClick={exportPngZipPreview} disabled={busy} style={busy ? styles.btnDisabled : styles.btnGhost}>
            Export PNG ZIP
          </button>
        </div>
      </div>

      <div style={styles.grid}>
        {/* LEFT PANEL */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Inputs</div>

          <div style={styles.block}>
            <label style={styles.label}>Input mode</label>
            <select style={styles.select} value={inputMode} onChange={(e) => setInputMode(e.target.value)}>
              <option value="manual">Manual (table)</option>
              <option value="upload">Upload CSV/TXT (batch)</option>
            </select>
          </div>

          {inputMode === "manual" ? (
            <div style={styles.block} onPaste={handleManualPaste} title="Paste Name<TAB>Title from Excel here">
              <div style={styles.help}>
                Add recipients in a table. Tip: paste from Excel (2 columns). Press <b>Enter</b> in Title to add a new row.
              </div>

              <div
                style={{
                  marginTop: 10,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                  overflow: "hidden",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1.2fr 70px",
                    gap: 10,
                    padding: "10px 10px",
                    borderBottom: "1px solid rgba(255,255,255,0.10)",
                    fontSize: 12,
                    opacity: 0.9,
                    fontWeight: 800,
                  }}
                >
                  <div>Name</div>
                  <div>Title / Award</div>
                  <div style={{ textAlign: "right" }}>Remove</div>
                </div>

                {/* Rows */}
                <div style={{ maxHeight: 260, overflow: "auto" }}>
                  {manualRows.map((r, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1.2fr 70px",
                        gap: 10,
                        padding: "10px 10px",
                        borderBottom: idx === manualRows.length - 1 ? "none" : "1px solid rgba(255,255,255,0.08)",
                        alignItems: "center",
                      }}
                    >
                      <input
                        ref={(el) => (manualNameRefs.current[idx] = el)}
                        style={styles.input}
                        value={r.name}
                        placeholder={`Name #${idx + 1}`}
                        onChange={(e) => updateManualRow(idx, { name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            manualAwardRefs.current?.[idx]?.focus?.();
                          }
                        }}
                      />

                      <input
                        ref={(el) => (manualAwardRefs.current[idx] = el)}
                        style={styles.input}
                        value={r.award}
                        placeholder="Title / Award"
                        onChange={(e) => updateManualRow(idx, { award: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            // ✅ Enter-to-new-row: only if current row has some input
                            const hasSomething = (r.name || "").trim() || (r.award || "").trim();
                            if (hasSomething) {
                              addManualRow(); // focuses next row name automatically
                            } else {
                              // If empty, just move focus back to name
                              manualNameRefs.current?.[idx]?.focus?.();
                            }
                          }
                        }}
                      />

                      <button
                        style={{
                          ...styles.btnGhost,
                          padding: "10px 10px",
                          justifySelf: "end",
                          opacity: manualRows.length <= 1 ? 0.5 : 1,
                          cursor: manualRows.length <= 1 ? "not-allowed" : "pointer",
                        }}
                        disabled={manualRows.length <= 1}
                        onClick={() => removeManualRow(idx)}
                        title={manualRows.length <= 1 ? "Keep at least 1 row" : "Remove row"}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button style={styles.btnPrimary} onClick={() => addManualRow()}>
                  + Add row
                </button>
                <button style={styles.btnGhost} onClick={() => setManualRows([{ name: "", award: "" }])}>
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.block}>
              <label style={styles.label}>Upload .csv or .txt</label>
              <input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
              <div style={styles.help}>
                CSV headers: <code>name,title</code> (optional <code>date</code>, <code>issuer</code>) • TXT:{" "}
                <code>Name - Title</code>
              </div>
              {uploadFile && rows.length > 0 && (
                <div style={styles.help}>
                  <b>Rows:</b> {rows.length} (preview shows first)
                </div>
              )}
            </div>
          )}

          <div style={styles.hr} />

          <div style={styles.panelTitle}>Template</div>

          <div style={styles.block}>
            <label style={styles.label}>Paper size</label>
            <select style={styles.select} value={paper} onChange={(e) => setPaper(e.target.value)}>
              <option value="A4">A4 (landscape)</option>
              <option value="LETTER">US Letter (landscape)</option>
            </select>
          </div>

          <div style={styles.block}>
            <label style={styles.label}>Template</label>
            {templatesLoading ? (
              <div style={styles.help}>Loading templates…</div>
            ) : templatesError ? (
              <div style={{ ...styles.help, color: "#b42318" }}>{templatesError}</div>
            ) : templates.length === 0 ? (
              <div style={styles.help}>No templates found (R2: templates/templates/)</div>
            ) : (
              <select style={styles.select} value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={styles.hr} />

          <div style={styles.panelTitle}>Texts</div>

          <div style={styles.block}>
            <label style={styles.label}>Certificate Title</label>
            <input style={styles.input} value={certTitle} onChange={(e) => setCertTitle(e.target.value)} />
          </div>

          <div style={styles.block}>
            <label style={styles.label}>Free text (below title)</label>
            <input style={styles.input} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="(optional)" />
          </div>

          <div style={styles.block}>
            <label style={styles.label}>Free text (below name)</label>
            <input style={styles.input} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="(optional)" />
          </div>

          <div style={styles.block}>
            <label style={styles.label}>Date</label>
            <input style={styles.input} value={dateText} onChange={(e) => setDateText(e.target.value)} />
          </div>

          <div style={styles.block}>
            <label style={styles.label}>Issuer</label>
            <input style={styles.input} value={issuerText} onChange={(e) => setIssuerText(e.target.value)} />
          </div>

          {error && <div style={styles.error}>{error}</div>}
        </div>

        {/* CANVAS */}
        <div style={styles.canvasWrap}>
          <div style={styles.canvasCard}>
            <div style={styles.canvasTitleRow}>
              <div>
                <div style={styles.canvasTitle}>Live preview</div>
                <div style={styles.canvasHint}>Click to select • drag to move • resize handles • double-click to edit</div>
              </div>
              <div style={styles.badge}>{paper}</div>
            </div>

            <CertificateStage
              cw={CW}
              ch={CH}
              bg={bg}
              fields={fields}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              updateField={updateField}
              stageRef={stageRef}
              transformerRef={transformerRef}
              stageContainerRef={stageContainerRef}
              openEditorFor={openEditorFor}
            />

            <TextEditorOverlay open={!!editingId} value={editorValue} onChange={setEditorValue} onClose={closeEditor} nodeAbsRect={editorRect} />
          </div>
        </div>

        {/* INSPECTOR */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Inspector</div>

          {!selectedField ? (
            <div style={styles.help}>Select a field on the template to edit style.</div>
          ) : (
            <>
              <div style={styles.block}>
                <div style={styles.pill}>Selected: {niceFieldLabel(selectedField.id)}</div>
              </div>

              <div style={styles.block}>
                <label style={styles.label}>Text</label>
                <input style={styles.input} value={selectedField.text} onChange={(e) => updateField(selectedField.id, { text: e.target.value })} />
                <div style={styles.help}>Tip: double-click on canvas to edit faster.</div>
              </div>

              <div style={styles.block}>
                <label style={styles.label}>Font</label>
                <select
                  style={styles.select}
                  value={selectedField.fontFamily}
                  onChange={async (e) => {
                    const next = e.target.value;
                    updateField(selectedField.id, { fontFamily: next });

                    const isBold = (selectedField.fontStyle || "").includes("bold");
                    await ensureFontLoaded(next, isBold ? 700 : 400);
                    stageRef.current?.getLayers()?.forEach((l) => l.batchDraw());
                  }}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.row2}>
                <div style={styles.block}>
                  <label style={styles.label}>Style</label>
                  <select style={styles.select} value={selectedField.fontStyle} onChange={(e) => updateField(selectedField.id, { fontStyle: e.target.value })}>
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                    <option value="italic">Italic</option>
                    <option value="bold italic">Bold Italic</option>
                  </select>
                </div>

                <div style={styles.block}>
                  <label style={styles.label}>Color</label>
                  <input
                    type="color"
                    value={selectedField.fill}
                    onChange={(e) => updateField(selectedField.id, { fill: e.target.value })}
                    style={{ height: 42, borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", width: "100%" }}
                  />
                </div>
              </div>

              <div style={styles.block}>
                <label style={styles.label}>Alignment</label>
                <select style={styles.select} value={selectedField.align} onChange={(e) => updateField(selectedField.id, { align: e.target.value })}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>

              <div style={styles.block}>
                <label style={styles.label}>Font size</label>
                <input
                  type="range"
                  min="10"
                  max="120"
                  value={selectedField.fontSize}
                  onChange={(e) => updateField(selectedField.id, { fontSize: Number(e.target.value) })}
                  style={{ width: "100%" }}
                />
                <div style={styles.help}>{selectedField.fontSize}px • Resize handles also work (width + size)</div>
              </div>

              <div style={styles.block}>
                <label style={styles.label}>Width (wrap area)</label>
                <input
                  type="range"
                  min="120"
                  max={Math.max(240, CW)}
                  value={Math.round(selectedField.width)}
                  onChange={(e) => updateField(selectedField.id, { width: Number(e.target.value) })}
                  style={{ width: "100%" }}
                />
                <div style={styles.help}>{Math.round(selectedField.width)}px</div>
              </div>

              <button
                style={styles.btnGhost}
                onClick={() => {
                  updateField(selectedField.id, {
                    fontFamily: "Inter",
                    fontStyle: selectedField.id === "certTitle" || selectedField.id === "name" || selectedField.id === "issuer" ? "bold" : "normal",
                    fill:
                      selectedField.id === "award" || selectedField.id === "subtitle" || selectedField.id === "description" || selectedField.id === "date"
                        ? "#2b2f44"
                        : "#1e2233",
                  });
                }}
              >
                Reset style (selected)
              </button>
            </>
          )}

          <div style={styles.hr} />
          <div style={styles.help}>
            Export is <b>pixel-perfect</b> because it uses the same canvas snapshot — <b>without</b> editor tools.
          </div>
        </div>
      </div>
    </div>
  );
}


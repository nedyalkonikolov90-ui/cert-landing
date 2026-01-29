import React, { useEffect, useMemo, useRef, useState } from "react";
import useImage from "use-image";
import JSZip from "jszip";

import CertificateStage from "./components/CertificateStage";
import TextEditorOverlay from "./components/TextEditorOverlay";

import { SIZES, MAX_PREVIEW, FONT_OPTIONS, niceFieldLabel, clamp } from "./lib/constants";
import { parseCsv, parseTxt } from "./lib/parsers";
import { ensureFontLink, fetchTemplates } from "./lib/templates";
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
  const [manualName, setManualName] = useState("Student Name");
  const [manualAward, setManualAward] = useState("For outstanding performance");
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

  // Fields
  const [fields, setFields] = useState(() => [
    {
      id: "certTitle",
      text: "Certificate of Achievement",
      x: CW / 2,
      y: 110,
      fontFamily: "Inter",
      fontSize: 44,
      fontStyle: "bold",
      fill: "#1e2233",
      align: "center",
      width: 760,
    },
    {
      id: "subtitle",
      text: "",
      x: CW / 2,
      y: 165,
      fontFamily: "Inter",
      fontSize: 18,
      fontStyle: "normal",
      fill: "#2b2f44",
      align: "center",
      width: 760,
    },
    {
      id: "name",
      text: "Student Name",
      x: CW / 2,
      y: 270,
      fontFamily: "Inter",
      fontSize: 38,
      fontStyle: "bold",
      fill: "#1e2233",
      align: "center",
      width: 760,
    },
    {
      id: "description",
      text: "",
      x: CW / 2,
      y: 322,
      fontFamily: "Inter",
      fontSize: 16,
      fontStyle: "normal",
      fill: "#2b2f44",
      align: "center",
      width: 760,
    },
    {
      id: "award",
      text: "For outstanding performance",
      x: CW / 2,
      y: 380,
      fontFamily: "Inter",
      fontSize: 20,
      fontStyle: "normal",
      fill: "#2b2f44",
      align: "center",
      width: 760,
    },
    {
      id: "date",
      text: `Date: ${new Date().toISOString().slice(0, 10)}`,
      x: 115,
      y: 560,
      fontFamily: "Inter",
      fontSize: 14,
      fontStyle: "normal",
      fill: "#2b2f44",
      align: "left",
      width: 260,
    },
    {
      id: "issuer",
      text: "Issuer / Organization",
      x: 680,
      y: 550,
      fontFamily: "Inter",
      fontSize: 16,
      fontStyle: "bold",
      fill: "#1e2233",
      align: "right",
      width: 300,
    },
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

  const sampleRow = useMemo(() => {
    if (inputMode === "manual") return { name: manualName, award: manualAward, date: dateText, issuer: issuerText };
    return rows[0] || { name: "Student Name", award: "For outstanding performance", date: dateText, issuer: issuerText };
  }, [inputMode, manualName, manualAward, dateText, issuerText, rows]);

  // Sync row-based fields to canvas preview
  useEffect(() => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id === "name") return { ...f, text: sampleRow.name || "" };
        if (f.id === "award") return { ...f, text: sampleRow.award || "" };
        if (f.id === "date") return { ...f, text: sampleRow.date ? `Date: ${sampleRow.date}` : "" };
        if (f.id === "issuer") return { ...f, text: sampleRow.issuer || issuerText || "" };
        return f;
      })
    );
  }, [sampleRow, issuerText]);

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
    if (editingId === "name" && inputMode === "manual") setManualName(editorValue);
    if (editingId === "award" && inputMode === "manual") setManualAward(editorValue);

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
    return inputMode === "manual"
      ? [{ name: manualName, award: manualAward, date: dateText, issuer: issuerText }]
      : rows;
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
          setFields((prev) =>
            prev.map((f) => {
              if (f.id === "name") return { ...f, text: r.name || "" };
              if (f.id === "award") return { ...f, text: r.award || "" };
              if (f.id === "date") return { ...f, text: r.date ? `Date: ${r.date}` : "" };
              if (f.id === "issuer") return { ...f, text: r.issuer || issuerText || "" };
              return f;
            })
          );
        },
        afterExportRestore: () => {
          setFields((prev) =>
            prev.map((f) => {
              if (f.id === "name") return { ...f, text: sampleRow.name || "" };
              if (f.id === "award") return { ...f, text: sampleRow.award || "" };
              if (f.id === "date") return { ...f, text: sampleRow.date ? `Date: ${sampleRow.date}` : "" };
              if (f.id === "issuer") return { ...f, text: sampleRow.issuer || issuerText || "" };
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
          setFields((prev) =>
            prev.map((f) => {
              if (f.id === "name") return { ...f, text: r.name || "" };
              if (f.id === "award") return { ...f, text: r.award || "" };
              if (f.id === "date") return { ...f, text: r.date ? `Date: ${r.date}` : "" };
              if (f.id === "issuer") return { ...f, text: r.issuer || issuerText || "" };
              return f;
            })
          );
        },
        afterExportRestore: () => {
          setFields((prev) =>
            prev.map((f) => {
              if (f.id === "name") return { ...f, text: sampleRow.name || "" };
              if (f.id === "award") return { ...f, text: sampleRow.award || "" };
              if (f.id === "date") return { ...f, text: sampleRow.date ? `Date: ${sampleRow.date}` : "" };
              if (f.id === "issuer") return { ...f, text: sampleRow.issuer || issuerText || "" };
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
              <option value="manual">Manual (single)</option>
              <option value="upload">Upload CSV/TXT (batch)</option>
            </select>
          </div>

          {inputMode === "manual" ? (
            <>
              <div style={styles.block}>
                <label style={styles.label}>Name</label>
                <input style={styles.input} value={manualName} onChange={(e) => setManualName(e.target.value)} />
              </div>
              <div style={styles.block}>
                <label style={styles.label}>Title / Award</label>
                <input style={styles.input} value={manualAward} onChange={(e) => setManualAward(e.target.value)} />
              </div>
            </>
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
            <input
              style={styles.input}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="(optional)"
            />
          </div>

          <div style={styles.block}>
            <label style={styles.label}>Free text (below name)</label>
            <input
              style={styles.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="(optional)"
            />
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

            <TextEditorOverlay
              open={!!editingId}
              value={editorValue}
              onChange={setEditorValue}
              onClose={closeEditor}
              nodeAbsRect={editorRect}
            />
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
                <input
                  style={styles.input}
                  value={selectedField.text}
                  onChange={(e) => updateField(selectedField.id, { text: e.target.value })}
                />
                <div style={styles.help}>Tip: double-click on canvas to edit faster.</div>
              </div>

              <div style={styles.block}>
                <label style={styles.label}>Font</label>
                <select
                  style={styles.select}
                  value={selectedField.fontFamily}
                  onChange={(e) => updateField(selectedField.id, { fontFamily: e.target.value })}
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
                  <select
                    style={styles.select}
                    value={selectedField.fontStyle}
                    onChange={(e) => updateField(selectedField.id, { fontStyle: e.target.value })}
                  >
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
                <select
                  style={styles.select}
                  value={selectedField.align}
                  onChange={(e) => updateField(selectedField.id, { align: e.target.value })}
                >
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
                    fontStyle:
                      selectedField.id === "certTitle" || selectedField.id === "name" || selectedField.id === "issuer"
                        ? "bold"
                        : "normal",
                    fill:
                      selectedField.id === "award" ||
                      selectedField.id === "subtitle" ||
                      selectedField.id === "description" ||
                      selectedField.id === "date"
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


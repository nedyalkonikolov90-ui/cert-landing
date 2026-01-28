import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KImage, Text as KText, Transformer } from "react-konva";
import useImage from "use-image";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";

// ---------- Canvas sizes (pt-like pixels) ----------
const SIZES = {
  A4: { w: 842, h: 595 }, // landscape
  LETTER: { w: 792, h: 612 }, // landscape
};

const MAX_PREVIEW = 5;

// ---------- Helpers ----------
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return { error: "CSV must include header + at least 1 row." };

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIndex = header.indexOf("name");
  const titleIndex = header.indexOf("title");
  const dateIndex = header.indexOf("date");
  const issuerIndex = header.indexOf("issuer");

  if (nameIndex === -1 || titleIndex === -1) {
    return { error: "CSV must include headers: name,title (date optional, issuer optional)." };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const name = cols[nameIndex] || "";
    const award = cols[titleIndex] || "";
    const date = dateIndex >= 0 ? cols[dateIndex] || "" : "";
    const issuer = issuerIndex >= 0 ? cols[issuerIndex] || "" : "";
    if (!name || !award) continue;
    rows.push({ name, award, date, issuer });
  }
  if (rows.length === 0) return { error: "No valid rows found (need name + title)." };
  return { rows };
}

// TXT: "Name - Title"
function parseTxt(text) {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { error: "TXT must include at least 1 line." };
  const rows = [];
  for (const line of lines) {
    const parts = line.split(" - ");
    if (parts.length >= 2) rows.push({ name: parts[0].trim(), award: parts.slice(1).join(" - ").trim(), date: "", issuer: "" });
  }
  if (rows.length === 0) return { error: 'TXT lines must be like: "Name - Title"' };
  return { rows };
}

// Draw background “cover”
function coverRect(imgW, imgH, boxW, boxH) {
  const scale = Math.max(boxW / imgW, boxH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  const x = (boxW - w) / 2;
  const y = (boxH - h) / 2;
  return { x, y, w, h };
}

// Load Google fonts (so canvas text matches what users expect)
function ensureFontLink() {
  const id = "certifyly-fonts";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Playfair+Display:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Poppins:wght@400;600;700&family=Oswald:wght@400;600;700&display=swap";
  document.head.appendChild(link);
}

const FONT_OPTIONS = [
  { id: "Inter", label: "Inter (Modern)" },
  { id: "Playfair Display", label: "Playfair Display (Elegant)" },
  { id: "Montserrat", label: "Montserrat (Clean)" },
  { id: "Poppins", label: "Poppins (Friendly)" },
  { id: "Oswald", label: "Oswald (Bold)" },
];

function niceFieldLabel(id) {
  return (
    {
      certTitle: "Certificate Title",
      subtitle: "Free text (below title)",
      name: "Name",
      description: "Free text (below name)",
      award: "Title / Award",
      date: "Date",
      issuer: "Issuer",
    }[id] || id
  );
}

// ---------- Editable overlay for double-click editing ----------
function TextEditorOverlay({ open, value, onChange, onClose, stageContainerRef, nodeAbsRect }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => ref.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  if (!open || !nodeAbsRect) return null;

  const { left, top, width, height } = nodeAbsRect;

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onClose}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onClose();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
      style={{
        position: "absolute",
        left,
        top,
        width: Math.max(120, width),
        height: Math.max(34, height),
        padding: "8px 10px",
        borderRadius: 10,
        border: "2px solid rgba(91,124,255,0.9)",
        outline: "none",
        fontSize: 16,
        lineHeight: 1.2,
        resize: "none",
        background: "rgba(255,255,255,0.95)",
        boxShadow: "0 12px 25px rgba(0,0,0,0.15)",
        zIndex: 50,
      }}
    />
  );
}

// ---------- Main App ----------
export default function App() {
  useEffect(() => ensureFontLink(), []);

  // Templates loaded from R2 via /api/templates
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState("");

  const [paper, setPaper] = useState("A4");
  const { w: CW, h: CH } = SIZES[paper];

  const [templateKey, setTemplateKey] = useState("");
  const selectedTemplate = useMemo(() => templates.find((t) => t.key === templateKey) || null, [templates, templateKey]);

  // Input mode: manual vs upload
  const [inputMode, setInputMode] = useState("manual"); // manual | upload
  const [uploadFile, setUploadFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [manualName, setManualName] = useState("Student Name");
  const [manualAward, setManualAward] = useState("For outstanding performance");
  const [dateText, setDateText] = useState(new Date().toISOString().slice(0, 10));
  const [issuerText, setIssuerText] = useState("Issuer / Organization");

  // Extra free text fields
  const [certTitle, setCertTitle] = useState("Certificate of Achievement");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Konva
  const stageRef = useRef(null);
  const stageContainerRef = useRef(null);
  const transformerRef = useRef(null);

  const [selectedId, setSelectedId] = useState("");

  // Fields on canvas (pixel positions)
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

  // Keep field texts in sync with form state
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

  // Sync dynamic row-based fields to the canvas for preview
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

  // Load templates list
  useEffect(() => {
    let alive = true;
    (async () => {
      setTemplatesLoading(true);
      setTemplatesError("");
      try {
        const res = await fetch("/api/templates");
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!alive) return;
        setTemplates(data.templates || []);
        // auto select first template
        if ((data.templates || []).length > 0) setTemplateKey((data.templates || [])[0].key);
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

  // Attach transformer to selected node
  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;

    if (!selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stage.findOne(`#${selectedId}`);
    if (!node) return;

    tr.nodes([node]);
    tr.getLayer()?.batchDraw();
  }, [selectedId, fields]);

  function updateField(id, patch) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
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

  const selectedField = useMemo(() => fields.find((f) => f.id === selectedId) || null, [fields, selectedId]);

  // Inline editing overlay
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

    const absPos = node.getAbsolutePosition();
    const scale = stage.scaleX(); // usually 1
    const box = node.getClientRect({ relativeTo: stage });

    const containerRect = container.getBoundingClientRect();
    // Stage is fixed size; we draw 1:1, and we scale container via CSS (responsive).
    // We compute overlay rect by using the rendered canvas bounding box:
    const canvasEl = container.querySelector("canvas");
    const canvasRect = canvasEl.getBoundingClientRect();

    const sx = canvasRect.width / CW;
    const sy = canvasRect.height / CH;

    setEditorRect({
      left: canvasRect.left + box.x * sx,
      top: canvasRect.top + box.y * sy,
      width: box.width * sx,
      height: box.height * sy,
      containerLeft: containerRect.left,
      containerTop: containerRect.top,
    });
  }

  function closeEditor() {
    if (!editingId) return;
    updateField(editingId, { text: editorValue });
    // sync back to form fields when editing special fields
    if (editingId === "certTitle") setCertTitle(editorValue);
    if (editingId === "subtitle") setSubtitle(editorValue);
    if (editingId === "description") setDescription(editorValue);
    if (editingId === "issuer") setIssuerText(editorValue);
    if (editingId === "date") {
      // allow editing date line directly; try to parse "Date: X"
      const m = editorValue.match(/date:\s*(.*)$/i);
      if (m?.[1]) setDateText(m[1].trim());
    }
    if (editingId === "name" && inputMode === "manual") setManualName(editorValue);
    if (editingId === "award" && inputMode === "manual") setManualAward(editorValue);

    setEditingId("");
    setEditorRect(null);
  }

  // Export: Build PDF client-side from EXACT stage render(s) => pixel-perfect
  async function exportPdfPreview() {
    setError("");
    if (!selectedTemplate) return setError("No template selected.");
    const effectiveRows =
      inputMode === "manual"
        ? [{ name: manualName, award: manualAward, date: dateText, issuer: issuerText }]
        : rows;

    if (!effectiveRows.length) return setError("Provide at least 1 recipient (manual or upload).");

    const previewRows = effectiveRows.slice(0, MAX_PREVIEW);

    setBusy(true);
    try {
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < previewRows.length; i++) {
        const r = previewRows[i];

        // Update canvas texts for this row (without changing layout)
        setFields((prev) =>
          prev.map((f) => {
            if (f.id === "name") return { ...f, text: r.name || "" };
            if (f.id === "award") return { ...f, text: r.award || "" };
            if (f.id === "date") return { ...f, text: r.date ? `Date: ${r.date}` : "" };
            if (f.id === "issuer") return { ...f, text: r.issuer || issuerText || "" };
            return f;
          })
        );

        // Wait a tick so Konva redraws before snapshot
        await new Promise((res) => setTimeout(res, 30));

        const stage = stageRef.current;
        const dataUrl = stage.toDataURL({ pixelRatio: 2 }); // crisp
        const pngBytes = await (await fetch(dataUrl)).arrayBuffer();

        const page = pdfDoc.addPage([CW, CH]);
        const img = await pdfDoc.embedPng(pngBytes);
        page.drawImage(img, { x: 0, y: 0, width: CW, height: CH });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "certificate_preview.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // restore preview sample row after export
      setTimeout(() => {
        setFields((prev) =>
          prev.map((f) => {
            if (f.id === "name") return { ...f, text: sampleRow.name || "" };
            if (f.id === "award") return { ...f, text: sampleRow.award || "" };
            if (f.id === "date") return { ...f, text: sampleRow.date ? `Date: ${sampleRow.date}` : "" };
            if (f.id === "issuer") return { ...f, text: sampleRow.issuer || issuerText || "" };
            return f;
          })
        );
      }, 0);
    } catch (e) {
      setError(String(e?.message || "Export failed"));
    } finally {
      setBusy(false);
    }
  }

  // Optional: ZIP PNGs (useful for batch)
  async function exportPngZipPreview() {
    setError("");
    if (!selectedTemplate) return setError("No template selected.");
    const effectiveRows =
      inputMode === "manual"
        ? [{ name: manualName, award: manualAward, date: dateText, issuer: issuerText }]
        : rows;

    if (!effectiveRows.length) return setError("Provide at least 1 recipient (manual or upload).");

    const previewRows = effectiveRows.slice(0, MAX_PREVIEW);

    setBusy(true);
    try {
      const zip = new JSZip();

      for (let i = 0; i < previewRows.length; i++) {
        const r = previewRows[i];

        setFields((prev) =>
          prev.map((f) => {
            if (f.id === "name") return { ...f, text: r.name || "" };
            if (f.id === "award") return { ...f, text: r.award || "" };
            if (f.id === "date") return { ...f, text: r.date ? `Date: ${r.date}` : "" };
            if (f.id === "issuer") return { ...f, text: r.issuer || issuerText || "" };
            return f;
          })
        );

        await new Promise((res) => setTimeout(res, 30));

        const stage = stageRef.current;
        const dataUrl = stage.toDataURL({ pixelRatio: 2 });
        const bin = await (await fetch(dataUrl)).arrayBuffer();
        zip.file(`certificate_${i + 1}.png`, bin);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "certificates_preview.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // restore preview
      setTimeout(() => {
        setFields((prev) =>
          prev.map((f) => {
            if (f.id === "name") return { ...f, text: sampleRow.name || "" };
            if (f.id === "award") return { ...f, text: sampleRow.award || "" };
            if (f.id === "date") return { ...f, text: sampleRow.date ? `Date: ${sampleRow.date}` : "" };
            if (f.id === "issuer") return { ...f, text: sampleRow.issuer || issuerText || "" };
            return f;
          })
        );
      }, 0);
    } catch (e) {
      setError(String(e?.message || "Export failed"));
    } finally {
      setBusy(false);
    }
  }

  // ---------- UI ----------
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
              {uploadFile && rows.length > 0 && <div style={styles.help}><b>Rows:</b> {rows.length} (preview shows first)</div>}
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

            <div style={styles.canvasStageOuter} ref={stageContainerRef}>
              <Stage
                width={CW}
                height={CH}
                ref={stageRef}
                style={styles.stage}
                onMouseDown={(e) => {
                  if (e.target === e.target.getStage()) setSelectedId("");
                }}
              >
                <Layer>
                  {/* background */}
                  {bg ? (
                    (() => {
                      const r = coverRect(bg.width, bg.height, CW, CH);
                      return <KImage image={bg} x={r.x} y={r.y} width={r.w} height={r.h} listening={false} />;
                    })()
                  ) : (
                    <KText text="Loading template…" x={20} y={20} fontFamily="Inter" fontSize={16} fill="#6b7280" />
                  )}

                  {/* text fields */}
                  {fields.map((f) => (
                    <KText
                      key={f.id}
                      id={f.id}
                      text={f.text || ""}
                      x={f.x - (f.align === "center" ? f.width / 2 : f.align === "right" ? f.width : 0)}
                      y={f.y}
                      width={f.width}
                      fontFamily={f.fontFamily}
                      fontSize={f.fontSize}
                      fontStyle={f.fontStyle}
                      fill={f.fill}
                      align={f.align}
                      draggable
                      onClick={() => setSelectedId(f.id)}
                      onTap={() => setSelectedId(f.id)}
                      onDblClick={() => openEditorFor(f.id)}
                      onDblTap={() => openEditorFor(f.id)}
                      onDragEnd={(e) => {
                        const node = e.target;
                        // keep y as top-left; store x as "anchor point"
                        const newX =
                          f.align === "center" ? node.x() + f.width / 2 : f.align === "right" ? node.x() + f.width : node.x();
                        updateField(f.id, { x: newX, y: node.y() });
                      }}
                      onTransformEnd={(e) => {
                        const node = e.target;
                        const tr = transformerRef.current;
                        const scaleX = node.scaleX();
                        const scaleY = node.scaleY();

                        // Width resize using scaleX
                        const nextWidth = Math.max(120, f.width * scaleX);

                        // Font size resize using scaleY (vertical handles)
                        const nextFontSize = clamp(f.fontSize * scaleY, 10, 120);

                        node.scaleX(1);
                        node.scaleY(1);

                        const nx =
                          f.align === "center" ? node.x() + nextWidth / 2 : f.align === "right" ? node.x() + nextWidth : node.x();

                        updateField(f.id, {
                          x: nx,
                          y: node.y(),
                          width: nextWidth,
                          fontSize: nextFontSize,
                        });

                        tr?.getLayer()?.batchDraw();
                      }}
                    />
                  ))}

                  <Transformer
                    ref={transformerRef}
                    rotateEnabled={false}
                    enabledAnchors={[
                      "middle-left",
                      "middle-right",
                      "top-left",
                      "top-right",
                      "bottom-left",
                      "bottom-right",
                    ]}
                    boundBoxFunc={(oldBox, newBox) => {
                      // Prevent flipping / too small
                      if (newBox.width < 120) return oldBox;
                      if (newBox.height < 20) return oldBox;
                      return newBox;
                    }}
                  />
                </Layer>
              </Stage>

              {/* Editable overlay */}
              <TextEditorOverlay
                open={!!editingId}
                value={editorValue}
                onChange={setEditorValue}
                onClose={closeEditor}
                stageContainerRef={stageContainerRef}
                nodeAbsRect={editorRect}
              />
            </div>
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
                <div style={styles.help}>
                  {selectedField.fontSize}px • Resize handles also work (width + size)
                </div>
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
                  // reset selected field style only
                  updateField(selectedField.id, {
                    fontFamily: "Inter",
                    fontStyle: selectedField.id === "certTitle" || selectedField.id === "name" || selectedField.id === "issuer" ? "bold" : "normal",
                    fill: selectedField.id === "award" || selectedField.id === "subtitle" || selectedField.id === "description" || selectedField.id === "date" ? "#2b2f44" : "#1e2233",
                  });
                }}
              >
                Reset style (selected)
              </button>
            </>
          )}

          <div style={styles.hr} />
          <div style={styles.help}>
            Export is <b>pixel-perfect</b> because PDF is created from the same canvas render.
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Styles (modern UI) ----------
const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 15% 10%, rgba(91,124,255,0.18), transparent 60%), radial-gradient(900px 500px at 85% 20%, rgba(255,138,76,0.16), transparent 55%), #0b1020",
    color: "#eaf0ff",
    padding: 22,
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: 18,
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
  },
  brand: { fontSize: 22, fontWeight: 800, letterSpacing: 0.2 },
  subbrand: { marginTop: 2, fontSize: 13, opacity: 0.85 },
  headerActions: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },

  grid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "360px 1fr 360px",
    gap: 16,
    alignItems: "start",
  },

  panel: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
  },
  panelTitle: { fontWeight: 800, fontSize: 14, letterSpacing: 0.6, opacity: 0.95, marginBottom: 12 },

  block: { marginBottom: 12 },
  label: { display: "block", fontSize: 12, opacity: 0.9, marginBottom: 6 },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#eaf0ff",
    outline: "none",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#eaf0ff",
    outline: "none",
  },
  help: { fontSize: 12, opacity: 0.78, marginTop: 6, lineHeight: 1.3 },
  hr: { height: 1, background: "rgba(255,255,255,0.10)", margin: "14px 0" },
  error: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    background: "rgba(180,35,24,0.12)",
    border: "1px solid rgba(180,35,24,0.35)",
    color: "#ffd7d2",
    whiteSpace: "pre-wrap",
    fontSize: 13,
  },

  btnPrimary: {
    padding: "11px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "linear-gradient(135deg, rgba(91,124,255,0.95), rgba(116,88,255,0.85))",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 16px 35px rgba(91,124,255,0.25)",
  },
  btnGhost: {
    padding: "11px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#eaf0ff",
    fontWeight: 700,
    cursor: "pointer",
  },
  btnDisabled: {
    padding: "11px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.7)",
    fontWeight: 800,
    cursor: "not-allowed",
  },

  canvasWrap: { minWidth: 0 },
  canvasCard: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
  },
  canvasTitleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  canvasTitle: { fontSize: 14, fontWeight: 800, letterSpacing: 0.5 },
  canvasHint: { marginTop: 4, fontSize: 12, opacity: 0.78 },
  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    fontSize: 12,
    fontWeight: 800,
  },
  canvasStageOuter: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    position: "relative",
  },
  stage: {
    borderRadius: 14,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 25px 60px rgba(0,0,0,0.40)",
    width: "100%",
    maxWidth: 1100,
    height: "auto",
  },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    fontSize: 12,
    fontWeight: 800,
  },
};

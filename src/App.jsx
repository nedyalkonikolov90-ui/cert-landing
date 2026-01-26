// src/App.jsx
import { useEffect, useMemo, useRef, useState } from "react";

const FONT_OPTIONS = [
  { id: "helvetica", label: "Helvetica" },
  { id: "times", label: "Times" },
  { id: "courier", label: "Courier" },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fontFamilyFor(fontId) {
  switch ((fontId || "").toLowerCase()) {
    case "times":
      return '"Times New Roman", Times, serif';
    case "courier":
      return '"Courier New", Courier, monospace';
    case "helvetica":
    default:
      return "Arial, Helvetica, sans-serif";
  }
}

// Paper sizes in PDF points (landscape)
function pageSize(paper) {
  return paper === "LETTER" ? { w: 792, h: 612 } : { w: 842, h: 595 };
}

// Shared: fit text size down until it fits maxWidth (px)
function fitTextPx({ text, fontFamily, fontWeight, startPx, minPx, maxWidthPx }) {
  const t = (text ?? "").toString();

  // canvas text measurement
  const canvas = fitTextPx._c || (fitTextPx._c = document.createElement("canvas"));
  const ctx = canvas.getContext("2d");
  if (!ctx) return startPx;

  let size = startPx;
  while (size > minPx) {
    ctx.font = `${fontWeight || 400} ${size}px ${fontFamily}`;
    const w = ctx.measureText(t).width;
    if (w <= maxWidthPx) break;
    size -= 1;
  }
  return size;
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

function parseTxt(text) {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { error: "TXT must include at least 1 line." };

  const rows = [];
  for (const line of lines) {
    const parts = line.split(" - ");
    if (parts.length >= 2) {
      rows.push({ name: parts[0].trim(), award: parts.slice(1).join(" - ").trim(), date: "", issuer: "" });
    }
  }
  if (rows.length === 0) return { error: 'TXT lines must be like: "Name - Title"' };
  return { rows };
}

// Click-to-select, drag, resize handles, double-click to edit
function DraggableResizableText({
  fieldKey,
  text,
  pos,
  onPosChange,
  onTextChange,
  selected,
  onSelect,
  style,
  previewBoxRef,
  pxPerPt,
  maxWidthRatio = 0.82,
}) {
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [resizing, setResizing] = useState(false);

  const elRef = useRef(null);

  // resize state
  const resizeStart = useRef({
    startX: 0,
    startY: 0,
    startSize: 0,
    handle: "se",
  });

  function pointerToPercent(clientX, clientY) {
    const el = previewBoxRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    return { x: clamp(px, 0, 1), y: clamp(py, 0, 1) };
  }

  const fontFamily = style?.fontFamily || "Arial, Helvetica, sans-serif";
  const fontWeight = style?.fontWeight || 400;

  const containerRect = previewBoxRef.current?.getBoundingClientRect();
  const containerWpx = containerRect?.width || 1000;

  // Start size in pt -> px
  const startPt = Number(style?.sizePt || 16);
  const startPx = startPt * pxPerPt;

  // Auto-fit (preview) using same width ratio as PDF
  const fittedPx = fitTextPx({
    text,
    fontFamily,
    fontWeight,
    startPx,
    minPx: Math.max(10 * pxPerPt, 8),
    maxWidthPx: containerWpx * maxWidthRatio,
  });

  function beginEdit() {
    setEditing(true);
    requestAnimationFrame(() => {
      const el = elRef.current;
      if (!el) return;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  }

  function endEdit(save = true) {
    setEditing(false);
    if (save) {
      const v = (elRef.current?.innerText ?? "").toString();
      onTextChange(fieldKey, v);
    } else {
      // revert
      requestAnimationFrame(() => {
        if (elRef.current) elRef.current.innerText = text || "";
      });
    }
  }

  function onDown(e) {
    // select on click
    onSelect(fieldKey);

    if (editing || resizing) return;

    // start drag
    e.preventDefault();
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onMove(e) {
    if (resizing) {
      const dx = e.clientX - resizeStart.current.startX;
      const dy = e.clientY - resizeStart.current.startY;

      // uniform scale based on diagonal movement
      const delta = Math.max(dx, dy);
      const scale = 1 + delta / 240; // tune sensitivity
      const newSize = clamp(resizeStart.current.startSize * scale, 8, 120);

      // NOTE: we pass back a “sizePt” update via custom event on style object
      style?.onSizeChange?.(fieldKey, newSize);
      return;
    }

    if (!dragging) return;
    const p = pointerToPercent(e.clientX, e.clientY);
    if (p) onPosChange(fieldKey, p);
  }

  function onUp() {
    setDragging(false);
    setResizing(false);
  }

  function startResize(e, handle) {
    e.preventDefault();
    e.stopPropagation();
    onSelect(fieldKey);
    setResizing(true);
    resizeStart.current = {
      startX: e.clientX,
      startY: e.clientY,
      startSize: Number(style?.sizePt || 16),
      handle,
    };
  }

  const showFrame = selected && !editing;

  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(fieldKey);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(fieldKey);
        beginEdit();
      }}
      style={{
        position: "absolute",
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        transform: "translate(-50%, -50%)",
        cursor: editing ? "text" : resizing ? "nwse-resize" : dragging ? "grabbing" : "grab",
        padding: "6px 10px",
        borderRadius: 10,
        background: editing ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.18)",
        border: showFrame ? "2px solid rgba(0, 120, 255, 0.85)" : "1px dashed rgba(0,0,0,0.22)",
        boxShadow: showFrame ? "0 10px 25px rgba(0,0,0,0.12)" : "none",
        touchAction: "none",
        userSelect: editing ? "text" : "none",
        whiteSpace: "nowrap",
        outline: "none",
        pointerEvents: "auto",
      }}
      title={editing ? "Editing… click outside to save" : "Click to select • Drag to move • Double-click to edit"}
    >
      <div
        ref={elRef}
        contentEditable={editing}
        suppressContentEditableWarning
        spellCheck={false}
        onBlur={() => endEdit(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            elRef.current?.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            endEdit(false);
          }
        }}
        style={{
          pointerEvents: editing ? "auto" : "none",
          fontFamily,
          fontWeight,
          fontSize: `${fittedPx}px`,
          color: style?.color || "#222",
        }}
      >
        {text || " "}
      </div>

      {/* Resize handles */}
      {selected && !editing && (
        <>
          {/* SE handle */}
          <div
            onPointerDown={(e) => startResize(e, "se")}
            style={{
              position: "absolute",
              right: -8,
              bottom: -8,
              width: 14,
              height: 14,
              borderRadius: 4,
              background: "rgba(0, 120, 255, 0.95)",
              border: "2px solid white",
              cursor: "nwse-resize",
            }}
            title="Resize"
          />
          {/* Optional: NW handle */}
          <div
            onPointerDown={(e) => startResize(e, "nw")}
            style={{
              position: "absolute",
              left: -8,
              top: -8,
              width: 14,
              height: 14,
              borderRadius: 4,
              background: "rgba(0, 120, 255, 0.95)",
              border: "2px solid white",
              cursor: "nwse-resize",
            }}
            title="Resize"
          />
        </>
      )}
    </div>
  );
}

export default function App() {
  const [inputMode, setInputMode] = useState("manual");

  const [templates, setTemplates] = useState([]); // [{id,label,key}]
  const [templatesLoading, setTemplatesLoading] = useState(true);

  const [uploadFile, setUploadFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  const [manualName, setManualName] = useState("Student Name");
  const [manualAward, setManualAward] = useState("For outstanding performance");

  const [templateId, setTemplateId] = useState("");
  const [paper, setPaper] = useState("A4");
  const [busy, setBusy] = useState(false);

  // Editable fields (on template)
  const [certTitle, setCertTitle] = useState("Certificate of Achievement");
  const [subtitle, setSubtitle] = useState("Presented to");
  const [description, setDescription] = useState("For outstanding effort and dedication");
  const [dateText, setDateText] = useState(new Date().toISOString().slice(0, 10));
  const [issuer, setIssuer] = useState("Issuer / Organization");

  // Positions (%)
  const [pos, setPos] = useState({
    certTitle: { x: 0.5, y: 0.18 },
    subtitle: { x: 0.5, y: 0.26 },
    name: { x: 0.5, y: 0.42 },
    description: { x: 0.5, y: 0.48 },
    award: { x: 0.5, y: 0.54 },
    date: { x: 0.12, y: 0.92 },
    issuer: { x: 0.82, y: 0.88 },
  });

  // Style per field: font + color + size (pt)
  const [styleByField, setStyleByField] = useState({
    certTitle: { font: "helvetica", color: "#2a2a2a", size: 38 },
    subtitle: { font: "helvetica", color: "#3a3a3a", size: 18 },
    name: { font: "helvetica", color: "#2a2a2a", size: 34 },
    description: { font: "helvetica", color: "#3a3a3a", size: 16 },
    award: { font: "helvetica", color: "#3a3a3a", size: 18 },
    date: { font: "helvetica", color: "#3a3a3a", size: 12 },
    issuer: { font: "helvetica", color: "#2a2a2a", size: 14 },
  });

  const [selectedField, setSelectedField] = useState(null);

  const previewBoxRef = useRef(null);

  useEffect(() => {
    (async () => {
      setError("");
      try {
        setTemplatesLoading(true);
        const res = await fetch("/api/templates");
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const list = Array.isArray(data?.templates) ? data.templates : [];
        setTemplates(list);
        if (list.length) setTemplateId((prev) => prev || list[0].id);
        else setTemplateId("");
      } catch (e) {
        setError(e?.message ? String(e.message) : "Failed to load templates.");
      } finally {
        setTemplatesLoading(false);
      }
    })();
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) || null,
    [templates, templateId]
  );

  const templateKey = selectedTemplate?.key || "";
  const previewImageUrl = templateKey ? `/api/template?key=${encodeURIComponent(templateKey)}` : "";

  const sampleRow = useMemo(() => {
    if (inputMode === "manual") {
      return { name: manualName, award: manualAward, date: dateText, issuer };
    }
    return rows[0] || { name: "Student Name", award: "For outstanding performance", date: dateText, issuer };
  }, [inputMode, manualName, manualAward, rows, dateText, issuer]);

  function updatePos(fieldKey, newPos) {
    setPos((p) => ({ ...p, [fieldKey]: newPos }));
  }

  function updateStyle(fieldKey, patch) {
    setStyleByField((s) => ({ ...s, [fieldKey]: { ...s[fieldKey], ...patch } }));
  }

  function updateText(fieldKey, value) {
    const v = (value ?? "").toString().replace(/\r/g, "").trim();

    if (fieldKey === "certTitle") setCertTitle(v);
    if (fieldKey === "subtitle") setSubtitle(v);
    if (fieldKey === "name") setManualName(v);
    if (fieldKey === "description") setDescription(v);
    if (fieldKey === "award") setManualAward(v);
    if (fieldKey === "date") setDateText(v.replace(/^Date:\s*/i, "").trim());
    if (fieldKey === "issuer") setIssuer(v);
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

  async function generatePreviewPdf() {
    setError("");
    if (!templateKey) return setError("No template selected. Upload templates to R2 first.");

    const effectiveRows =
      inputMode === "manual"
        ? [{ name: manualName, award: manualAward, date: dateText, issuer }]
        : rows;

    if (effectiveRows.length === 0) return setError("Provide at least 1 recipient (manual or upload).");

    setBusy(true);
    try {
      const form = new FormData();

      form.append("rows_json", JSON.stringify(effectiveRows));
      form.append("template_key", templateKey);
      form.append("paper_size", paper);

      form.append("certificate_title", certTitle);
      form.append("subtitle", subtitle);
      form.append("description", description);
      form.append("date_text", dateText);
      form.append("issuer", issuer);

      form.append("pos_json", JSON.stringify(pos));
      form.append("style_json", JSON.stringify(styleByField));

      const res = await fetch("/api/preview", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "certificate_preview.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.message ? String(e.message) : "Preview generation failed.");
    } finally {
      setBusy(false);
    }
  }

  const { w: pageW, h: pageH } = pageSize(paper);

  // px-per-pt based on container width
  const [pxPerPt, setPxPerPt] = useState(1.0);

  useEffect(() => {
    function recalc() {
      const el = previewBoxRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width) return;
      setPxPerPt(rect.width / pageW); // 1pt -> px scale
    }
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [paper, pageW]);

  function sizeChange(fieldKey, newSizePt) {
    updateStyle(fieldKey, { size: newSizePt });
  }

  const fieldList = ["certTitle", "subtitle", "name", "description", "award", "date", "issuer"];

  function prettyFieldName(k) {
    switch (k) {
      case "certTitle":
        return "Certificate Title";
      case "subtitle":
        return "Subtitle (under title)";
      case "name":
        return "Name";
      case "description":
        return "Description (under name)";
      case "award":
        return "Title / Award";
      case "date":
        return "Date";
      case "issuer":
        return "Issuer";
      default:
        return k;
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1>Certificate Generator</h1>

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "420px 1fr", gap: 18 }}>
        {/* CONTROLS */}
        <div style={{ padding: 20, border: "1px solid #ddd", borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Inputs</h2>

          <div style={{ marginBottom: 12 }}>
            <label><b>Input mode</b></label><br />
            <select value={inputMode} onChange={(e) => setInputMode(e.target.value)} style={{ width: "100%" }}>
              <option value="manual">Manual (single certificate)</option>
              <option value="upload">Upload CSV/TXT (batch)</option>
            </select>
          </div>

          {inputMode === "manual" ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <label><b>Name</b></label><br />
                <input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label><b>Title / Award</b></label><br />
                <input
                  value={manualAward}
                  onChange={(e) => setManualAward(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <label><b>Upload .csv or .txt</b></label><br />
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                />
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                  CSV headers: <code>name,title</code> (optional: <code>date</code>, <code>issuer</code>)<br />
                  TXT lines: <code>Name - Title</code>
                </div>
                {uploadFile && rows.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    <b>Rows:</b> {rows.length} (previewing first row on the right)
                  </div>
                )}
              </div>
            </>
          )}

          <h2 style={{ marginTop: 16 }}>Template</h2>
          <div style={{ marginBottom: 12 }}>
            <label><b>Template</b></label><br />
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              style={{ width: "100%" }}
              disabled={templatesLoading || templates.length === 0}
            >
              {templatesLoading ? (
                <option>Loading templates…</option>
              ) : templates.length === 0 ? (
                <option>No templates found</option>
              ) : (
                templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))
              )}
            </select>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
              Templates are loaded from R2 folder: <code>templates/</code>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label><b>Paper size</b></label><br />
            <select value={paper} onChange={(e) => setPaper(e.target.value)} style={{ width: "100%" }}>
              <option value="A4">A4 (landscape)</option>
              <option value="LETTER">US Letter (landscape)</option>
            </select>
          </div>

          <h2 style={{ marginTop: 16 }}>Font, color, size</h2>
          {fieldList.map((k) => (
            <div key={k} style={{ marginBottom: 10, padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{prettyFieldName(k)}</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10, marginBottom: 8 }}>
                <select value={styleByField[k].font} onChange={(e) => updateStyle(k, { font: e.target.value })}>
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>

                <input
                  type="color"
                  value={styleByField[k].color}
                  onChange={(e) => updateStyle(k, { color: e.target.value })}
                  style={{ height: 38 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 70px", gap: 10, alignItems: "center" }}>
                <input
                  type="range"
                  min={8}
                  max={90}
                  step={1}
                  value={Math.round(styleByField[k].size)}
                  onChange={(e) => updateStyle(k, { size: Number(e.target.value) })}
                />
                <div style={{ fontSize: 12, opacity: 0.75, textAlign: "right" }}>
                  {Math.round(styleByField[k].size)} pt
                </div>
              </div>
            </div>
          ))}

          {error && <div style={{ color: "red", marginTop: 10, whiteSpace: "pre-wrap" }}>{error}</div>}

          <button
            onClick={generatePreviewPdf}
            disabled={busy || templatesLoading || !templateKey}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #ccc",
              background: "#000",
              color: "#fff",
              cursor: "pointer",
              opacity: busy || templatesLoading || !templateKey ? 0.7 : 1,
            }}
          >
            {busy ? "Generating…" : "Generate Preview PDF"}
          </button>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Preview rules: Click to select • Drag to move • Resize with handles • Double-click to edit.
          </div>
        </div>

        {/* PREVIEW */}
        <div
          style={{ padding: 20, border: "1px solid #ddd", borderRadius: 12 }}
          onClick={() => setSelectedField(null)}
        >
          <h2 style={{ marginTop: 0 }}>Live preview (matches PDF export)</h2>

          {/* Paper aspect container (matches PDF page) */}
          <div
            ref={previewBoxRef}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 1200,
              aspectRatio: `${pageW} / ${pageH}`,
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
              background: "#f3f3f3",
            }}
          >
            {previewImageUrl ? (
              <img
                src={previewImageUrl}
                alt="Certificate template preview"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover", // IMPORTANT: matches PDF background cover crop
                }}
              />
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#666" }}>
                {templatesLoading ? "Loading templates…" : "No template preview available"}
              </div>
            )}

            <DraggableResizableText
              fieldKey="certTitle"
              text={certTitle}
              pos={pos.certTitle}
              onPosChange={updatePos}
              onTextChange={updateText}
              selected={selectedField === "certTitle"}
              onSelect={setSelectedField}
              previewBoxRef={previewBoxRef}
              pxPerPt={pxPerPt}
              maxWidthRatio={0.82}
              style={{
                fontFamily: fontFamilyFor(styleByField.certTitle.font),
                fontWeight: 800,
                color: styleByField.certTitle.color,
                sizePt: styleByField.certTitle.size,
                onSizeChange: sizeChange,
              }}
            />

            <DraggableResizableText
              fieldKey="subtitle"
              text={subtitle}
              pos={pos.subtitle}
              onPosChange={updatePos}
              onTextChange={updateText}
              selected={selectedField === "subtitle"}
              onSelect={setSelectedField}
              previewBoxRef={previewBoxRef}
              pxPerPt={pxPerPt}
              maxWidthRatio={0.82}
              style={{
                fontFamily: fontFamilyFor(styleByField.subtitle.font),
                fontWeight: 500,
                color: styleByField.subtitle.color,
                sizePt: styleByField.subtitle.size,
                onSizeChange: sizeChange,
              }}
            />

            <DraggableResizableText
              fieldKey="name"
              text={sampleRow.name}
              pos={pos.name}
              onPosChange={updatePos}
              onTextChange={updateText}
              selected={selectedField === "name"}
              onSelect={setSelectedField}
              previewBoxRef={previewBoxRef}
              pxPerPt={pxPerPt}
              maxWidthRatio={0.82}
              style={{
                fontFamily: fontFamilyFor(styleByField.name.font),
                fontWeight: 800,
                color: styleByField.name.color,
                sizePt: styleByField.name.size,
                onSizeChange: sizeChange,
              }}
            />

            <DraggableResizableText
              fieldKey="description"
              text={description}
              pos={pos.description}
              onPosChange={updatePos}
              onTextChange={updateText}
              selected={selectedField === "description"}
              onSelect={setSelectedField}
              previewBoxRef={previewBoxRef}
              pxPerPt={pxPerPt}
              maxWidthRatio={0.82}
              style={{
                fontFamily: fontFamilyFor(styleByField.description.font),
                fontWeight: 400,
                color: styleByField.description.color,
                sizePt: styleByField.description.size,
                onSizeChange: sizeChange,
              }}
            />

            <DraggableResizableText
              fieldKey="award"
              text={sampleRow.award}
              pos={pos.award}
              onPosChange={updatePos}
              onTextChange={updateText}
              selected={selectedField === "award"}
              onSelect={setSelectedField}
              previewBoxRef={previewBoxRef}
              pxPerPt={pxPerPt}
              maxWidthRatio={0.82}
              style={{
                fontFamily: fontFamilyFor(styleByField.award.font),
                fontWeight: 600,
                color: styleByField.award.color,
                sizePt: styleByField.award.size,
                onSizeChange: sizeChange,
              }}
            />

            <DraggableResizableText
              fieldKey="date"
              text={dateText ? `Date: ${dateText}` : "Date: ____-__-__"}
              pos={pos.date}
              onPosChange={updatePos}
              onTextChange={updateText}
              selected={selectedField === "date"}
              onSelect={setSelectedField}
              previewBoxRef={previewBoxRef}
              pxPerPt={pxPerPt}
              maxWidthRatio={0.50}
              style={{
                fontFamily: fontFamilyFor(styleByField.date.font),
                fontWeight: 600,
                color: styleByField.date.color,
                sizePt: styleByField.date.size,
                onSizeChange: sizeChange,
              }}
            />

            <DraggableResizableText
              fieldKey="issuer"
              text={issuer || "Issuer / Organization"}
              pos={pos.issuer}
              onPosChange={updatePos}
              onTextChange={updateText}
              selected={selectedField === "issuer"}
              onSelect={setSelectedField}
              previewBoxRef={previewBoxRef}
              pxPerPt={pxPerPt}
              maxWidthRatio={0.50}
              style={{
                fontFamily: fontFamilyFor(styleByField.issuer.font),
                fontWeight: 700,
                color: styleByField.issuer.color,
                sizePt: styleByField.issuer.size,
                onSizeChange: sizeChange,
              }}
            />
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Background crop + font sizes + fit-to-width match the PDF export.
          </div>
        </div>
      </div>
    </div>
  );
}

// src/App.jsx
import { useEffect, useMemo, useRef, useState } from "react";

// Keep these aligned with backend mapping (helvetica/times/courier)
const FONT_OPTIONS = [
  { id: "helvetica", label: "Helvetica" },
  { id: "times", label: "Times" },
  { id: "courier", label: "Courier" },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Make live preview match PDF “standard fonts” as closely as possible
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

function parseCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return { error: "CSV must include header + at least 1 row." };

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIndex = header.indexOf("name");
  const titleIndex = header.indexOf("title");
  const dateIndex = header.indexOf("date"); // optional
  const issuerIndex = header.indexOf("issuer"); // optional

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

// TXT format:
// Each line: Name - Title
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

// Editable + draggable overlay element.
function DraggableText({ fieldKey, text, pos, onPosChange, onTextChange, style, previewBoxRef }) {
  const [dragging, setDragging] = useState(false);

  function pointerToPercent(clientX, clientY) {
    const el = previewBoxRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    return { x: clamp(px, 0, 1), y: clamp(py, 0, 1) };
  }

  function onDown(e) {
    // If user is selecting/typing in editable content, don't start drag.
    if (e.target?.isContentEditable) return;
    e.preventDefault();
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onMove(e) {
    if (!dragging) return;
    const p = pointerToPercent(e.clientX, e.clientY);
    if (p) onPosChange(fieldKey, p);
  }

  function onUp() {
    setDragging(false);
  }

  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onTextChange(fieldKey, e.currentTarget.innerText)}
      style={{
        position: "absolute",
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        transform: "translate(-50%, -50%)",
        cursor: dragging ? "grabbing" : "grab",
        padding: "6px 10px",
        borderRadius: 10,
        background: dragging ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.22)",
        border: "1px dashed rgba(0,0,0,0.28)",
        touchAction: "none",
        userSelect: "text",
        whiteSpace: "nowrap",
        outline: "none",
        ...style,
      }}
      title="Edit text, or drag to reposition"
    >
      {text || " "}
    </div>
  );
}

export default function App() {
  const [inputMode, setInputMode] = useState("manual"); // manual | upload

  // Templates loaded from R2 via API
  const [templates, setTemplates] = useState([]); // [{id,label,key}]
  const [templatesLoading, setTemplatesLoading] = useState(true);

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [rows, setRows] = useState([]); // parsed rows for PDF generation
  const [error, setError] = useState("");

  // Manual entry state (single row)
  const [manualName, setManualName] = useState("Student Name");
  const [manualAward, setManualAward] = useState("For outstanding performance");

  // Common generator settings
  const [templateId, setTemplateId] = useState("");
  const [paper, setPaper] = useState("A4");
  const [busy, setBusy] = useState(false);

  // Editable fields on template
  const [certTitle, setCertTitle] = useState("Certificate of Achievement");
  const [subtitle, setSubtitle] = useState("Presented to"); // NEW (below title)
  const [dateText, setDateText] = useState(new Date().toISOString().slice(0, 10));
  const [issuer, setIssuer] = useState("Issuer / Organization");
  const [description, setDescription] = useState("For outstanding effort and dedication"); // NEW (below name)

  // Positions (% of preview box)
  const [pos, setPos] = useState({
    certTitle: { x: 0.5, y: 0.18 },
    subtitle: { x: 0.5, y: 0.26 }, // NEW
    name: { x: 0.5, y: 0.42 },
    description: { x: 0.5, y: 0.48 }, // NEW
    award: { x: 0.5, y: 0.54 },
    date: { x: 0.10, y: 0.92 },
    issuer: { x: 0.80, y: 0.88 },
  });

  // Style per field: font + color
  const [styleByField, setStyleByField] = useState({
    certTitle: { font: "helvetica", color: "#2a2a2a" },
    subtitle: { font: "helvetica", color: "#3a3a3a" }, // NEW
    name: { font: "helvetica", color: "#2a2a2a" },
    description: { font: "helvetica", color: "#3a3a3a" }, // NEW
    award: { font: "helvetica", color: "#3a3a3a" },
    date: { font: "helvetica", color: "#3a3a3a" },
    issuer: { font: "helvetica", color: "#2a2a2a" },
  });

  const previewBoxRef = useRef(null);

  // Load templates on mount
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
    const v = (value ?? "").toString().replace(/\r/g, "");

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

      // main fields
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
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
              Note: your template image is A4; Letter will crop slightly in the generated PDF.
            </div>
          </div>

          <h2 style={{ marginTop: 16 }}>Font & color</h2>
          {fieldList.map((k) => (
            <div key={k} style={{ marginBottom: 10, padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{prettyFieldName(k)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
                <select
                  value={styleByField[k].font}
                  onChange={(e) => updateStyle(k, { font: e.target.value })}
                >
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
            Tip: Edit text directly on the template (click → type), then click outside to save.
          </div>
        </div>

        {/* PREVIEW */}
        <div style={{ padding: 20, border: "1px solid #ddd", borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Live preview (edit + drag)</h2>

          <div
            ref={previewBoxRef}
            style={{ position: "relative", width: "100%", maxWidth: 1200, userSelect: "none" }}
          >
            {previewImageUrl ? (
              <img
                src={previewImageUrl}
                alt="Certificate template preview"
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  borderRadius: 12,
                  boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: 420,
                  borderRadius: 12,
                  background: "#f3f3f3",
                  display: "grid",
                  placeItems: "center",
                  color: "#666",
                }}
              >
                {templatesLoading ? "Loading templates…" : "No template preview available"}
              </div>
            )}

            <DraggableText
              fieldKey="certTitle"
              text={certTitle}
              pos={pos.certTitle}
              onPosChange={updatePos}
              onTextChange={updateText}
              previewBoxRef={previewBoxRef}
              style={{
                fontFamily: fontFamilyFor(styleByField.certTitle.font),
                fontWeight: 800,
                fontSize: "clamp(18px, 3.2vw, 42px)",
                color: styleByField.certTitle.color,
              }}
            />

            <DraggableText
              fieldKey="subtitle"
              text={subtitle}
              pos={pos.subtitle}
              onPosChange={updatePos}
              onTextChange={updateText}
              previewBoxRef={previewBoxRef}
              style={{
                fontFamily: fontFamilyFor(styleByField.subtitle.font),
                fontWeight: 500,
                fontSize: "clamp(12px, 1.8vw, 20px)",
                color: styleByField.subtitle.color,
              }}
            />

            <DraggableText
              fieldKey="name"
              text={sampleRow.name}
              pos={pos.name}
              onPosChange={updatePos}
              onTextChange={updateText}
              previewBoxRef={previewBoxRef}
              style={{
                fontFamily: fontFamilyFor(styleByField.name.font),
                fontWeight: 800,
                fontSize: "clamp(14px, 2.6vw, 30px)",
                color: styleByField.name.color,
              }}
            />

            <DraggableText
              fieldKey="description"
              text={description}
              pos={pos.description}
              onPosChange={updatePos}
              onTextChange={updateText}
              previewBoxRef={previewBoxRef}
              style={{
                fontFamily: fontFamilyFor(styleByField.description.font),
                fontWeight: 400,
                fontSize: "clamp(12px, 1.6vw, 18px)",
                color: styleByField.description.color,
              }}
            />

            <DraggableText
              fieldKey="award"
              text={sampleRow.award}
              pos={pos.award}
              onPosChange={updatePos}
              onTextChange={updateText}
              previewBoxRef={previewBoxRef}
              style={{
                fontFamily: fontFamilyFor(styleByField.award.font),
                fontWeight: 600,
                fontSize: "clamp(12px, 1.6vw, 18px)",
                color: styleByField.award.color,
              }}
            />

            <DraggableText
              fieldKey="date"
              text={dateText ? `Date: ${dateText}` : "Date: ____-__-__"}
              pos={pos.date}
              onPosChange={updatePos}
              onTextChange={updateText}
              previewBoxRef={previewBoxRef}
              style={{
                fontFamily: fontFamilyFor(styleByField.date.font),
                fontWeight: 600,
                fontSize: "clamp(10px, 1.2vw, 14px)",
                color: styleByField.date.color,
              }}
            />

            <DraggableText
              fieldKey="issuer"
              text={issuer || "Issuer / Organization"}
              pos={pos.issuer}
              onPosChange={updatePos}
              onTextChange={updateText}
              previewBoxRef={previewBoxRef}
              style={{
                fontFamily: fontFamilyFor(styleByField.issuer.font),
                fontWeight: 700,
                fontSize: "clamp(10px, 1.3vw, 16px)",
                color: styleByField.issuer.color,
              }}
            />
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Position + style are sent to the PDF generator.
          </div>
        </div>
      </div>
    </div>
  );
}


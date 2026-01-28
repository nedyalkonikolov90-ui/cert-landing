// src/App.jsx
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Modern UI + Canvas editor
 * - Templates loaded from /api/templates (R2)
 * - Preview image loaded from /api/template?key=...
 * - Click-to-select fields
 * - Drag to move (when not editing)
 * - Double-click or ✏️ to edit text
 * - Right-side inspector for selected field (font/color/size/weight)
 * - Still supports manual or upload CSV/TXT
 *
 * NOTE: This is UI-focused. It keeps your current PDF pipeline:
 * - POST /api/preview with template_key, pos_json, style_json, etc.
 */

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
    if (parts.length >= 2) rows.push({ name: parts[0].trim(), award: parts.slice(1).join(" - ").trim(), date: "", issuer: "" });
  }
  if (rows.length === 0) return { error: 'TXT lines must be like: "Name - Title"' };
  return { rows };
}

/** Canvas Field (click-to-select, drag-to-move, dblclick-to-edit) */
function CanvasField({
  fieldKey,
  text,
  pos,
  selected,
  onSelect,
  onPosChange,
  onTextChange,
  style,
  previewBoxRef,
}) {
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const elRef = useRef(null);

  function pointerToPercent(clientX, clientY) {
    const box = previewBoxRef.current;
    if (!box) return null;
    const rect = box.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    return { x: clamp(px, 0, 1), y: clamp(py, 0, 1) };
  }

  function startEditing() {
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

  function stopEditing(save = true) {
    setEditing(false);
    const el = elRef.current;
    if (!el) return;
    if (save) onTextChange(fieldKey, (el.innerText ?? "").toString().replace(/\r/g, ""));
    else el.innerText = text || "";
  }

  function onDown(e) {
    onSelect(fieldKey);
    if (editing) return;
    // allow clicking the edit button without starting drag
    if (e.target?.dataset?.role === "editbtn") return;
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
      onDoubleClick={(e) => {
        e.preventDefault();
        startEditing();
      }}
      style={{
        position: "absolute",
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        transform: "translate(-50%, -50%)",
        cursor: editing ? "text" : dragging ? "grabbing" : "grab",
        padding: "8px 10px",
        borderRadius: 12,
        background: selected
          ? "rgba(255,255,255,0.72)"
          : "rgba(255,255,255,0.18)",
        border: selected
          ? "1px solid rgba(120, 140, 255, 0.55)"
          : "1px dashed rgba(255,255,255,0.35)",
        boxShadow: selected ? "0 12px 28px rgba(0,0,0,0.12)" : "none",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        userSelect: editing ? "text" : "none",
        touchAction: "none",
        whiteSpace: "nowrap",
        maxWidth: "92%",
        ...style,
      }}
      title={editing ? "Editing… click outside to save" : "Click to select • Drag to move • Double-click to edit"}
    >
      <div
        ref={elRef}
        contentEditable={editing}
        suppressContentEditableWarning
        spellCheck={false}
        onBlur={() => stopEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            elRef.current?.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            stopEditing(false);
          }
        }}
        style={{
          outline: "none",
          pointerEvents: editing ? "auto" : "none",
        }}
      >
        {text || " "}
      </div>

      {!editing && (
        <button
          type="button"
          data-role="editbtn"
          onClick={(e) => {
            e.stopPropagation();
            startEditing();
          }}
          style={{
            marginLeft: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.08)",
            background: selected ? "rgba(120,140,255,0.12)" : "rgba(255,255,255,0.5)",
            cursor: "pointer",
            fontSize: 12,
            color: "rgba(20,20,30,0.9)",
          }}
          title="Edit"
        >
          ✏️ <span style={{ opacity: 0.75 }}>Edit</span>
        </button>
      )}
    </div>
  );
}

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
      return "Award / Title";
    case "date":
      return "Date";
    case "issuer":
      return "Issuer";
    default:
      return k;
  }
}

export default function App() {
  const [error, setError] = useState("");

  // templates from R2
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const selectedTemplate = useMemo(() => templates.find((t) => t.id === templateId) || null, [templates, templateId]);
  const templateKey = selectedTemplate?.key || "";
  const previewImageUrl = templateKey ? `/api/template?key=${encodeURIComponent(templateKey)}` : "";

  // input mode + data
  const [inputMode, setInputMode] = useState("manual"); // manual | upload
  const [uploadFile, setUploadFile] = useState(null);
  const [rows, setRows] = useState([]);

  const [manualName, setManualName] = useState("Student Name");
  const [manualAward, setManualAward] = useState("For outstanding performance");

  const [paper, setPaper] = useState("A4");
  const [busy, setBusy] = useState(false);

  // on-canvas text fields
  const [certTitle, setCertTitle] = useState("Certificate of Achievement");
  const [subtitle, setSubtitle] = useState("Presented to");
  const [description, setDescription] = useState("For outstanding effort and dedication");
  const [dateText, setDateText] = useState(new Date().toISOString().slice(0, 10));
  const [issuer, setIssuer] = useState("Issuer / Organization");

  // selection + inspector
  const FIELD_KEYS = useMemo(() => ["certTitle", "subtitle", "name", "description", "award", "date", "issuer"], []);
  const [selectedKey, setSelectedKey] = useState("certTitle");

  // positions (normalized 0..1)
  const [pos, setPos] = useState({
    certTitle: { x: 0.5, y: 0.18 },
    subtitle: { x: 0.5, y: 0.26 },
    name: { x: 0.5, y: 0.42 },
    description: { x: 0.5, y: 0.48 },
    award: { x: 0.5, y: 0.54 },
    date: { x: 0.10, y: 0.92 },
    issuer: { x: 0.80, y: 0.88 },
  });

  // style per field
  const [styleByField, setStyleByField] = useState({
    certTitle: { font: "helvetica", color: "#1e2233", size: 40, weight: 800 },
    subtitle: { font: "helvetica", color: "#2b2f44", size: 18, weight: 500 },
    name: { font: "helvetica", color: "#1e2233", size: 32, weight: 800 },
    description: { font: "helvetica", color: "#2b2f44", size: 16, weight: 400 },
    award: { font: "helvetica", color: "#2b2f44", size: 18, weight: 600 },
    date: { font: "helvetica", color: "#2b2f44", size: 12, weight: 600 },
    issuer: { font: "helvetica", color: "#1e2233", size: 14, weight: 700 },
  });

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
        setTemplateId((prev) => prev || (list[0]?.id ?? ""));
      } catch (e) {
        setError(e?.message ? String(e.message) : "Failed to load templates.");
      } finally {
        setTemplatesLoading(false);
      }
    })();
  }, []);

  const sampleRow = useMemo(() => {
    if (inputMode === "manual") return { name: manualName, award: manualAward, date: dateText, issuer };
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
    if (fieldKey === "description") setDescription(v);

    if (fieldKey === "name") setManualName(v);
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

      // Send style_json – keep only what backend expects (font + color).
      // If your backend also supports size/weight later, keep them too.
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

  const inspectorStyle = styleByField[selectedKey] || styleByField.certTitle;

  function getFieldText(fieldKey) {
    if (fieldKey === "certTitle") return certTitle;
    if (fieldKey === "subtitle") return subtitle;
    if (fieldKey === "description") return description;

    if (fieldKey === "name") return sampleRow.name;
    if (fieldKey === "award") return sampleRow.award;
    if (fieldKey === "date") return dateText ? `Date: ${dateText}` : "Date: ____-__-__";
    if (fieldKey === "issuer") return issuer || "Issuer / Organization";
    return "";
  }

  const canvasFields = [
    {
      key: "certTitle",
      text: certTitle,
      style: {
        fontFamily: fontFamilyFor(styleByField.certTitle.font),
        fontWeight: styleByField.certTitle.weight ?? 800,
        fontSize: `clamp(18px, 3.2vw, ${styleByField.certTitle.size ?? 42}px)`,
        color: styleByField.certTitle.color,
      },
    },
    {
      key: "subtitle",
      text: subtitle,
      style: {
        fontFamily: fontFamilyFor(styleByField.subtitle.font),
        fontWeight: styleByField.subtitle.weight ?? 500,
        fontSize: `clamp(12px, 1.8vw, ${styleByField.subtitle.size ?? 20}px)`,
        color: styleByField.subtitle.color,
      },
    },
    {
      key: "name",
      text: sampleRow.name,
      style: {
        fontFamily: fontFamilyFor(styleByField.name.font),
        fontWeight: styleByField.name.weight ?? 800,
        fontSize: `clamp(14px, 2.6vw, ${styleByField.name.size ?? 30}px)`,
        color: styleByField.name.color,
      },
    },
    {
      key: "description",
      text: description,
      style: {
        fontFamily: fontFamilyFor(styleByField.description.font),
        fontWeight: styleByField.description.weight ?? 400,
        fontSize: `clamp(12px, 1.6vw, ${styleByField.description.size ?? 18}px)`,
        color: styleByField.description.color,
      },
    },
    {
      key: "award",
      text: sampleRow.award,
      style: {
        fontFamily: fontFamilyFor(styleByField.award.font),
        fontWeight: styleByField.award.weight ?? 600,
        fontSize: `clamp(12px, 1.6vw, ${styleByField.award.size ?? 18}px)`,
        color: styleByField.award.color,
      },
    },
    {
      key: "date",
      text: dateText ? `Date: ${dateText}` : "Date: ____-__-__",
      style: {
        fontFamily: fontFamilyFor(styleByField.date.font),
        fontWeight: styleByField.date.weight ?? 600,
        fontSize: `clamp(10px, 1.2vw, ${styleByField.date.size ?? 14}px)`,
        color: styleByField.date.color,
      },
    },
    {
      key: "issuer",
      text: issuer || "Issuer / Organization",
      style: {
        fontFamily: fontFamilyFor(styleByField.issuer.font),
        fontWeight: styleByField.issuer.weight ?? 700,
        fontSize: `clamp(10px, 1.3vw, ${styleByField.issuer.size ?? 16}px)`,
        color: styleByField.issuer.color,
      },
    },
  ];

  return (
    <>
      {/* Global styles */}
      <style>{`
        :root{
          --bg1:#0b1020;
          --bg2:#0f1630;
          --card: rgba(255,255,255,0.08);
          --card2: rgba(255,255,255,0.06);
          --stroke: rgba(255,255,255,0.10);
          --stroke2: rgba(255,255,255,0.14);
          --txt: rgba(255,255,255,0.92);
          --muted: rgba(255,255,255,0.68);
          --muted2: rgba(255,255,255,0.52);
          --accent: #7b8cff;
          --accent2:#52e0c4;
          --danger:#ff5c7a;
          --shadow: 0 18px 55px rgba(0,0,0,0.38);
        }
        *{ box-sizing:border-box; }
        body{
          margin:0;
          background:
            radial-gradient(1200px 800px at 20% -10%, rgba(123,140,255,0.35), transparent 60%),
            radial-gradient(1000px 700px at 80% 0%, rgba(82,224,196,0.22), transparent 55%),
            radial-gradient(900px 700px at 50% 110%, rgba(255,92,122,0.14), transparent 60%),
            linear-gradient(180deg, var(--bg1), var(--bg2));
          color: var(--txt);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji","Segoe UI Emoji";
        }
        a{ color: inherit; }
        .app-wrap{ max-width: 1420px; margin: 0 auto; padding: 22px; }
        .topbar{
          display:flex; align-items:center; justify-content:space-between;
          padding: 14px 16px;
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.06));
          border: 1px solid var(--stroke);
          box-shadow: var(--shadow);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .brand{
          display:flex; gap:12px; align-items:center;
        }
        .logo{
          width:40px; height:40px; border-radius:14px;
          background: radial-gradient(circle at 30% 30%, rgba(123,140,255,0.95), rgba(82,224,196,0.75));
          box-shadow: 0 10px 25px rgba(123,140,255,0.25);
        }
        .h1{ font-size:16px; font-weight:800; letter-spacing:0.2px; margin:0; }
        .sub{ font-size:12px; color: var(--muted); margin:2px 0 0; }

        .layout{
          margin-top: 16px;
          display:grid;
          grid-template-columns: 380px 1fr 340px;
          gap: 14px;
        }
        @media (max-width: 1200px){
          .layout{ grid-template-columns: 1fr; }
        }

        .card{
          border-radius: 18px;
          border: 1px solid var(--stroke);
          background: linear-gradient(180deg, var(--card), var(--card2));
          box-shadow: var(--shadow);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          overflow:hidden;
        }
        .card-h{
          padding: 14px 14px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          display:flex; justify-content:space-between; align-items:center;
        }
        .card-h h2{
          margin:0;
          font-size: 13px;
          letter-spacing:0.3px;
          font-weight: 800;
          color: rgba(255,255,255,0.88);
        }
        .card-b{ padding: 14px; }

        .seg{
          display:grid;
          grid-template-columns: 1fr 1fr;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          overflow:hidden;
        }
        .seg button{
          padding:10px 10px;
          background: transparent;
          border:0;
          color: var(--muted);
          cursor:pointer;
          font-weight: 700;
          font-size: 12px;
        }
        .seg button.active{
          background: rgba(123,140,255,0.16);
          color: rgba(255,255,255,0.92);
        }

        .row{ display:grid; gap:10px; margin-top: 12px; }
        label{ font-size:12px; color: var(--muted); display:block; margin-bottom:6px; }
        input, select{
          width:100%;
          padding: 11px 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(10,14,28,0.55);
          color: rgba(255,255,255,0.92);
          outline:none;
        }
        input::placeholder{ color: rgba(255,255,255,0.35); }
        .hint{ font-size: 11px; color: var(--muted2); line-height: 1.35; }

        .btn{
          width:100%;
          padding: 12px 14px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.14);
          background: linear-gradient(180deg, rgba(123,140,255,0.9), rgba(123,140,255,0.65));
          color: rgba(255,255,255,0.96);
          font-weight: 900;
          cursor:pointer;
          box-shadow: 0 14px 35px rgba(123,140,255,0.25);
        }
        .btn:disabled{ opacity:0.65; cursor:not-allowed; }
        .btn.secondary{
          background: rgba(255,255,255,0.08);
          box-shadow:none;
        }

        .pill{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding: 8px 10px;
          border-radius: 999px;
          border:1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          font-size: 12px;
          color: var(--muted);
        }
        .err{
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,92,122,0.35);
          background: rgba(255,92,122,0.10);
          color: rgba(255,255,255,0.92);
          font-size: 12px;
          white-space: pre-wrap;
        }

        .canvas-wrap{
          padding: 14px;
        }
        .canvas-box{
          position:relative;
          width:100%;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.10);
          overflow:hidden;
          background: rgba(0,0,0,0.18);
          box-shadow: 0 18px 55px rgba(0,0,0,0.35);
        }
        .canvas-img{
          width: 100%;
          display:block;
          height:auto;
        }
        .canvas-empty{
          height: 520px;
          display:grid;
          place-items:center;
          color: var(--muted);
        }

        .fieldlist{
          display:grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }
        .fieldbtn{
          padding: 10px 10px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.85);
          cursor:pointer;
          text-align:left;
          display:flex;
          justify-content:space-between;
          align-items:center;
        }
        .fieldbtn.active{
          border-color: rgba(123,140,255,0.35);
          background: rgba(123,140,255,0.12);
        }
        .mini{ font-size: 11px; color: var(--muted2); }

        .two{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .slider{
          width:100%;
        }
        .kbd{
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 8px;
          border:1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.85);
        }
      `}</style>

      <div className="app-wrap">
        <div className="topbar">
          <div className="brand">
            <div className="logo" />
            <div>
              <p className="h1">Certifyly Studio</p>
              <p className="sub">Modern certificate editor — click, drag, edit inline</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="pill">
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(82,224,196,0.9)" }} />
              Templates: {templatesLoading ? "Loading…" : templates.length}
            </span>
            <span className="pill">
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(123,140,255,0.9)" }} />
              Selected: {prettyFieldName(selectedKey)}
            </span>
          </div>
        </div>

        <div className="layout">
          {/* LEFT: Data & template settings */}
          <div className="card">
            <div className="card-h">
              <h2>DATA & TEMPLATE</h2>
              <span className="kbd">Drag • Double-click edit</span>
            </div>
            <div className="card-b">
              <div className="seg">
                <button className={inputMode === "manual" ? "active" : ""} onClick={() => setInputMode("manual")}>
                  Manual
                </button>
                <button className={inputMode === "upload" ? "active" : ""} onClick={() => setInputMode("upload")}>
                  Upload
                </button>
              </div>

              <div className="row">
                {inputMode === "manual" ? (
                  <>
                    <div>
                      <label>Name</label>
                      <input value={manualName} onChange={(e) => setManualName(e.target.value)} />
                      <div className="hint">Used for the “Name” field. You can also edit it directly on the canvas.</div>
                    </div>
                    <div>
                      <label>Award / Title</label>
                      <input value={manualAward} onChange={(e) => setManualAward(e.target.value)} />
                      <div className="hint">Used for the “Award / Title” field.</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label>Upload .csv or .txt</label>
                      <input
                        type="file"
                        accept=".csv,.txt,text/csv,text/plain"
                        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                      />
                      <div className="hint">
                        CSV: <span className="kbd">name,title</span> (optional: date, issuer) <br />
                        TXT: <span className="kbd">Name - Title</span>
                      </div>
                      {uploadFile && rows.length > 0 && (
                        <div className="hint" style={{ marginTop: 6 }}>
                          Loaded rows: <b>{rows.length}</b> (preview uses first row)
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="two">
                  <div>
                    <label>Template</label>
                    <select
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                      disabled={templatesLoading || templates.length === 0}
                    >
                      {templatesLoading ? (
                        <option>Loading templates…</option>
                      ) : templates.length === 0 ? (
                        <option>No templates found</option>
                      ) : (
                        templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))
                      )}
                    </select>
                    <div className="hint">R2 folder: <span className="kbd">templates/</span></div>
                  </div>

                  <div>
                    <label>Paper</label>
                    <select value={paper} onChange={(e) => setPaper(e.target.value)}>
                      <option value="A4">A4 (landscape)</option>
                      <option value="LETTER">US Letter (landscape)</option>
                    </select>
                    <div className="hint">Letter may crop slightly in PDF.</div>
                  </div>
                </div>

                <button className="btn" disabled={busy || templatesLoading || !templateKey} onClick={generatePreviewPdf}>
                  {busy ? "Generating…" : "Generate Preview PDF"}
                </button>

                {error && <div className="err">{error}</div>}
              </div>
            </div>
          </div>

          {/* CENTER: Canvas */}
          <div className="card">
            <div className="card-h">
              <h2>CANVAS</h2>
              <span className="pill">
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.75)" }} />
                Click a field to select
              </span>
            </div>

            <div className="canvas-wrap">
              <div ref={previewBoxRef} className="canvas-box" onPointerDown={() => { /* click empty space */ }}>
                {previewImageUrl ? (
                  <img className="canvas-img" src={previewImageUrl} alt="Template preview" />
                ) : (
                  <div className="canvas-empty">{templatesLoading ? "Loading templates…" : "No template preview"}</div>
                )}

                {canvasFields.map((f) => (
                  <CanvasField
                    key={f.key}
                    fieldKey={f.key}
                    text={f.text}
                    pos={pos[f.key]}
                    selected={selectedKey === f.key}
                    onSelect={setSelectedKey}
                    onPosChange={updatePos}
                    onTextChange={updateText}
                    previewBoxRef={previewBoxRef}
                    style={f.style}
                  />
                ))}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span className="pill">Tip: double-click a field to edit</span>
                <span className="pill">Press <span className="kbd">Enter</span> to save</span>
                <span className="pill">Press <span className="kbd">Esc</span> to cancel</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Inspector */}
          <div className="card">
            <div className="card-h">
              <h2>INSPECTOR</h2>
              <span className="pill">Selected: <b style={{ color: "rgba(255,255,255,0.92)" }}>{prettyFieldName(selectedKey)}</b></span>
            </div>
            <div className="card-b">
              <div className="fieldlist">
                {FIELD_KEYS.map((k) => (
                  <button
                    key={k}
                    className={`fieldbtn ${selectedKey === k ? "active" : ""}`}
                    onClick={() => setSelectedKey(k)}
                    type="button"
                  >
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 12 }}>{prettyFieldName(k)}</div>
                      <div className="mini">{String(getFieldText(k)).slice(0, 26)}{String(getFieldText(k)).length > 26 ? "…" : ""}</div>
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.55)" }}>→</span>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 14 }} className="row">
                <div>
                  <label>Font</label>
                  <select
                    value={inspectorStyle.font}
                    onChange={(e) => updateStyle(selectedKey, { font: e.target.value })}
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <div className="hint">Live preview uses closest system fallback (PDF uses StandardFonts).</div>
                </div>

                <div className="two">
                  <div>
                    <label>Color</label>
                    <input
                      type="color"
                      value={inspectorStyle.color}
                      onChange={(e) => updateStyle(selectedKey, { color: e.target.value })}
                      style={{ height: 44 }}
                    />
                  </div>
                  <div>
                    <label>Weight</label>
                    <select
                      value={String(inspectorStyle.weight ?? 600)}
                      onChange={(e) => updateStyle(selectedKey, { weight: Number(e.target.value) })}
                    >
                      <option value="400">Regular (400)</option>
                      <option value="500">Medium (500)</option>
                      <option value="600">Semi (600)</option>
                      <option value="700">Bold (700)</option>
                      <option value="800">Extra (800)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label>Size (preview)</label>
                  <input
                    className="slider"
                    type="range"
                    min="10"
                    max="60"
                    value={inspectorStyle.size ?? 18}
                    onChange={(e) => updateStyle(selectedKey, { size: Number(e.target.value) })}
                  />
                  <div className="hint">This adjusts the live preview. If you want PDF to match size exactly, we’ll wire size into preview.js too.</div>
                </div>

                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => {
                    // reset a selected field to sane defaults
                    const defaults = {
                      certTitle: { font: "helvetica", color: "#1e2233", size: 40, weight: 800 },
                      subtitle: { font: "helvetica", color: "#2b2f44", size: 18, weight: 500 },
                      name: { font: "helvetica", color: "#1e2233", size: 32, weight: 800 },
                      description: { font: "helvetica", color: "#2b2f44", size: 16, weight: 400 },
                      award: { font: "helvetica", color: "#2b2f44", size: 18, weight: 600 },
                      date: { font: "helvetica", color: "#2b2f44", size: 12, weight: 600 },
                      issuer: { font: "helvetica", color: "#1e2233", size: 14, weight: 700 },
                    };
                    updateStyle(selectedKey, defaults[selectedKey] || {});
                  }}
                >
                  Reset selected style
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// src/App.jsx
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Certifyly Editor (Modern UI + Click-select + Drag + Resize handles + Inline edit)
 *
 * Assumes you have:
 *  - GET  /api/templates         -> { templates: [{ id, key, label }] }
 *  - GET  /api/template?key=...  -> returns the image bytes (png/jpg) from R2
 *  - POST /api/preview           -> generates PDF (your preview.js)
 *
 * IMPORTANT for "PDF exactly like live preview":
 *  - This UI uses fontSize in *pt* in the live preview (CSS "pt"),
 *    and sends the same numeric "size" to preview.js (pt).
 *  - preview.js should read style[field].size and use it directly (like the version I pasted).
 *  - Built-in PDF fonts only support regular/bold; we map weight>=700 to bold in PDF.
 */

const FONT_OPTIONS = [
  { id: "helvetica", label: "Helvetica" },
  { id: "times", label: "Times" },
  { id: "courier", label: "Courier" },
];

const FIELD_ORDER = ["certTitle", "subtitle", "name", "description", "award", "date", "issuer"];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
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

function prettyFieldName(k) {
  switch (k) {
    case "certTitle":
      return "Certificate Title";
    case "subtitle":
      return "Subtitle";
    case "name":
      return "Name";
    case "description":
      return "Description";
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

// Map our 3 font options to browser fonts (approx).
// PDF uses StandardFonts; the goal is *close* visual match + same size/position.
function fontFamilyFor(fontId) {
  const id = (fontId || "helvetica").toLowerCase();
  if (id === "times") return '"Times New Roman", Times, serif';
  if (id === "courier") return '"Courier New", Courier, monospace';
  return "Arial, Helvetica, sans-serif";
}

function defaultState() {
  return {
    // positions in normalized (0..1) relative to preview box
    pos: {
      certTitle: { x: 0.5, y: 0.18 },
      subtitle: { x: 0.5, y: 0.26 },
      name: { x: 0.5, y: 0.42 },
      description: { x: 0.5, y: 0.48 },
      award: { x: 0.5, y: 0.54 },
      date: { x: 0.12, y: 0.92 },
      issuer: { x: 0.84, y: 0.88 },
    },
    // style used by BOTH preview + PDF (size is PT!)
    styleByField: {
      certTitle: { font: "helvetica", color: "#1e2233", size: 40, weight: 800 },
      subtitle: { font: "helvetica", color: "#2b2f44", size: 18, weight: 500 },
      name: { font: "helvetica", color: "#1e2233", size: 32, weight: 800 },
      description: { font: "helvetica", color: "#2b2f44", size: 16, weight: 400 },
      award: { font: "helvetica", color: "#2b2f44", size: 18, weight: 600 },
      date: { font: "helvetica", color: "#2b2f44", size: 12, weight: 600 },
      issuer: { font: "helvetica", color: "#1e2233", size: 14, weight: 700 },
    },
  };
}

/**
 * CanvasText
 * - click to select
 * - drag to move (when not editing / not resizing)
 * - double-click to edit inline
 * - resize handles (4 corners) change font size (pt)
 * - no blur, no edit button
 */
function CanvasText({
  fieldKey,
  text,
  pos,
  style,
  selected,
  onSelect,
  onPosChange,
  onTextChange,
  onStyleChange,
  previewBoxRef,
}) {
  const elRef = useRef(null);
  const wrapRef = useRef(null);

  const [mode, setMode] = useState("idle"); // idle | drag | edit | resize
  const [resizeStart, setResizeStart] = useState(null);

  function pointerToPercent(clientX, clientY) {
    const box = previewBoxRef.current;
    if (!box) return null;
    const rect = box.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    return { x: clamp(px, 0, 1), y: clamp(py, 0, 1) };
  }

  function startEditing() {
    setMode("edit");
    requestAnimationFrame(() => {
      const el = elRef.current;
      if (!el) return;
      el.focus();
      // caret to end
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  }

  function stopEditing(save) {
    const el = elRef.current;
    if (!el) {
      setMode("idle");
      return;
    }
    if (save) {
      const v = (el.innerText ?? "").toString().replace(/\r/g, "");
      onTextChange(fieldKey, v);
    } else {
      el.innerText = text || "";
    }
    setMode("idle");
  }

  function onPointerDown(e) {
    // select always
    onSelect(fieldKey);

    // if clicking a resize handle, let handle code manage
    if (e.target?.dataset?.handle) return;

    // start drag unless editing
    if (mode === "edit") return;

    e.preventDefault();
    setMode("drag");
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (mode !== "drag") return;
    const p = pointerToPercent(e.clientX, e.clientY);
    if (p) onPosChange(fieldKey, p);
  }

  function onPointerUp() {
    if (mode === "drag") setMode("idle");
  }

  function beginResize(handle, e) {
    e.preventDefault();
    e.stopPropagation();

    const wrap = wrapRef.current;
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    setResizeStart({
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startSize: Number(style?.size ?? 18),
      // use diagonal movement relative to element size for stable feel
      elementW: rect.width || 1,
      elementH: rect.height || 1,
    });

    setMode("resize");
    wrap.setPointerCapture?.(e.pointerId);
  }

  function onResizeMove(e) {
    if (mode !== "resize" || !resizeStart) return;

    const dx = e.clientX - resizeStart.startX;
    const dy = e.clientY - resizeStart.startY;

    // convert movement into size delta (pt)
    // use diagonal direction so any corner feels similar
    const diag = Math.sqrt(resizeStart.elementW ** 2 + resizeStart.elementH ** 2) || 1;
    const move = (dx - dy) / diag; // drag down-right increases a bit; up-left decreases
    const deltaPt = move * 80; // sensitivity

    const nextSize = clamp(resizeStart.startSize + deltaPt, 8, 120);
    onStyleChange(fieldKey, { size: Math.round(nextSize) });
  }

  function endResize() {
    if (mode === "resize") {
      setMode("idle");
      setResizeStart(null);
    }
  }

  const isEditing = mode === "edit";

  return (
    <div
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onDoubleClick={(e) => {
        e.preventDefault();
        startEditing();
      }}
      style={{
        position: "absolute",
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        transform: "translate(-50%, -50%)",
        cursor: isEditing ? "text" : mode === "drag" ? "grabbing" : "grab",
        padding: "4px 6px",
        borderRadius: 6,
        border: selected ? "1px solid rgba(91,124,255,0.9)" : "1px solid transparent",
        background: "transparent",
        userSelect: isEditing ? "text" : "none",
        whiteSpace: "nowrap",
        zIndex: selected ? 10 : 2,
      }}
    >
      {/* Text node */}
      <div
        ref={elRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        spellCheck={false}
        onBlur={() => stopEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // Save on Enter (single line)
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
          pointerEvents: isEditing ? "auto" : "none",
          ...style,
        }}
      >
        {text || " "}
      </div>

      {/* Resize handles (only when selected and not editing) */}
      {selected && !isEditing && (
        <>
          {["nw", "ne", "sw", "se"].map((h) => (
            <div
              key={h}
              data-handle={h}
              onPointerDown={(e) => beginResize(h, e)}
              onPointerMove={onResizeMove}
              onPointerUp={endResize}
              onPointerLeave={endResize}
              style={{
                position: "absolute",
                width: 10,
                height: 10,
                borderRadius: 3,
                background: "rgba(91,124,255,0.95)",
                border: "1px solid rgba(255,255,255,0.75)",
                boxShadow: "0 6px 14px rgba(0,0,0,0.18)",
                cursor:
                  h === "nw" || h === "se"
                    ? "nwse-resize"
                    : "nesw-resize",
                left: h.includes("w") ? -6 : "auto",
                right: h.includes("e") ? -6 : "auto",
                top: h.includes("n") ? -6 : "auto",
                bottom: h.includes("s") ? -6 : "auto",
              }}
              title="Drag to resize"
            />
          ))}
        </>
      )}
    </div>
  );
}

export default function App() {
  // templates
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  const [templateId, setTemplateId] = useState("");
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) || null,
    [templates, templateId]
  );
  const templateKey = selectedTemplate?.key || "";
  const previewImageUrl = templateKey ? `/api/template?key=${encodeURIComponent(templateKey)}` : "";

  // input mode
  const [inputMode, setInputMode] = useState("manual");
  const [uploadFile, setUploadFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  // generator settings
  const [paper, setPaper] = useState("A4");
  const [busy, setBusy] = useState(false);

  // text fields
  const [certTitle, setCertTitle] = useState("Certificate of Achievement");
  const [subtitle, setSubtitle] = useState("Presented to");
  const [manualName, setManualName] = useState("Student Name");
  const [description, setDescription] = useState("For outstanding effort and dedication");
  const [manualAward, setManualAward] = useState("For outstanding performance");
  const [dateText, setDateText] = useState(new Date().toISOString().slice(0, 10));
  const [issuer, setIssuer] = useState("Issuer / Organization");

  // editor state
  const { pos: defaultPos, styleByField: defaultStyles } = useMemo(defaultState, []);
  const [pos, setPos] = useState(defaultPos);
  const [styleByField, setStyleByField] = useState(defaultStyles);
  const [selectedKey, setSelectedKey] = useState("certTitle");

  // canvas ref
  const previewBoxRef = useRef(null);

  // Load templates from backend
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
    if (inputMode === "manual") {
      return { name: manualName, award: manualAward, date: dateText, issuer };
    }
    return rows[0] || { name: manualName, award: manualAward, date: dateText, issuer };
  }, [inputMode, manualName, manualAward, rows, dateText, issuer]);

  function onPosChange(fieldKey, newPos) {
    setPos((p) => ({ ...p, [fieldKey]: newPos }));
  }

  function onStyleChange(fieldKey, patch) {
    setStyleByField((s) => ({ ...s, [fieldKey]: { ...s[fieldKey], ...patch } }));
  }

  function onTextChange(fieldKey, value) {
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

  function getFieldText(fieldKey) {
    if (fieldKey === "certTitle") return certTitle;
    if (fieldKey === "subtitle") return subtitle;
    if (fieldKey === "name") return sampleRow.name;
    if (fieldKey === "description") return description;
    if (fieldKey === "award") return sampleRow.award;
    if (fieldKey === "date") return dateText ? `Date: ${dateText}` : "Date: ____-__-__";
    if (fieldKey === "issuer") return issuer || "Issuer / Organization";
    return "";
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

      // data rows
      form.append("rows_json", JSON.stringify(effectiveRows));

      // template + paper
      form.append("template_key", templateKey);
      form.append("paper_size", paper);

      // text content
      form.append("certificate_title", certTitle);
      form.append("subtitle", subtitle);
      form.append("description", description);
      form.append("date_text", dateText);
      form.append("issuer", issuer);

      // positions and style (includes size/weight/font/color)
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

  const inspector = styleByField[selectedKey] || styleByField.certTitle;

  // Build live styles — IMPORTANT: use pt so PDF and Preview share the same unit
  function liveStyleFor(fieldKey) {
    const s = styleByField[fieldKey] || {};
    return {
      fontFamily: fontFamilyFor(s.font),
      fontWeight: s.weight ?? 600,
      fontSize: `${Number(s.size ?? 16)}pt`,
      color: s.color || "#111",
      lineHeight: 1.1,
      letterSpacing: "0px",
    };
  }

  const fields = useMemo(
    () =>
      FIELD_ORDER.map((k) => ({
        key: k,
        text: getFieldText(k),
        pos: pos[k],
        style: liveStyleFor(k),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [certTitle, subtitle, manualName, description, manualAward, dateText, issuer, inputMode, rows, pos, styleByField]
  );

  // ===== Modern UI CSS (no blur in preview; clean editor) =====
  const css = `
    :root{
      --bg0:#070a14;
      --bg1:#0a1030;
      --bg2:#0b153a;
      --card: rgba(255,255,255,0.07);
      --stroke: rgba(255,255,255,0.12);
      --stroke2: rgba(255,255,255,0.18);
      --text: rgba(255,255,255,0.92);
      --muted: rgba(255,255,255,0.64);
      --muted2: rgba(255,255,255,0.48);
      --accent:#5b7cff;
      --accent2:#52e0c4;
      --danger:#ff5c7a;
      --shadow: 0 18px 55px rgba(0,0,0,0.40);
      --shadow2: 0 10px 30px rgba(0,0,0,0.35);
      --radius: 18px;
    }

    *{ box-sizing:border-box; }
    body{
      margin:0;
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji","Segoe UI Emoji";
      background:
        radial-gradient(900px 600px at 15% -10%, rgba(91,124,255,0.30), transparent 60%),
        radial-gradient(900px 600px at 85% -5%, rgba(82,224,196,0.20), transparent 60%),
        radial-gradient(900px 650px at 50% 110%, rgba(255,92,122,0.12), transparent 60%),
        linear-gradient(180deg, var(--bg0), var(--bg1) 40%, var(--bg2));
      min-height: 100vh;
    }

    .wrap{ max-width: 1460px; margin: 0 auto; padding: 18px; }
    .top{
      display:flex; align-items:center; justify-content:space-between;
      padding: 14px 16px;
      border-radius: var(--radius);
      border: 1px solid var(--stroke);
      background: linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.06));
      box-shadow: var(--shadow);
    }
    .brand{ display:flex; gap:12px; align-items:center; }
    .logo{
      width:40px; height:40px; border-radius: 14px;
      background: radial-gradient(circle at 30% 30%, rgba(91,124,255,0.95), rgba(82,224,196,0.75));
      box-shadow: 0 10px 25px rgba(91,124,255,0.25);
    }
    .title{ margin:0; font-size: 16px; font-weight: 900; letter-spacing: 0.2px; }
    .subtitle{ margin:2px 0 0; font-size: 12px; color: var(--muted); }

    .pill{
      display:inline-flex; gap:10px; align-items:center;
      padding: 8px 10px;
      border-radius: 999px;
      border: 1px solid var(--stroke);
      background: rgba(255,255,255,0.06);
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }

    .grid{
      margin-top: 14px;
      display:grid;
      grid-template-columns: 380px 1fr 340px;
      gap: 14px;
    }
    @media (max-width: 1200px){
      .grid{ grid-template-columns: 1fr; }
    }

    .card{
      border-radius: var(--radius);
      border: 1px solid var(--stroke);
      background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05));
      box-shadow: var(--shadow2);
      overflow:hidden;
    }
    .cardHead{
      padding: 14px 14px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display:flex; justify-content:space-between; align-items:center;
    }
    .cardHead h2{
      margin:0;
      font-size: 12px;
      letter-spacing: 0.35px;
      font-weight: 900;
      color: rgba(255,255,255,0.88);
    }
    .cardBody{ padding: 14px; }

    .seg{
      display:grid; grid-template-columns: 1fr 1fr;
      border: 1px solid var(--stroke);
      border-radius: 14px;
      overflow:hidden;
    }
    .seg button{
      padding: 10px 10px;
      border: 0;
      cursor: pointer;
      background: transparent;
      color: var(--muted);
      font-weight: 800;
      font-size: 12px;
    }
    .seg button.active{
      background: rgba(91,124,255,0.18);
      color: rgba(255,255,255,0.92);
    }

    label{ font-size: 12px; color: var(--muted); display:block; margin-bottom: 6px; }
    input, select{
      width:100%;
      padding: 11px 12px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(5,7,14,0.55);
      color: rgba(255,255,255,0.92);
      outline:none;
    }
    input[type="color"]{ padding: 6px; height: 42px; }
    .row{ display:grid; gap: 10px; margin-top: 12px; }
    .two{ display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .hint{ font-size: 11px; color: var(--muted2); line-height: 1.35; }

    .btn{
      width:100%;
      padding: 12px 14px;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.14);
      background: linear-gradient(180deg, rgba(91,124,255,0.9), rgba(91,124,255,0.65));
      color: rgba(255,255,255,0.96);
      font-weight: 900;
      cursor:pointer;
      box-shadow: 0 14px 35px rgba(91,124,255,0.22);
    }
    .btn:disabled{ opacity:0.65; cursor:not-allowed; }

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

    .canvasWrap{ padding: 14px; }
    .canvasBox{
      position: relative;
      width: 100%;
      border-radius: 18px;
      border: 1px solid rgba(255,255,255,0.10);
      overflow:hidden;
      background: rgba(0,0,0,0.18);
      box-shadow: var(--shadow2);
    }
    .canvasImg{ width: 100%; display:block; height:auto; user-select:none; -webkit-user-drag:none; }
    .canvasEmpty{
      height: 520px;
      display:grid;
      place-items:center;
      color: var(--muted);
    }

    .fieldList{ display:grid; gap:8px; margin-top: 10px; }
    .fieldBtn{
      width:100%;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.10);
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.86);
      padding: 10px 10px;
      text-align:left;
      cursor:pointer;
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap: 10px;
    }
    .fieldBtn.active{
      border-color: rgba(91,124,255,0.35);
      background: rgba(91,124,255,0.12);
    }
    .mini{ font-size: 11px; color: var(--muted2); margin-top: 3px; }
    .kbd{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 8px;
      border:1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.85);
    }
    .slider{ width:100%; }
  `;

  return (
    <>
      <style>{css}</style>

      <div className="wrap">
        <div className="top">
          <div className="brand">
            <div className="logo" />
            <div>
              <p className="title">Certifyly Studio</p>
              <p className="subtitle">Click to select • Drag to move • Resize corners • Double-click to edit</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="pill">
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(82,224,196,0.9)" }} />
              Templates: {templatesLoading ? "Loading…" : templates.length}
            </span>
            <span className="pill">
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(91,124,255,0.9)" }} />
              Selected: {prettyFieldName(selectedKey)}
            </span>
            <span className="pill">
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.7)" }} />
              Size unit: <span className="kbd">pt</span>
            </span>
          </div>
        </div>

        <div className="grid">
          {/* LEFT: Inputs */}
          <div className="card">
            <div className="cardHead">
              <h2>DATA & TEMPLATE</h2>
              <span className="kbd">Enter saves • Esc cancels</span>
            </div>
            <div className="cardBody">
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
                      <div className="hint">You can also edit “Name” directly on the canvas.</div>
                    </div>

                    <div>
                      <label>Award / Title</label>
                      <input value={manualAward} onChange={(e) => setManualAward(e.target.value)} />
                    </div>
                  </>
                ) : (
                  <div>
                    <label>Upload .csv or .txt</label>
                    <input
                      type="file"
                      accept=".csv,.txt,text/csv,text/plain"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                    />
                    <div className="hint">
                      CSV: <span className="kbd">name,title</span> (optional: date, issuer)<br />
                      TXT: <span className="kbd">Name - Title</span>
                    </div>
                    {uploadFile && rows.length > 0 && (
                      <div className="hint" style={{ marginTop: 6 }}>
                        Loaded rows: <b>{rows.length}</b> (preview uses first row)
                      </div>
                    )}
                  </div>
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
                    <div className="hint">
                      Loaded from R2 folder: <span className="kbd">templates/</span>
                    </div>
                  </div>

                  <div>
                    <label>Paper</label>
                    <select value={paper} onChange={(e) => setPaper(e.target.value)}>
                      <option value="A4">A4 (landscape)</option>
                      <option value="LETTER">US Letter (landscape)</option>
                    </select>
                    <div className="hint">Letter uses cover-fit; may crop edges.</div>
                  </div>
                </div>

                <div className="two">
                  <div>
                    <label>Certificate Title</label>
                    <input value={certTitle} onChange={(e) => setCertTitle(e.target.value)} />
                  </div>
                  <div>
                    <label>Subtitle</label>
                    <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
                  </div>
                </div>

                <div className="two">
                  <div>
                    <label>Description</label>
                    <input value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>
                  <div>
                    <label>Date</label>
                    <input value={dateText} onChange={(e) => setDateText(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label>Issuer</label>
                  <input value={issuer} onChange={(e) => setIssuer(e.target.value)} />
                </div>

                <button className="btn" onClick={generatePreviewPdf} disabled={busy || templatesLoading || !templateKey}>
                  {busy ? "Generating…" : "Generate Preview PDF"}
                </button>

                {error && <div className="err">{error}</div>}
              </div>
            </div>
          </div>

          {/* CENTER: Canvas */}
          <div className="card">
            <div className="cardHead">
              <h2>LIVE PREVIEW</h2>
              <span className="pill">
                Resize: drag <span className="kbd">corners</span>
              </span>
            </div>
            <div className="canvasWrap">
              <div
                ref={previewBoxRef}
                className="canvasBox"
                onPointerDown={(e) => {
                  // clicking empty space clears selection
                  if (e.target === previewBoxRef.current) setSelectedKey("");
                }}
              >
                {previewImageUrl ? (
                  <img className="canvasImg" src={previewImageUrl} alt="Template preview" draggable={false} />
                ) : (
                  <div className="canvasEmpty">{templatesLoading ? "Loading templates…" : "No template preview"}</div>
                )}

                {fields.map((f) => (
                  <CanvasText
                    key={f.key}
                    fieldKey={f.key}
                    text={f.text}
                    pos={f.pos}
                    style={f.style}
                    selected={selectedKey === f.key}
                    onSelect={setSelectedKey}
                    onPosChange={onPosChange}
                    onTextChange={onTextChange}
                    onStyleChange={onStyleChange}
                    previewBoxRef={previewBoxRef}
                  />
                ))}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span className="pill">
                  Tip: double-click to edit • <span className="kbd">Enter</span> save • <span className="kbd">Esc</span> cancel
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: Inspector */}
          <div className="card">
            <div className="cardHead">
              <h2>INSPECTOR</h2>


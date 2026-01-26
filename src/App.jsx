import { useMemo, useRef, useState } from "react";

function parseCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return { error: "CSV must include header + rows." };

  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  const nameIndex = header.indexOf("name");
  const titleIndex = header.indexOf("title");
  if (nameIndex === -1 || titleIndex === -1) {
    return { error: "CSV must include headers: name,title" };
  }

  const rows = lines.slice(1)
    .map(line => {
      const cols = line.split(",");
      return { name: cols[nameIndex]?.trim(), title: cols[titleIndex]?.trim() };
    })
    .filter(r => r.name && r.title);

  return { rows };
}

const TEMPLATES = [
  {
    id: "kids-fantasy-1",
    label: "Kids Fantasy (v1)",
    preview: {
      A4: "https://cdn.budgetwonders.eu/templates/ChatGPT%20Image%2026.01.2026%20%D0%B3.%2C%2011_07_48.png",
      LETTER: "https://cdn.budgetwonders.eu/templates/ChatGPT%20Image%2026.01.2026%20%D0%B3.%2C%2011_07_48.png",
    },
  },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export default function App() {
  const [csvFile, setCsvFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [error, setError] = useState("");

  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [paper, setPaper] = useState("A4"); // A4 | LETTER
  const [busy, setBusy] = useState(false);

  const [certTitle, setCertTitle] = useState("Certificate of Achievement");
  const [dateText, setDateText] = useState(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [issuer, setIssuer] = useState("Issuer / Organization");

  // Issuer position stored as percentage of preview box (0..1)
  // Default: bottom-right-ish
  const [issuerPos, setIssuerPos] = useState({ x: 0.78, y: 0.88 });
  const [dragging, setDragging] = useState(false);

  const previewBoxRef = useRef(null);

  const selectedTemplate = useMemo(
    () => TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0],
    [templateId]
  );

  const previewImageUrl = selectedTemplate.preview[paper] || selectedTemplate.preview.A4;

  async function handleFile(file) {
    setCsvFile(file);
    const text = await file.text();
    const result = parseCsv(text);

    if (result.error) {
      setError(result.error);
      setFileInfo(null);
    } else {
      setError("");
      setFileInfo({ total: result.rows.length, sample: result.rows[0] || null });
    }
  }

  function pointerToPercent(clientX, clientY) {
    const el = previewBoxRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    return { x: clamp(px, 0, 1), y: clamp(py, 0, 1) };
  }

  function onIssuerPointerDown(e) {
    e.preventDefault();
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPreviewPointerMove(e) {
    if (!dragging) return;
    const p = pointerToPercent(e.clientX, e.clientY);
    if (p) setIssuerPos(p);
  }

  function onPreviewPointerUp() {
    setDragging(false);
  }

  async function generatePreviewPdf() {
    if (!csvFile) return setError("Upload a CSV first.");
    if (!fileInfo) return setError("Fix CSV errors first.");

    setError("");
    setBusy(true);

    try {
      const form = new FormData();
      form.append("file", csvFile);
      form.append("template_id", templateId);
      form.append("paper_size", paper);

      form.append("certificate_title", certTitle);
      form.append("date_text", dateText);
      form.append("issuer", issuer);

      // Send issuer position as percentages (0..1)
      form.append("issuer_x", String(issuerPos.x));
      form.append("issuer_y", String(issuerPos.y));

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

  return (
    <div style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1>Turn Spreadsheets into Beautiful Certificates</h1>

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "380px 1fr", gap: 18, alignItems: "start" }}>
        {/* LEFT: Controls */}
        <div style={{ padding: 20, border: "1px solid #ddd", borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Generator</h2>

          <div style={{ marginBottom: 12 }}>
            <label><b>Upload CSV</b></label><br />
            <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label><b>Template</b></label><br />
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ width: "100%" }}>
              {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label><b>Paper Size</b></label><br />
            <select value={paper} onChange={(e) => setPaper(e.target.value)} style={{ width: "100%" }}>
              <option value="A4">A4</option>
              <option value="LETTER">US Letter</option>
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label><b>Certificate title</b></label><br />
            <input
              type="text"
              value={certTitle}
              onChange={(e) => setCertTitle(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label><b>Date</b> (bottom-left)</label><br />
            <input
              type="text"
              value={dateText}
              onChange={(e) => setDateText(e.target.value)}
              placeholder="2026-01-26"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label><b>Issuer</b> (drag on preview)</label><br />
            <input
              type="text"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="Issuer / Organization"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
            />
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
              Drag the issuer text anywhere on the certificate preview.
            </div>
          </div>

          {fileInfo && (
            <div style={{ marginTop: 12 }}>
              <b>Rows detected:</b> {fileInfo.total}
              <pre style={{ marginTop: 10, fontSize: 12, background: "#fafafa", padding: 10, borderRadius: 10 }}>
                {(fileInfo.sample ? `${fileInfo.sample.name} – ${fileInfo.sample.title}` : "—")}
              </pre>
            </div>
          )}

          {error && <div style={{ color: "red", marginTop: 10, whiteSpace: "pre-wrap" }}>{error}</div>}

          <button
            onClick={generatePreviewPdf}
            disabled={busy || !fileInfo}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #ccc",
              background: "#000",
              color: "#fff",
              cursor: "pointer",
              opacity: busy || !fileInfo ? 0.7 : 1,
            }}
          >
            {busy ? "Generating…" : "Generate Preview PDF (5 pages)"}
          </button>
        </div>

        {/* RIGHT: Live preview with overlays */}
        <div style={{ padding: 20, border: "1px solid #ddd", borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Live preview</h2>

          <div
            ref={previewBoxRef}
            onPointerMove={onPreviewPointerMove}
            onPointerUp={onPreviewPointerUp}
            onPointerLeave={onPreviewPointerUp}
            style={{ position: "relative", width: "100%", maxWidth: 1100, userSelect: "none" }}
          >
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

            {/* Title overlay */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "18%",
                transform: "translateX(-50%)",
                width: "78%",
                textAlign: "center",
                pointerEvents: "none",
                fontWeight: 800,
                letterSpacing: "0.5px",
                color: "rgba(40,40,40,0.9)",
                textShadow: "0 1px 0 rgba(255,255,255,0.65)",
                fontSize: "clamp(18px, 3.2vw, 42px)",
              }}
            >
              {certTitle || " "}
            </div>

            {/* Sample name/title overlays */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "42%",
                transform: "translateX(-50%)",
                width: "78%",
                textAlign: "center",
                pointerEvents: "none",
                color: "rgba(50,50,50,0.85)",
                fontSize: "clamp(14px, 2.3vw, 28px)",
                fontWeight: 700,
              }}
            >
              {fileInfo?.sample?.name || "Student Name"}
            </div>

            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translateX(-50%)",
                width: "78%",
                textAlign: "center",
                pointerEvents: "none",
                color: "rgba(60,60,60,0.75)",
                fontSize: "clamp(12px, 1.5vw, 18px)",
              }}
            >
              {fileInfo?.sample?.title || "For outstanding performance"}
            </div>

            {/* Date bottom-left (fixed) */}
            <div
              style={{
                position: "absolute",
                left: "4%",
                bottom: "4%",
                pointerEvents: "none",
                fontSize: "clamp(10px, 1.2vw, 14px)",
                color: "rgba(60,60,60,0.8)",
                fontWeight: 600,
                textShadow: "0 1px 0 rgba(255,255,255,0.6)",
              }}
            >
              {dateText ? `Date: ${dateText}` : "Date: ____-__-__"}
            </div>

            {/* Issuer draggable */}
            <div
              onPointerDown={onIssuerPointerDown}
              style={{
                position: "absolute",
                left: `${issuerPos.x * 100}%`,
                top: `${issuerPos.y * 100}%`,
                transform: "translate(-50%, -50%)",
                cursor: "grab",
                padding: "6px 10px",
                borderRadius: 10,
                background: dragging ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.35)",
                border: "1px dashed rgba(0,0,0,0.25)",
                color: "rgba(40,40,40,0.9)",
                fontWeight: 700,
                fontSize: "clamp(10px, 1.3vw, 16px)",
                textShadow: "0 1px 0 rgba(255,255,255,0.6)",
                touchAction: "none",
              }}
              title="Drag me"
            >
              {issuer || "Issuer / Organization"}
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Issuer position is saved as % and will be used in the generated PDF.
          </div>
        </div>
      </div>
    </div>
  );
}

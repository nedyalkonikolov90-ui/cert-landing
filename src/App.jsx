import { useMemo, useState } from "react";

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
      return {
        name: cols[nameIndex]?.trim(),
        title: cols[titleIndex]?.trim()
      };
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
      LETTER: "https://cdn.budgetwonders.eu/templates/ChatGPT%20Image%2026.01.2026%20%D0%B3.%2C%2011_07_48.png"
    }
  }
];

export default function App() {
  const [csvFile, setCsvFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [error, setError] = useState("");

  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [paper, setPaper] = useState("A4");
  const [certTitle, setCertTitle] = useState("Certificate of Achievement");
  const [busy, setBusy] = useState(false);

  const selectedTemplate = useMemo(
    () => TEMPLATES.find(t => t.id === templateId),
    [templateId]
  );

  async function handleFile(file) {
    setCsvFile(file);
    const text = await file.text();
    const result = parseCsv(text);

    if (result.error) {
      setError(result.error);
      setFileInfo(null);
    } else {
      setError("");
      setFileInfo({
        total: result.rows.length,
        sample: result.rows[0] || null
      });
    }
  }

  async function generatePreviewPdf() {
    if (!csvFile) return setError("Upload a CSV first.");
    if (!fileInfo) return setError("Fix CSV errors first.");

    setBusy(true);
    setError("");

    try {
      const form = new FormData();
      form.append("file", csvFile);
      form.append("template_id", templateId);
      form.append("paper_size", paper);
      form.append("certificate_title", certTitle);

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
      setError(e.message || "Preview generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1>Turn Spreadsheets into Beautiful Certificates</h1>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20 }}>
        {/* Controls */}
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 20 }}>
          <label><b>Upload CSV</b></label><br />
          <input type="file" accept=".csv"
            onChange={e => e.target.files && handleFile(e.target.files[0])} />

          <br /><br />

          <label><b>Template</b></label><br />
          <select value={templateId} onChange={e => setTemplateId(e.target.value)}>
            {TEMPLATES.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>

          <br /><br />

          <label><b>Paper size</b></label><br />
          <select value={paper} onChange={e => setPaper(e.target.value)}>
            <option value="A4">A4</option>
            <option value="LETTER">US Letter</option>
          </select>

          <br /><br />

          <label><b>Certificate title</b></label><br />
          <input
            value={certTitle}
            onChange={e => setCertTitle(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />

          {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}

          <button
            onClick={generatePreviewPdf}
            disabled={busy || !fileInfo}
            style={{
              marginTop: 14,
              width: "100%",
              padding: 12,
              background: "#000",
              color: "#fff",
              borderRadius: 10
            }}
          >
            {busy ? "Generating…" : "Generate Preview PDF"}
          </button>
        </div>

        {/* Preview */}
        <div style={{ position: "relative" }}>
          <img
            src={selectedTemplate.preview[paper]}
            alt="Preview"
            style={{ width: "100%", borderRadius: 12 }}
          />

          <div
            style={{
              position: "absolute",
              top: "18%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "80%",
              textAlign: "center",
              fontWeight: 800,
              fontSize: "clamp(18px, 3vw, 42px)",
              color: "#333"
            }}
          >
            {certTitle}
          </div>

          {fileInfo?.sample && (
            <>
              <div style={{
                position: "absolute",
                top: "42%",
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: "clamp(16px, 2.5vw, 28px)",
                fontWeight: 700
              }}>
                {fileInfo.sample.name}
              </div>

              <div style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: "clamp(12px, 1.8vw, 18px)"
              }}>
                {fileInfo.sample.title}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


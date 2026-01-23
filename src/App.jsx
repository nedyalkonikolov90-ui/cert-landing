import { useState } from "react";

function parseCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return { error: "CSV must include header + rows." };

  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  const nameIndex = header.indexOf("name");
  const titleIndex = header.indexOf("title");
  if (nameIndex === -1 || titleIndex === -1) return { error: "CSV must include headers: name,title" };

  const rows = lines.slice(1).map(line => {
    const cols = line.split(",");
    return { name: cols[nameIndex]?.trim(), title: cols[titleIndex]?.trim() };
  }).filter(r => r.name && r.title);

  return { rows };
}

export default function App() {
  const [csvFile, setCsvFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [error, setError] = useState("");
  const [template, setTemplate] = useState("modern");
  const [paper, setPaper] = useState("A4");
  const [busy, setBusy] = useState(false);

  async function handleFile(file) {
    setCsvFile(file);
    const text = await file.text();
    const result = parseCsv(text);

    if (result.error) {
      setError(result.error);
      setFileInfo(null);
    } else {
      setError("");
      setFileInfo({ total: result.rows.length, sample: result.rows.slice(0, 3) });
    }
  }

  async function generatePreview() {
    if (!csvFile) return setError("Upload a CSV first.");
    if (!fileInfo) return setError("Fix CSV errors first.");

    setError("");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", csvFile);
      form.append("template_id", template);
      form.append("paper_size", paper);

      const res = await fetch("/api/preview", { method: "POST", body: form });
      if (!res.ok) {
        const maybe = await res.json().catch(() => ({}));
        throw new Error(maybe.error || "Preview generation failed.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "certificate_preview.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1>Turn Spreadsheets into Beautiful Certificates</h1>
      <p>Upload CSV → Pick style → Download 5-certificate preview ZIP</p>

      <div style={{ marginTop: 30, padding: 20, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2>Generator</h2>

        <div style={{ marginBottom: 15 }}>
          <label><b>Upload CSV</b></label><br />
          <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label><b>Template</b></label><br />
          <select value={template} onChange={(e) => setTemplate(e.target.value)}>
            <option value="modern">Modern</option>
            <option value="elegant">Elegant</option>
            <option value="playful">Playful</option>
          </select>
        </div>

        <div style={{ marginBottom: 15 }}>
          <label><b>Paper Size</b></label><br />
          <select value={paper} onChange={(e) => setPaper(e.target.value)}>
            <option value="A4">A4</option>
            <option value="LETTER">US Letter</option>
          </select>
        </div>

        {fileInfo && (
          <div style={{ marginTop: 20 }}>
            <b>Rows detected:</b> {fileInfo.total}
            <pre style={{ marginTop: 10, fontSize: 12 }}>
              {fileInfo.sample.map(r => `${r.name} – ${r.title}`).join("\n")}
            </pre>
          </div>
        )}

        {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}

        <button
          onClick={generatePreview}
          disabled={busy || !fileInfo}
          style={{
            marginTop: 14,
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #ccc",
            background: "#000",
            color: "#fff",
            cursor: "pointer",
            opacity: busy || !fileInfo ? 0.7 : 1
          }}
        >
          {busy ? "Generating…" : "Generate Preview ZIP (5 certificates)"}
        </button>
      </div>
    </div>
  );
}


import { useState } from "react";

function parseCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return { error: "CSV must include header + rows." };

  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  const nameIndex = header.indexOf("name");
  const titleIndex = header.indexOf("title");

  if (nameIndex === -1 || titleIndex === -1) {
    return { error: "CSV must include headers: name,title" };
  }

  const rows = lines.slice(1).map(line => {
    const cols = line.split(",");
    return {
      name: cols[nameIndex]?.trim(),
      title: cols[titleIndex]?.trim()
    };
  }).filter(r => r.name && r.title);

  return { rows };
}

export default function App() {
  const [fileInfo, setFileInfo] = useState(null);
  const [error, setError] = useState("");
  const [template, setTemplate] = useState("modern");
  const [paper, setPaper] = useState("A4");

  async function handleFile(file) {
    const text = await file.text();
    const result = parseCsv(text);

    if (result.error) {
      setError(result.error);
      setFileInfo(null);
    } else {
      setError("");
      setFileInfo({
        total: result.rows.length,
        sample: result.rows.slice(0, 3)
      });
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1>Turn Spreadsheets into Beautiful Certificates</h1>
      <p>Upload CSV → Pick style → Download preview (coming next)</p>

      <div style={{ marginTop: 30, padding: 20, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2>Generator</h2>

        <div style={{ marginBottom: 15 }}>
          <label><b>Upload CSV</b></label><br />
          <input
            type="file"
            accept=".csv"
            onChange={(e) => handleFile(e.target.files[0])}
          />
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

        {error && (
          <div style={{ color: "red", marginTop: 10 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

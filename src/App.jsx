export default function App() {
  return (
    <div style={{ minHeight: "100vh", padding: 40, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 44, margin: 0 }}>Beautiful Certificates in Seconds</h1>
      <p style={{ fontSize: 18, opacity: 0.8, marginTop: 12 }}>
        Upload a CSV. Pick a template. Download print-ready PDFs instantly.
      </p>
      <a
        href="#generator"
        style={{
          display: "inline-block",
          marginTop: 18,
          padding: "12px 16px",
          borderRadius: 12,
          background: "#000",
          color: "#fff",
          textDecoration: "none",
        }}
      >
        Generate Free Preview
      </a>

      <div
        id="generator"
        style={{
          marginTop: 40,
          padding: 18,
          borderRadius: 16,
          border: "1px solid #ddd",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Generator (coming next)</h2>
        <p style={{ margin: 0, opacity: 0.75 }}>
          Next step: CSV upload + template picker.
        </p>
      </div>
    </div>
  );
}

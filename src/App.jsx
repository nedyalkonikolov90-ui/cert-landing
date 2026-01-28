 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/src/App.jsx b/src/App.jsx
index 720c4c43d917c6d590a3700d7143b6ac83a32657..2070f01bb1574bc3e591d3ae7136383f6db8ffcd 100644
--- a/src/App.jsx
+++ b/src/App.jsx
@@ -1,134 +1,849 @@
-import { useEffect, useRef, useState } from "react";
+import { useEffect, useMemo, useRef, useState } from "react";
 import { Stage, Layer, Text, Image, Transformer } from "react-konva";
+import Konva from "konva";
 import useImage from "use-image";
+import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
 
-const WIDTH = 842;
-const HEIGHT = 595;
+const WIDTH = 595;
+const HEIGHT = 842;
+
+const TEMPLATE_OPTIONS = [
+  {
+    id: "professional",
+    label: "Professional (Blue)",
+    url: "https://cdn.budgetwonders.eu/templates/professional.png"
+  },
+  {
+    id: "classic",
+    label: "Classic (Gold)",
+    url: "https://cdn.budgetwonders.eu/templates/professional.png"
+  },
+  {
+    id: "playful",
+    label: "Playful (Kids)",
+    url: "https://cdn.budgetwonders.eu/templates/professional.png"
+  },
+  {
+    id: "custom",
+    label: "Custom URL",
+    url: ""
+  }
+];
+
+const FONT_OPTIONS = [
+  { id: "playfair", label: "Playfair Display", family: "Times New Roman", type: "serif" },
+  { id: "merriweather", label: "Merriweather", family: "Times New Roman", type: "serif" },
+  { id: "lora", label: "Lora", family: "Times New Roman", type: "serif" },
+  { id: "garamond", label: "Garamond", family: "Times New Roman", type: "serif" },
+  { id: "baskerville", label: "Libre Baskerville", family: "Times New Roman", type: "serif" },
+  { id: "eb-garamond", label: "EB Garamond", family: "Times New Roman", type: "serif" },
+  { id: "cormorant", label: "Cormorant Garamond", family: "Times New Roman", type: "serif" },
+  { id: "alegreya", label: "Alegreya", family: "Times New Roman", type: "serif" },
+  { id: "montserrat", label: "Montserrat", family: "Helvetica", type: "sans" },
+  { id: "poppins", label: "Poppins", family: "Helvetica", type: "sans" },
+  { id: "raleway", label: "Raleway", family: "Helvetica", type: "sans" },
+  { id: "nunito", label: "Nunito", family: "Helvetica", type: "sans" },
+  { id: "oswald", label: "Oswald", family: "Helvetica", type: "sans" },
+  { id: "roboto", label: "Roboto Slab", family: "Helvetica", type: "sans" },
+  { id: "cinzel", label: "Cinzel", family: "Times New Roman", type: "serif" },
+  { id: "crimson", label: "Crimson Text", family: "Times New Roman", type: "serif" },
+  { id: "georgia", label: "Georgia", family: "Times New Roman", type: "serif" },
+  { id: "palatino", label: "Palatino", family: "Times New Roman", type: "serif" },
+  { id: "gill", label: "Gill Sans", family: "Helvetica", type: "sans" },
+  { id: "courier", label: "Classic Typewriter", family: "Courier New", type: "mono" }
+];
+
+const DEFAULT_FONT = FONT_OPTIONS[0];
 
 export default function App() {
   const stageRef = useRef(null);
   const transformerRef = useRef(null);
 
-  const [selectedId, setSelectedId] = useState(null);
+  const [selectedId, setSelectedId] = useState("certTitle");
 
   const [fields, setFields] = useState([
     {
       id: "certTitle",
+      label: "Certificate Heading",
       text: "Certificate of Achievement",
       x: WIDTH / 2,
-      y: 120,
+      y: 140,
       fontSize: 40,
       fontStyle: "bold",
+      fontFamily: DEFAULT_FONT.family,
+      fontKey: DEFAULT_FONT.id,
       fill: "#1e2233",
       align: "center"
     },
     {
-      id: "name",
+      id: "recipientName",
+      label: "Recipient Name",
       text: "John Doe",
       x: WIDTH / 2,
-      y: 300,
+      y: 360,
       fontSize: 34,
       fontStyle: "bold",
-      fill: "#111"
+      fontFamily: DEFAULT_FONT.family,
+      fontKey: DEFAULT_FONT.id,
+      fill: "#111",
+      align: "center"
+    },
+    {
+      id: "awardTitle",
+      label: "Award Title",
+      text: "Outstanding Participation",
+      x: WIDTH / 2,
+      y: 430,
+      fontSize: 22,
+      fontStyle: "normal",
+      fontFamily: DEFAULT_FONT.family,
+      fontKey: DEFAULT_FONT.id,
+      fill: "#333",
+      align: "center"
+    }
+  ]);
+
+  const [selectedTemplateId, setSelectedTemplateId] = useState(
+    TEMPLATE_OPTIONS[0].id
+  );
+  const [customTemplateUrl, setCustomTemplateUrl] = useState(
+    TEMPLATE_OPTIONS[0].url
+  );
+
+  const resolvedTemplateUrl =
+    selectedTemplateId === "custom"
+      ? customTemplateUrl
+      : TEMPLATE_OPTIONS.find((template) => template.id === selectedTemplateId)
+          ?.url ?? "";
+
+  const [bgImage] = useImage(resolvedTemplateUrl);
+
+  const [entries, setEntries] = useState([
+    {
+      id: crypto.randomUUID(),
+      name: "John Doe",
+      title: "Outstanding Participation"
     }
   ]);
+  const [activeEntryId, setActiveEntryId] = useState(entries[0]?.id);
+  const [manualName, setManualName] = useState("");
+  const [manualTitle, setManualTitle] = useState("");
 
-  const templateUrl =
-    "https://cdn.budgetwonders.eu/templates/professional.png";
+  const activeEntry = useMemo(
+    () => entries.find((entry) => entry.id === activeEntryId) ?? entries[0],
+    [entries, activeEntryId]
+  );
 
-  const [bgImage] = useImage(templateUrl);
+  const selectedField = fields.find((field) => field.id === selectedId);
 
   useEffect(() => {
     if (selectedId && transformerRef.current) {
-      const node = stageRef.current.findOne(`#${selectedId}`);
-      transformerRef.current.nodes([node]);
-      transformerRef.current.getLayer().batchDraw();
+      const node = stageRef.current?.findOne(`#${selectedId}`);
+      if (node) {
+        transformerRef.current.nodes([node]);
+        transformerRef.current.getLayer().batchDraw();
+      }
     }
   }, [selectedId]);
 
   function updateField(id, newAttrs) {
     setFields((prev) =>
       prev.map((f) => (f.id === id ? { ...f, ...newAttrs } : f))
     );
   }
 
-  function handleExport() {
-    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
-    downloadImage(uri);
+  function handleTemplateSelect(event) {
+    setSelectedTemplateId(event.target.value);
+  }
+
+  function handleCustomTemplateChange(event) {
+    setCustomTemplateUrl(event.target.value.trim());
+  }
+
+  function handleAddEntry() {
+    if (!manualName.trim()) {
+      return;
+    }
+    const newEntry = {
+      id: crypto.randomUUID(),
+      name: manualName.trim(),
+      title: manualTitle.trim() || "Participant"
+    };
+    setEntries((prev) => [...prev, newEntry]);
+    setManualName("");
+    setManualTitle("");
+    setActiveEntryId(newEntry.id);
   }
 
-  function downloadImage(uri) {
+  function handleRemoveEntry(entryId) {
+    setEntries((prev) => {
+      const remaining = prev.filter((entry) => entry.id !== entryId);
+      if (activeEntryId === entryId) {
+        setActiveEntryId(remaining[0]?.id ?? null);
+      }
+      return remaining;
+    });
+  }
+
+  function handleBatchUpload(event) {
+    const file = event.target.files?.[0];
+    if (!file) {
+      return;
+    }
+    const reader = new FileReader();
+    reader.onload = () => {
+      const text = reader.result;
+      if (typeof text !== "string") {
+        return;
+      }
+      const parsedEntries = parseCsv(text);
+      if (parsedEntries.length) {
+        setEntries((prev) => [...prev, ...parsedEntries]);
+        setActiveEntryId(parsedEntries[0].id);
+      }
+    };
+    reader.readAsText(file);
+    event.target.value = "";
+  }
+
+  function parseCsv(text) {
+    const lines = text
+      .split(/\r?\n/)
+      .map((line) => line.trim())
+      .filter(Boolean);
+    if (!lines.length) {
+      return [];
+    }
+    const delimiter = lines[0].includes("\t") ? "\t" : ",";
+    const rows = lines.map((line) =>
+      line
+        .split(delimiter)
+        .map((cell) => cell.trim().replace(/^"|"$/g, ""))
+    );
+    const header = rows[0].map((cell) => cell.toLowerCase());
+    const hasHeader = header.includes("name") || header.includes("title");
+    const dataRows = hasHeader ? rows.slice(1) : rows;
+    const nameIndex = hasHeader ? header.indexOf("name") : 0;
+    const titleIndex = hasHeader ? header.indexOf("title") : 1;
+
+    return dataRows
+      .map((row) => ({
+        id: crypto.randomUUID(),
+        name: row[nameIndex] ?? "",
+        title: row[titleIndex] ?? ""
+      }))
+      .filter((entry) => entry.name.trim().length > 0);
+  }
+
+  async function handleGeneratePdf() {
+    if (!entries.length || !resolvedTemplateUrl) {
+      return;
+    }
+    const pdfDoc = await PDFDocument.create();
+    const templateBytes = await fetch(resolvedTemplateUrl).then((res) =>
+      res.arrayBuffer()
+    );
+    const isPng = resolvedTemplateUrl.toLowerCase().includes(".png");
+    const templateImage = isPng
+      ? await pdfDoc.embedPng(templateBytes)
+      : await pdfDoc.embedJpg(templateBytes);
+
+    const embeddedFonts = new Map();
+    const resolveFont = async (field) => {
+      const fontKey = `${field.fontKey}-${field.fontStyle}`;
+      if (embeddedFonts.has(fontKey)) {
+        return embeddedFonts.get(fontKey);
+      }
+      const fontOption = FONT_OPTIONS.find((font) => font.id === field.fontKey);
+      const style = field.fontStyle === "italic" ? "italic" : field.fontStyle;
+      const pdfFontName = resolvePdfFontName(fontOption?.type, style);
+      const pdfFont = await pdfDoc.embedFont(pdfFontName);
+      embeddedFonts.set(fontKey, pdfFont);
+      return pdfFont;
+    };
+
+    for (const entry of entries) {
+      const page = pdfDoc.addPage([WIDTH, HEIGHT]);
+      page.drawImage(templateImage, {
+        x: 0,
+        y: 0,
+        width: WIDTH,
+        height: HEIGHT
+      });
+
+      const resolvedFields = fields.map((field) => ({
+        ...field,
+        text:
+          field.id === "recipientName"
+            ? entry.name
+            : field.id === "awardTitle"
+              ? entry.title
+              : field.text
+      }));
+
+      for (const field of resolvedFields) {
+        const font = await resolveFont(field);
+        const textWidth = font.widthOfTextAtSize(field.text, field.fontSize);
+        const drawX = getAlignedX(field, textWidth);
+        const drawY = HEIGHT - field.y - field.fontSize;
+        const color = hexToRgb(field.fill);
+        page.drawText(field.text, {
+          x: drawX,
+          y: drawY,
+          size: field.fontSize,
+          font,
+          color: rgb(color.r, color.g, color.b)
+        });
+      }
+    }
+
+    const pdfBytes = await pdfDoc.save();
+    const blob = new Blob([pdfBytes], { type: "application/pdf" });
+    const url = URL.createObjectURL(blob);
     const link = document.createElement("a");
-    link.download = "certificate.png";
-    link.href = uri;
+    link.href = url;
+    link.download = "certificates-batch.pdf";
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
+    URL.revokeObjectURL(url);
+  }
+
+  function handleFieldInput(fieldId, key, value) {
+    updateField(fieldId, { [key]: value });
+  }
+
+  function handleFontChange(fieldId, fontKey) {
+    const font = FONT_OPTIONS.find((option) => option.id === fontKey);
+    if (!font) {
+      return;
+    }
+    updateField(fieldId, { fontKey, fontFamily: font.family });
+  }
+
+  function getAlignedX(field, textWidth) {
+    if (field.align === "center") {
+      return field.x - textWidth / 2;
+    }
+    if (field.align === "right") {
+      return field.x - textWidth;
+    }
+    return field.x;
+  }
+
+  function getTextWidth(field, text) {
+    const sample = new Konva.Text({
+      text,
+      fontSize: field.fontSize,
+      fontFamily: field.fontFamily,
+      fontStyle: field.fontStyle
+    });
+    return sample.width();
   }
 
   return (
-    <div style={{ padding: 40 }}>
-      <h1>Certifyly Editor</h1>
-
-      <button onClick={handleExport}>Export PNG</button>
-
-      <div style={{ marginTop: 20 }}>
-        <Stage
-          width={WIDTH}
-          height={HEIGHT}
-          ref={stageRef}
-          style={{
-            border: "1px solid #ddd",
-            boxShadow: "0 20px 40px rgba(0,0,0,0.1)"
-          }}
-          onMouseDown={(e) => {
-            if (e.target === e.target.getStage()) {
-              setSelectedId(null);
-            }
-          }}
-        >
-          <Layer>
-            {bgImage && (
-              <Image image={bgImage} width={WIDTH} height={HEIGHT} />
-            )}
+    <div style={{ padding: 40, fontFamily: "Inter, system-ui, sans-serif" }}>
+      <header style={{ marginBottom: 24 }}>
+        <h1 style={{ fontSize: 32, marginBottom: 6 }}>
+          Bulk Certificate Generator
+        </h1>
+        <p style={{ marginTop: 0, color: "#4f5565", maxWidth: 720 }}>
+          Choose a template, add learners manually or via CSV, fine-tune your text
+          styling, and export a full A4 batch PDF with a matching live preview.
+        </p>
+      </header>
 
-            {fields.map((field) => (
-              <Text
-                key={field.id}
-                id={field.id}
-                {...field}
-                draggable
-                onClick={() => setSelectedId(field.id)}
-                onTap={() => setSelectedId(field.id)}
-                onDragEnd={(e) =>
-                  updateField(field.id, {
-                    x: e.target.x(),
-                    y: e.target.y()
-                  })
-                }
-                onTransformEnd={(e) => {
-                  const node = e.target;
-                  const scaleX = node.scaleX();
-                  updateField(field.id, {
-                    x: node.x(),
-                    y: node.y(),
-                    fontSize: Math.max(12, field.fontSize * scaleX)
-                  });
-                  node.scaleX(1);
-                  node.scaleY(1);
-                }}
-              />
+      <div
+        style={{
+          display: "grid",
+          gridTemplateColumns: "minmax(300px, 380px) 1fr",
+          gap: 32,
+          alignItems: "start"
+        }}
+      >
+        <section style={panelStyle}>
+          <h2 style={sectionTitleStyle}>Template & Batch</h2>
+
+          <label style={labelStyle}>Template selection</label>
+          <select
+            value={selectedTemplateId}
+            onChange={handleTemplateSelect}
+            style={inputStyle}
+          >
+            {TEMPLATE_OPTIONS.map((template) => (
+              <option key={template.id} value={template.id}>
+                {template.label}
+              </option>
             ))}
+          </select>
 
-            <Transformer
-              ref={transformerRef}
-              enabledAnchors={["middle-left", "middle-right"]}
-              rotateEnabled={false}
+          {selectedTemplateId === "custom" && (
+            <input
+              type="url"
+              value={customTemplateUrl}
+              onChange={handleCustomTemplateChange}
+              placeholder="https://your-r2-bucket/template.png"
+              style={inputStyle}
             />
-          </Layer>
-        </Stage>
+          )}
+
+          <div style={{ marginTop: 16 }}>
+            <label style={labelStyle}>Upload CSV batch (name, title)</label>
+            <input
+              type="file"
+              accept=".csv,.tsv,text/csv"
+              onChange={handleBatchUpload}
+              style={{ marginTop: 6 }}
+            />
+            <p style={helperTextStyle}>
+              CSV headers supported: name, title. TSV also accepted.
+            </p>
+          </div>
+
+          <div style={{ marginTop: 16 }}>
+            <h3 style={subTitleStyle}>Add a learner manually</h3>
+            <input
+              type="text"
+              value={manualName}
+              onChange={(event) => setManualName(event.target.value)}
+              placeholder="Learner name"
+              style={inputStyle}
+            />
+            <input
+              type="text"
+              value={manualTitle}
+              onChange={(event) => setManualTitle(event.target.value)}
+              placeholder="Award title (optional)"
+              style={inputStyle}
+            />
+            <button onClick={handleAddEntry} style={primaryButtonStyle}>
+              Add to batch
+            </button>
+          </div>
+
+          <div style={{ marginTop: 18 }}>
+            <h3 style={subTitleStyle}>Batch list ({entries.length})</h3>
+            <div style={listStyle}>
+              {entries.map((entry, index) => (
+                <div
+                  key={entry.id}
+                  style={{
+                    ...listItemStyle,
+                    border:
+                      activeEntryId === entry.id
+                        ? "1px solid #2563eb"
+                        : "1px solid #e2e8f0",
+                    background:
+                      activeEntryId === entry.id ? "#eff6ff" : "#f8fafc"
+                  }}
+                >
+                  <button
+                    type="button"
+                    onClick={() => setActiveEntryId(entry.id)}
+                    style={listButtonStyle}
+                  >
+                    <div style={{ fontWeight: 600, fontSize: 13 }}>
+                      {index + 1}. {entry.name}
+                    </div>
+                    <div style={{ fontSize: 12, color: "#64748b" }}>
+                      {entry.title || "Participant"}
+                    </div>
+                  </button>
+                  <button
+                    type="button"
+                    onClick={() => handleRemoveEntry(entry.id)}
+                    style={removeButtonStyle}
+                  >
+                    Remove
+                  </button>
+                </div>
+              ))}
+            </div>
+          </div>
+
+          <button onClick={handleGeneratePdf} style={darkButtonStyle}>
+            Generate batch PDF
+          </button>
+        </section>
+
+        <section style={{ display: "grid", gap: 20 }}>
+          <div style={panelStyle}>
+            <h2 style={sectionTitleStyle}>Text Styling</h2>
+            <p style={helperTextStyle}>
+              Select a text field on the preview to adjust its font, size, color,
+              and placement.
+            </p>
+
+            <label style={labelStyle}>Selected field</label>
+            <select
+              value={selectedId ?? ""}
+              onChange={(event) => setSelectedId(event.target.value)}
+              style={inputStyle}
+            >
+              {!selectedId && (
+                <option value="" disabled>
+                  Select a field
+                </option>
+              )}
+              {fields.map((field) => (
+                <option key={field.id} value={field.id}>
+                  {field.label}
+                </option>
+              ))}
+            </select>
+
+            {selectedField && (
+              <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
+                <div>
+                  <label style={labelStyle}>Text content</label>
+                  <input
+                    type="text"
+                    value={selectedField.text}
+                    onChange={(event) =>
+                      handleFieldInput(selectedField.id, "text", event.target.value)
+                    }
+                    style={inputStyle}
+                  />
+                </div>
+
+                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
+                  <div>
+                    <label style={labelStyle}>Font size</label>
+                    <input
+                      type="number"
+                      min="10"
+                      max="120"
+                      value={selectedField.fontSize}
+                      onChange={(event) =>
+                        handleFieldInput(
+                          selectedField.id,
+                          "fontSize",
+                          Number(event.target.value)
+                        )
+                      }
+                      style={inputStyle}
+                    />
+                  </div>
+                  <div>
+                    <label style={labelStyle}>Font style</label>
+                    <select
+                      value={selectedField.fontStyle}
+                      onChange={(event) =>
+                        handleFieldInput(
+                          selectedField.id,
+                          "fontStyle",
+                          event.target.value
+                        )
+                      }
+                      style={inputStyle}
+                    >
+                      <option value="normal">Regular</option>
+                      <option value="bold">Bold</option>
+                      <option value="italic">Italic</option>
+                    </select>
+                  </div>
+                </div>
+
+                <div>
+                  <label style={labelStyle}>Font family</label>
+                  <select
+                    value={selectedField.fontKey}
+                    onChange={(event) =>
+                      handleFontChange(selectedField.id, event.target.value)
+                    }
+                    style={inputStyle}
+                  >
+                    {FONT_OPTIONS.map((font) => (
+                      <option key={font.id} value={font.id}>
+                        {font.label}
+                      </option>
+                    ))}
+                  </select>
+                </div>
+
+                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
+                  <div>
+                    <label style={labelStyle}>Text color</label>
+                    <input
+                      type="color"
+                      value={selectedField.fill}
+                      onChange={(event) =>
+                        handleFieldInput(selectedField.id, "fill", event.target.value)
+                      }
+                      style={{ ...inputStyle, padding: 6, height: 44 }}
+                    />
+                  </div>
+                  <div>
+                    <label style={labelStyle}>Alignment</label>
+                    <select
+                      value={selectedField.align}
+                      onChange={(event) =>
+                        handleFieldInput(selectedField.id, "align", event.target.value)
+                      }
+                      style={inputStyle}
+                    >
+                      <option value="left">Left</option>
+                      <option value="center">Center</option>
+                      <option value="right">Right</option>
+                    </select>
+                  </div>
+                </div>
+
+                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
+                  <div>
+                    <label style={labelStyle}>X position</label>
+                    <input
+                      type="number"
+                      value={Math.round(selectedField.x)}
+                      onChange={(event) =>
+                        handleFieldInput(
+                          selectedField.id,
+                          "x",
+                          Number(event.target.value)
+                        )
+                      }
+                      style={inputStyle}
+                    />
+                  </div>
+                  <div>
+                    <label style={labelStyle}>Y position</label>
+                    <input
+                      type="number"
+                      value={Math.round(selectedField.y)}
+                      onChange={(event) =>
+                        handleFieldInput(
+                          selectedField.id,
+                          "y",
+                          Number(event.target.value)
+                        )
+                      }
+                      style={inputStyle}
+                    />
+                  </div>
+                </div>
+              </div>
+            )}
+          </div>
+
+          <div>
+            <div style={{ marginBottom: 12 }}>
+              <h2 style={{ fontSize: 18, marginBottom: 4 }}>Live Preview</h2>
+              <p style={helperTextStyle}>
+                Previewing certificate for:{" "}
+                <strong>{activeEntry?.name ?? "No entry selected"}</strong>
+              </p>
+            </div>
+            <Stage
+              width={WIDTH}
+              height={HEIGHT}
+              ref={stageRef}
+              style={{
+                border: "1px solid #e2e8f0",
+                boxShadow: "0 20px 40px rgba(15, 23, 42, 0.12)",
+                borderRadius: 16,
+                background: "#ffffff",
+                margin: "0 auto"
+              }}
+              onMouseDown={(e) => {
+                if (e.target === e.target.getStage()) {
+                  setSelectedId(null);
+                }
+              }}
+            >
+              <Layer>
+                {bgImage && (
+                  <Image image={bgImage} width={WIDTH} height={HEIGHT} />
+                )}
+
+                {fields.map((field) => {
+                  const resolvedText =
+                    field.id === "recipientName"
+                      ? activeEntry?.name ?? field.text
+                      : field.id === "awardTitle"
+                        ? activeEntry?.title ?? field.text
+                        : field.text;
+                  const textWidth = getTextWidth(field, resolvedText);
+
+                  return (
+                    <Text
+                      key={field.id}
+                      id={field.id}
+                      {...field}
+                      text={resolvedText}
+                      draggable
+                      offsetX={
+                        field.align === "center"
+                          ? textWidth / 2
+                          : field.align === "right"
+                            ? textWidth
+                            : 0
+                      }
+                      onClick={() => setSelectedId(field.id)}
+                      onTap={() => setSelectedId(field.id)}
+                      onDragEnd={(e) =>
+                        updateField(field.id, {
+                          x: e.target.x(),
+                          y: e.target.y()
+                        })
+                      }
+                      onTransformEnd={(e) => {
+                        const node = e.target;
+                        const scaleX = node.scaleX();
+                        updateField(field.id, {
+                          x: node.x(),
+                          y: node.y(),
+                          fontSize: Math.max(12, field.fontSize * scaleX)
+                        });
+                        node.scaleX(1);
+                        node.scaleY(1);
+                      }}
+                    />
+                  );
+                })}
+
+                {selectedId && (
+                  <Transformer
+                    ref={transformerRef}
+                    enabledAnchors={["middle-left", "middle-right"]}
+                    rotateEnabled={false}
+                  />
+                )}
+              </Layer>
+            </Stage>
+          </div>
+        </section>
       </div>
     </div>
   );
 }
 
+function hexToRgb(hex) {
+  const sanitized = hex.replace("#", "");
+  const value = sanitized.length === 3
+    ? sanitized
+        .split("")
+        .map((char) => char + char)
+        .join("")
+    : sanitized;
+  const bigint = parseInt(value, 16);
+  const r = (bigint >> 16) & 255;
+  const g = (bigint >> 8) & 255;
+  const b = bigint & 255;
+  return { r: r / 255, g: g / 255, b: b / 255 };
+}
+
+function resolvePdfFontName(type, style) {
+  if (type === "mono") {
+    if (style === "bold") return StandardFonts.CourierBold;
+    if (style === "italic") return StandardFonts.CourierOblique;
+    return StandardFonts.Courier;
+  }
+  if (type === "serif") {
+    if (style === "bold") return StandardFonts.TimesBold;
+    if (style === "italic") return StandardFonts.TimesItalic;
+    return StandardFonts.TimesRoman;
+  }
+  if (style === "bold") return StandardFonts.HelveticaBold;
+  if (style === "italic") return StandardFonts.HelveticaOblique;
+  return StandardFonts.Helvetica;
+}
+
+const panelStyle = {
+  background: "#ffffff",
+  borderRadius: 18,
+  padding: 20,
+  boxShadow: "0 16px 36px rgba(15, 23, 42, 0.08)",
+  border: "1px solid #e2e8f0"
+};
+
+const sectionTitleStyle = {
+  fontSize: 18,
+  marginBottom: 12
+};
+
+const subTitleStyle = {
+  fontSize: 14,
+  marginBottom: 8
+};
+
+const labelStyle = {
+  display: "block",
+  fontSize: 12,
+  fontWeight: 600,
+  color: "#6b7280",
+  textTransform: "uppercase",
+  letterSpacing: "0.06em"
+};
+
+const helperTextStyle = {
+  fontSize: 12,
+  color: "#94a3b8",
+  marginTop: 6
+};
+
+const inputStyle = {
+  width: "100%",
+  marginTop: 8,
+  padding: "10px 12px",
+  borderRadius: 12,
+  border: "1px solid #e2e8f0",
+  fontSize: 14,
+  background: "#f8fafc"
+};
+
+const listStyle = {
+  display: "flex",
+  flexDirection: "column",
+  gap: 8,
+  maxHeight: 220,
+  overflowY: "auto",
+  paddingRight: 4
+};
+
+const listItemStyle = {
+  display: "flex",
+  alignItems: "center",
+  justifyContent: "space-between",
+  padding: "8px 10px",
+  borderRadius: 12
+};
+
+const listButtonStyle = {
+  background: "transparent",
+  border: "none",
+  textAlign: "left",
+  cursor: "pointer",
+  flex: 1
+};
+
+const removeButtonStyle = {
+  border: "none",
+  background: "transparent",
+  color: "#ef4444",
+  cursor: "pointer",
+  fontSize: 12
+};
+
+const primaryButtonStyle = {
+  marginTop: 10,
+  padding: "10px 16px",
+  background: "#2563eb",
+  color: "white",
+  border: "none",
+  borderRadius: 12,
+  cursor: "pointer",
+  width: "100%",
+  fontWeight: 600
+};
+
+const darkButtonStyle = {
+  marginTop: 20,
+  padding: "12px 16px",
+  background: "#0f172a",
+  color: "white",
+  border: "none",
+  borderRadius: 12,
+  cursor: "pointer",
+  width: "100%",
+  fontWeight: 600
+};
 
EOF
)


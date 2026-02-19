import React, { useState, useRef, useEffect, useMemo } from "react";

import ControlPanel from "./ControlPanel";
import CanvasPreview from "./CanvasPreview";
import Inspector from "./Inspector";
import ExportPanel from "./ExportPanel";

import { SIZES, FONT_OPTIONS } from "../../lib/constants";
import { parseCsv, parseTxt } from "../../lib/parsers";
import { ensureFontLink, ensureFontLoaded, loadImageWithCORS } from "../../lib/templates";
import { exportPdfFromStage, exportZipPngFromStage } from "../../lib/export";

export default function CertificateEditor({ templates, onAddCustomTemplate }) {
  useEffect(() => ensureFontLink(), []);

  // Paper & Template
  const [paper, setPaper] = useState("A4");
  const [customSize, setCustomSize] = useState({ w: 842, h: 595 });
  const { w: CW, h: CH } = paper === "CUSTOM" ? customSize : SIZES[paper];
  const [templateKey, setTemplateKey] = useState("");
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.key === templateKey) || null,
    [templates, templateKey]
  );

  // Auto-select first template when templates load
  useEffect(() => {
    if (!templateKey && templates.length > 0) {
      setTemplateKey(templates[0].key);
    }
  }, [templates, templateKey]);

  // Background image with CORS support
  const [bg, setBg] = useState(null);
  const [bgLoading, setBgLoading] = useState(false);
  
  // ✅ Load background image with CORS
  useEffect(() => {
    if (!selectedTemplate?.url) {
      setBg(null);
      return;
    }

    let cancelled = false;
    setBgLoading(true);
    setError("");

    loadImageWithCORS(selectedTemplate.url)
      .then((img) => {
        if (!cancelled) {
          setBg(img);
          
          // If paper is set to CUSTOM, update canvas size to match image
          if (paper === "CUSTOM") {
            setCustomSize({ w: img.width, h: img.height });
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load template:", err);
          setBg(null);
          setError(
            "Could not load template for export (CORS error). " +
            "The template will display in preview but may not export. " +
            "Ask your admin to enable CORS on the CDN or use the proxy endpoint."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setBgLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTemplate, paper]);

  // Input mode
  const [inputMode, setInputMode] = useState("manual");
  const [uploadFile, setUploadFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [manualRows, setManualRows] = useState([
    { name: "John Doe", award: "Outstanding Achievement" },
  ]);

  // Global texts
  const [certTitle, setCertTitle] = useState("Certificate of Achievement");
  const [subtitle, setSubtitle] = useState("This certifies that");
  const [description, setDescription] = useState("has successfully completed the requirements and is hereby awarded");
  const [dateText, setDateText] = useState(new Date().toISOString().slice(0, 10));
  const [issuerText, setIssuerText] = useState("Issuer Organization");

  // Canvas state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const [selectedId, setSelectedId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editorValue, setEditorValue] = useState("");
  const [editorRect, setEditorRect] = useState(null);

  // Fields
  const [fields, setFields] = useState(() => [
    {
      id: "certTitle",
      text: "Certificate of Achievement",
      x: CW / 2,
      y: 110,
      fontFamily: "Cinzel",
      fontSize: 52,
      fontStyle: "bold",
      fill: "#1a1a2e",
      align: "center",
      width: 760,
    },
    {
      id: "subtitle",
      text: "This certifies that",
      x: CW / 2,
      y: 180,
      fontFamily: "EB Garamond",
      fontSize: 18,
      fontStyle: "normal",
      fill: "#6b7280",
      align: "center",
      width: 760,
    },
    {
      id: "name",
      text: "John Doe",
      x: CW / 2,
      y: 280,
      fontFamily: "Playfair Display",
      fontSize: 48,
      fontStyle: "bold",
      fill: "#1a1a2e",
      align: "center",
      width: 760,
    },
    {
      id: "description",
      text: "has successfully completed the requirements and is hereby awarded",
      x: CW / 2,
      y: 345,
      fontFamily: "EB Garamond",
      fontSize: 16,
      fontStyle: "normal",
      fill: "#6b7280",
      align: "center",
      width: 700,
    },
    {
      id: "award",
      text: "Outstanding Achievement",
      x: CW / 2,
      y: 400,
      fontFamily: "Playfair Display",
      fontSize: 24,
      fontStyle: "bold italic",
      fill: "#2d3748",
      align: "center",
      width: 760,
    },
    {
      id: "date",
      text: `Date: ${new Date().toISOString().slice(0, 10)}`,
      x: 115,
      y: 540,
      fontFamily: "EB Garamond",
      fontSize: 14,
      fontStyle: "normal",
      fill: "#6b7280",
      align: "left",
      width: 260,
    },
    {
      id: "issuer",
      text: "Issuer Organization",
      x: 680,
      y: 540,
      fontFamily: "EB Garamond",
      fontSize: 16,
      fontStyle: "normal",
      fill: "#1a1a2e",
      align: "right",
      width: 300,
    },
  ]);

  function updateField(id, patch) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  // Sync global texts to fields
  useEffect(() => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id === "certTitle") return { ...f, text: certTitle };
        if (f.id === "subtitle") return { ...f, text: subtitle };
        if (f.id === "description") return { ...f, text: description };
        return f;
      })
    );
  }, [certTitle, subtitle, description]);

  // Sample row for preview
  const sampleRow = useMemo(() => {
    if (inputMode === "manual") {
      const firstValid = manualRows.find((r) => r.name?.trim() && r.award?.trim());
      return firstValid || { name: "John Doe", award: "Outstanding Achievement", date: dateText, issuer: issuerText };
    }
    return rows[0] || { name: "John Doe", award: "Outstanding Achievement", date: dateText, issuer: issuerText };
  }, [inputMode, manualRows, dateText, issuerText, rows]);

  // Sync row data to canvas
  useEffect(() => {
    const effectiveDate = sampleRow.date || dateText;
    const effectiveIssuer = sampleRow.issuer || issuerText;

    setFields((prev) =>
      prev.map((f) => {
        if (f.id === "name") return { ...f, text: sampleRow.name || "" };
        if (f.id === "award") return { ...f, text: sampleRow.award || "" };
        if (f.id === "date") return { ...f, text: effectiveDate ? `Date: ${effectiveDate}` : "" };
        if (f.id === "issuer") return { ...f, text: effectiveIssuer || "" };
        return f;
      })
    );
  }, [sampleRow, dateText, issuerText]);

  // File upload handler
  async function handleFileUpload(file) {
    if (!file) return;
    
    const validTypes = ['text/plain', 'text/csv', 'application/csv'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validTypes.includes(file.type) && !['.txt', '.csv'].includes(ext)) {
      setError('Please upload a .txt or .csv file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large (max 5MB)');
      return;
    }

    try {
      const text = await file.text();
      const parsed = ext === ".csv" ? parseCsv(text) : parseTxt(text);
      
      if (!parsed || parsed.length === 0) {
        setError("No valid data found in file");
        return;
      }
      
      setRows(parsed);
      setUploadFile(file);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to parse file");
    }
  }

  // Text editor overlay
  function openEditorFor(fieldId) {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;

    const stage = stageRef.current;
    const node = stage?.findOne(`#${fieldId}`);
    if (!node) return;

    const box = node.getClientRect();
    setEditorRect(box);
    setEditingId(fieldId);
    setEditorValue(field.text);
  }

  function closeEditor() {
    if (editingId && editorValue !== undefined) {
      updateField(editingId, { text: editorValue });
    }
    setEditingId("");
    setEditorValue("");
    setEditorRect(null);
  }

  // Export handlers
  async function handleExportPdf() {
    setBusy(true);
    setError("");
    setProgress({ done: 0, total: 0 });
    try {
      const exportRows = inputMode === "manual" 
        ? manualRows.filter(r => r.name?.trim() && r.award?.trim())
        : rows;

      if (exportRows.length === 0) {
        setError("No data to export");
        return;
      }

      setProgress({ done: 0, total: exportRows.length });

      await exportPdfFromStage({
        rows: exportRows,
        cw: CW,
        ch: CH,
        stageRef,
        transformerRef,
        selectedId,
        setSelectedId,
        editingId,
        closeEditor,
        onProgress: (done, total) => setProgress({ done, total }),
        beforeEachRow: async (row) => {
          setFields((prev) =>
            prev.map((f) => {
              if (f.id === "name") return { ...f, text: row.name || "" };
              if (f.id === "award") return { ...f, text: row.award || "" };
              if (f.id === "date") return { ...f, text: row.date ? `Date: ${row.date}` : `Date: ${dateText}` };
              if (f.id === "issuer") return { ...f, text: row.issuer || issuerText };
              return f;
            })
          );
        },
        afterExportRestore: () => {
          setFields((prev) =>
            prev.map((f) => {
              if (f.id === "name") return { ...f, text: sampleRow.name || "" };
              if (f.id === "award") return { ...f, text: sampleRow.award || "" };
              if (f.id === "date") return { ...f, text: sampleRow.date ? `Date: ${sampleRow.date}` : `Date: ${dateText}` };
              if (f.id === "issuer") return { ...f, text: sampleRow.issuer || issuerText };
              return f;
            })
          );
        },
      });
    } catch (err) {
      setError(err.message || "Export failed");
    } finally {
      setBusy(false);
      setProgress({ done: 0, total: 0 });
    }
  }

  async function handleExportZip() {
    setBusy(true);
    setError("");
    setProgress({ done: 0, total: 0 });
    try {
      const exportRows = inputMode === "manual" 
        ? manualRows.filter(r => r.name?.trim() && r.award?.trim())
        : rows;

      if (exportRows.length === 0) {
        setError("No data to export");
        return;
      }

      setProgress({ done: 0, total: exportRows.length });

      await exportZipPngFromStage({
        rows: exportRows,
        stageRef,
        transformerRef,
        selectedId,
        setSelectedId,
        editingId,
        closeEditor,
        onProgress: (done, total) => setProgress({ done, total }),
        beforeEachRow: async (row) => {
          setFields((prev) =>
            prev.map((f) => {
              if (f.id === "name") return { ...f, text: row.name || "" };
              if (f.id === "award") return { ...f, text: row.award || "" };
              if (f.id === "date") return { ...f, text: row.date ? `Date: ${row.date}` : `Date: ${dateText}` };
              if (f.id === "issuer") return { ...f, text: row.issuer || issuerText };
              return f;
            })
          );
        },
        afterExportRestore: () => {
          setFields((prev) =>
            prev.map((f) => {
              if (f.id === "name") return { ...f, text: sampleRow.name || "" };
              if (f.id === "award") return { ...f, text: sampleRow.award || "" };
              if (f.id === "date") return { ...f, text: sampleRow.date ? `Date: ${sampleRow.date}` : `Date: ${dateText}` };
              if (f.id === "issuer") return { ...f, text: sampleRow.issuer || issuerText };
              return f;
            })
          );
        },
      });
    } catch (err) {
      setError(err.message || "Export failed");
    } finally {
      setBusy(false);
      setProgress({ done: 0, total: 0 });
    }
  }

  const selectedField = fields.find((f) => f.id === selectedId);

  return (
    <div className="editor-layout">
      <ControlPanel
        paper={paper}
        setPaper={setPaper}
        templates={templates}
        onAddCustomTemplate={onAddCustomTemplate}
        templateKey={templateKey}
        setTemplateKey={setTemplateKey}
        inputMode={inputMode}
        setInputMode={setInputMode}
        manualRows={manualRows}
        setManualRows={setManualRows}
        uploadFile={uploadFile}
        handleFileUpload={handleFileUpload}
        certTitle={certTitle}
        setCertTitle={setCertTitle}
        subtitle={subtitle}
        setSubtitle={setSubtitle}
        description={description}
        setDescription={setDescription}
        dateText={dateText}
        setDateText={setDateText}
        issuerText={issuerText}
        setIssuerText={setIssuerText}
        error={error}
      />

      <CanvasPreview
        cw={CW}
        ch={CH}
        bg={bg}
        bgLoading={bgLoading}
        fields={fields}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        updateField={updateField}
        stageRef={stageRef}
        transformerRef={transformerRef}
        openEditorFor={openEditorFor}
        editingId={editingId}
        editorValue={editorValue}
        setEditorValue={setEditorValue}
        closeEditor={closeEditor}
        editorRect={editorRect}
        paper={paper}
      />

      <div className="right-panels">
        <Inspector
          selectedField={selectedField}
          updateField={updateField}
          fontOptions={FONT_OPTIONS}
          stageRef={stageRef}
          ensureFontLoaded={ensureFontLoaded}
          CW={CW}
        />

        <ExportPanel
          inputMode={inputMode}
          manualRows={manualRows}
          rows={rows}
          busy={busy}
          progress={progress}
          handleExportPdf={handleExportPdf}
          handleExportZip={handleExportZip}
        />
      </div>
    </div>
  );
}

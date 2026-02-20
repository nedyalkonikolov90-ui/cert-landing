import React, { useState, useRef, useEffect, useMemo } from "react";

import StepWizard from "./StepWizard";
import Step1Template from "./Step1Template";
import Step2Customize from "./Step2Customize";
import Step3Recipients from "./Step3Recipients";
import CanvasPreview from "./CanvasPreview";

import { SIZES, FONT_OPTIONS } from "../../lib/constants";
import { parseCsv, parseTxt } from "../../lib/parsers";
import { ensureFontLink, ensureFontLoaded, loadImageWithCORS } from "../../lib/templates";
import { exportPdfFromStage, exportZipPngFromStage } from "../../lib/export";

export default function CertificateEditor({ templates, onAddCustomTemplate }) {
  useEffect(() => ensureFontLink(), []);

  // ============================================================================
  // STEP WIZARD STATE
  // ============================================================================
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);

  const markStepComplete = (step) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps([...completedSteps, step]);
    }
  };

  const handleStep1Next = () => {
    markStepComplete(1);
    setCurrentStep(2);
  };

  const handleStep2Next = () => {
    markStepComplete(2);
    setCurrentStep(3);
  };

  const handleStep2Back = () => {
    setCurrentStep(1);
  };

  const handleStep3Back = () => {
    setCurrentStep(2);
  };

  // ============================================================================
  // PAPER & TEMPLATE
  // ============================================================================
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

  // ============================================================================
  // BACKGROUND IMAGE
  // ============================================================================
  const [bg, setBg] = useState(null);
  const [bgLoading, setBgLoading] = useState(false);
  const [error, setError] = useState("");

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

  // ============================================================================
  // RECIPIENTS INPUT
  // ============================================================================
  const [inputMode, setInputMode] = useState("manual");
  const [uploadFile, setUploadFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [manualRows, setManualRows] = useState([
    { name: "John Doe", award: "Outstanding Achievement" },
  ]);

  // Combined recipients list for export
  const recipients = useMemo(() => {
    if (inputMode === "manual") {
      return manualRows.filter(r => r.name?.trim() && r.award?.trim());
    }
    return rows;
  }, [inputMode, manualRows, rows]);

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

  // ============================================================================
  // GLOBAL TEXT CONTENT
  // ============================================================================
  const [certTitle, setCertTitle] = useState("Certificate of Achievement");
  const [subtitle, setSubtitle] = useState("This certifies that");
  const [description, setDescription] = useState("has successfully completed the requirements and is hereby awarded");
  const [dateText, setDateText] = useState(new Date().toISOString().slice(0, 10));
  const [issuerText, setIssuerText] = useState("Issuer Organization");

  // ============================================================================
  // CANVAS & FIELDS
  // ============================================================================
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const [selectedId, setSelectedId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editorValue, setEditorValue] = useState("");
  const [editorRect, setEditorRect] = useState(null);

  // Fields - recalculate positions when canvas size changes
  const [fields, setFields] = useState([]);
  
  useEffect(() => {
    // Initialize or update field positions based on canvas size
    setFields([
      {
        id: "certTitle",
        text: "Certificate of Achievement",
        x: CW / 2,
        y: CW * 0.13,
        fontFamily: "Cinzel",
        fontSize: CW * 0.062,
        fontStyle: "bold",
        fill: "#1a1a2e",
        align: "center",
        width: CW * 0.9,
      },
      {
        id: "subtitle",
        text: "This certifies that",
        x: CW / 2,
        y: CW * 0.214,
        fontFamily: "EB Garamond",
        fontSize: CW * 0.021,
        fontStyle: "normal",
        fill: "#6b7280",
        align: "center",
        width: CW * 0.9,
      },
      {
        id: "name",
        text: "John Doe",
        x: CW / 2,
        y: CW * 0.333,
        fontFamily: "Playfair Display",
        fontSize: CW * 0.057,
        fontStyle: "bold",
        fill: "#1a1a2e",
        align: "center",
        width: CW * 0.9,
      },
      {
        id: "description",
        text: "has successfully completed the requirements and is hereby awarded",
        x: CW / 2,
        y: CW * 0.41,
        fontFamily: "EB Garamond",
        fontSize: CW * 0.019,
        fontStyle: "normal",
        fill: "#6b7280",
        align: "center",
        width: CW * 0.83,
      },
      {
        id: "award",
        text: "Outstanding Achievement",
        x: CW / 2,
        y: CW * 0.475,
        fontFamily: "Playfair Display",
        fontSize: CW * 0.028,
        fontStyle: "bold italic",
        fill: "#2d3748",
        align: "center",
        width: CW * 0.9,
      },
      {
        id: "date",
        text: `Date: ${new Date().toISOString().slice(0, 10)}`,
        x: CW * 0.137,
        y: CW * 0.64,
        fontFamily: "EB Garamond",
        fontSize: CW * 0.017,
        fontStyle: "normal",
        fill: "#6b7280",
        align: "left",
        width: CW * 0.31,
      },
      {
        id: "issuer",
        text: "Issuer Organization",
        x: CW * 0.807,
        y: CW * 0.64,
        fontFamily: "EB Garamond",
        fontSize: CW * 0.019,
        fontStyle: "normal",
        fill: "#1a1a2e",
        align: "right",
        width: CW * 0.356,
      },
    ]);
  }, [CW, CH]);

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

  // ============================================================================
  // TEXT EDITOR OVERLAY
  // ============================================================================
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

  // ============================================================================
  // EXPORT
  // ============================================================================
  const [exportLoading, setExportLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function handleExportPdf() {
    setExportLoading(true);
    setError("");
    setProgress({ done: 0, total: 0 });
    
    try {
      if (recipients.length === 0) {
        setError("No recipients to export");
        return;
      }

      setProgress({ done: 0, total: recipients.length });

      await exportPdfFromStage({
        rows: recipients,
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
      setError(err.message || "PDF export failed");
    } finally {
      setExportLoading(false);
      setProgress({ done: 0, total: 0 });
    }
  }

  async function handleExportZip() {
    setExportLoading(true);
    setError("");
    setProgress({ done: 0, total: 0 });
    
    try {
      if (recipients.length === 0) {
        setError("No recipients to export");
        return;
      }

      setProgress({ done: 0, total: recipients.length });

      await exportZipPngFromStage({
        rows: recipients,
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
      setError(err.message || "ZIP export failed");
    } finally {
      setExportLoading(false);
      setProgress({ done: 0, total: 0 });
    }
  }

  const selectedField = fields.find((f) => f.id === selectedId);

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="editor-container">
      <StepWizard
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        completedSteps={completedSteps}
        variant="top"
      />
      {/* App Header with Step Wizard */}
      

      <div className="editor-layout-stepped">
        {/* Left Sidebar - Step Content */}
        <div className="step-sidebar">
          {currentStep === 1 && (
            <Step1Template
              paper={paper}
              setPaper={setPaper}
              templates={templates}
              templateKey={templateKey}
              setTemplateKey={setTemplateKey}
              onAddCustomTemplate={onAddCustomTemplate}
              onNext={handleStep1Next}
            />
          )}

          {currentStep === 2 && (
            <Step2Customize
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
              onNext={handleStep2Next}
              onBack={handleStep2Back}
            />
          )}

          {currentStep === 3 && (
            <Step3Recipients
              inputMode={inputMode}
              setInputMode={setInputMode}
              manualRows={manualRows}
              setManualRows={setManualRows}
              uploadFile={uploadFile}
              handleFileUpload={handleFileUpload}
              error={error}
              recipients={recipients}
              onBack={handleStep3Back}
            />
          )}
        </div>

        {/* Center - Live Preview */}
        <div className="step-preview">
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
        </div>

        {/* Right Panel - Inspector or Export */}
        <div className="step-right-panel">
          {currentStep === 2 && (
            <div>
              <h3 className="panel-title">Style Inspector</h3>
              <p className="panel-subtitle">Click text on preview to customize</p>
              <Inspector
                selectedField={selectedField}
                updateField={updateField}
                fontOptions={FONT_OPTIONS}
                stageRef={stageRef}
                ensureFontLoaded={ensureFontLoaded}
                CW={CW}
              />
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h3 className="panel-title">Export</h3>
              <p className="panel-subtitle">Download your certificates</p>
              <ExportPanel
                recipients={recipients}
                onExportPdf={handleExportPdf}
                onExportZip={handleExportZip}
                exportLoading={exportLoading}
                progress={progress}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
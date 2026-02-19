import { PDFDocument } from "pdf-lib";

// ---------------------------------------------------------------------------
// Pixel ratio: canvas dimensions are defined in screen points (72 DPI base).
// To reach 300 DPI for print-quality output we need 300/72 ≈ 4.17.
// Capped at 4 as a practical ceiling — above that file sizes grow fast with
// no visible gain on most printers, and some browsers struggle to allocate
// the canvas buffer. Result: ~3360×2380 px for A4, well above print standard.
// ---------------------------------------------------------------------------
const DEFAULT_PIXEL_RATIO = 4; // ≈ 288 DPI — print quality

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Sanitise a recipient name into a safe cross-platform filename.
function safeFilename(name, fallback) {
  const s = (name || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")  // illegal on Windows/macOS/Linux
    .replace(/\s+/g, "_")
    .slice(0, 100);
  return s || fallback;
}

export async function snapshotStagePngBytes({
  stageRef,
  transformerRef,
  selectedId,
  setSelectedId,
  editingId,
  closeEditor,
  pixelRatio = DEFAULT_PIXEL_RATIO,
}) {
  const stage = stageRef.current;
  if (!stage) throw new Error("Stage not ready");

  // Close HTML textarea overlay if open (not part of canvas)
  if (editingId) closeEditor();

  const tr = transformerRef.current;
  const prevSelected = selectedId;

  // Hide transformer so handles/box won't be in snapshot
  if (tr) {
    tr.nodes([]);
    tr.visible(false);
    tr.getLayer()?.batchDraw();
  }

  // Clear selection state so it won't reattach mid-snapshot
  setSelectedId("");
  await new Promise((r) => setTimeout(r, 80));

  let dataUrl;
  try {
    dataUrl = stage.toDataURL({ pixelRatio, mimeType: "image/png" });
  } catch (e) {
    if (tr) { tr.visible(true); tr.getLayer()?.batchDraw(); }
    setSelectedId(prevSelected);
    throw new Error(
      "Canvas export blocked (tainted canvas). The template image must be " +
      "served with an Access-Control-Allow-Origin header. " +
      "Original error: " + e.message
    );
  }

  const bytes = dataUrlToUint8Array(dataUrl);

  // Detect tainted/blank canvas — toDataURL() returns "" or a ~67-byte stub.
  if (!bytes || bytes.byteLength < 100) {
    if (tr) { tr.visible(true); tr.getLayer()?.batchDraw(); }
    setSelectedId(prevSelected);
    throw new Error(
      "Canvas snapshot produced 0 bytes — the template image was likely " +
      "loaded without CORS, tainting the canvas. Ensure the template URL " +
      "returns Access-Control-Allow-Origin: * and reload the page."
    );
  }

  // Restore selection + transformer
  if (tr) { tr.visible(true); tr.getLayer()?.batchDraw(); }
  setSelectedId(prevSelected);

  return bytes;
}

// ---------------------------------------------------------------------------
// PDF export — page dimensions match the canvas size in PDF points (1pt = 1/72 inch).
// For A4 landscape: 842×595 points = 11.69×8.26 inches at 72 DPI base.
// The high-resolution PNG (captured at 4× pixel ratio) is embedded and scaled
// to fit the page, giving 288 DPI effective resolution when printed.
//
// This ensures the PDF prints at the correct physical size (A4/Letter/Custom)
// while maintaining high print quality from the 4× resolution capture.
// ---------------------------------------------------------------------------
export async function exportPdfFromStage({
  rows,
  cw,
  ch,
  stageRef,
  transformerRef,
  selectedId,
  setSelectedId,
  editingId,
  closeEditor,
  beforeEachRow,
  afterExportRestore,
  onProgress,
  filename = "certificates.pdf",
}) {
  try {
    const pdfDoc = await PDFDocument.create();
    const total = rows.length;

    // Page dimensions in PDF points = canvas dimensions (already in points)
    // A4 = 842×595 pts = 11.69×8.26 inches
    const pageW = cw;
    const pageH = ch;

    for (let i = 0; i < total; i++) {
      const r = rows[i];

      if (beforeEachRow) await beforeEachRow(r);
      await new Promise((res) => setTimeout(res, 120));

      // Capture at high resolution (4× pixel ratio for 288 DPI)
      const pngBytes = await snapshotStagePngBytes({
        stageRef, transformerRef, selectedId, setSelectedId,
        editingId, closeEditor,
        pixelRatio: DEFAULT_PIXEL_RATIO,
      });

      // Create page at correct physical size
      const page = pdfDoc.addPage([pageW, pageH]);
      
      // Embed high-res PNG and scale it to fit the page
      const img = await pdfDoc.embedPng(pngBytes);
      page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });

      if (onProgress) onProgress(i + 1, total);
    }

    const pdfBytes = await pdfDoc.save();
    downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), filename);

    if (afterExportRestore) afterExportRestore();
    return true;
  } catch (error) {
    console.error("PDF Export Error:", error);
    throw new Error(`Failed to export PDF: ${error?.message || error}`);
  }
}

// ---------------------------------------------------------------------------
// ZIP export — processes certificates in batches to keep peak memory under
// control at print resolution. Each batch is downloaded as a separate ZIP
// (e.g. certificates_1-20.zip, certificates_21-40.zip …).
// Batch size of 20 at 4× pixelRatio ≈ 20 × ~1.5MB compressed ≈ 30MB/batch.
// ---------------------------------------------------------------------------
const ZIP_BATCH_SIZE = 20;

export async function exportZipPngFromStage({
  rows,
  stageRef,
  transformerRef,
  selectedId,
  setSelectedId,
  editingId,
  closeEditor,
  beforeEachRow,
  afterExportRestore,
  zip: _zip, // kept for API compat but we create our own per batch
  onProgress,
}) {
  try {
    const total = rows.length;
    const batchCount = Math.ceil(total / ZIP_BATCH_SIZE);

    for (let b = 0; b < batchCount; b++) {
      const batchRows = rows.slice(b * ZIP_BATCH_SIZE, (b + 1) * ZIP_BATCH_SIZE);
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (let i = 0; i < batchRows.length; i++) {
        const r = batchRows[i];
        const globalIndex = b * ZIP_BATCH_SIZE + i;

        if (beforeEachRow) await beforeEachRow(r);
        await new Promise((res) => setTimeout(res, 120));

        let bytes = await snapshotStagePngBytes({
          stageRef, transformerRef, selectedId, setSelectedId,
          editingId, closeEditor,
          pixelRatio: DEFAULT_PIXEL_RATIO,
        });

        const filename = safeFilename(r.name, `certificate_${globalIndex + 1}`);
        zip.file(`${filename}.png`, bytes, { compression: "DEFLATE", compressionOptions: { level: 6 } });
        bytes = null; // allow GC before next iteration

        if (onProgress) onProgress(globalIndex + 1, total);
      }

      const batchLabel = batchCount > 1
        ? `_${b * ZIP_BATCH_SIZE + 1}-${Math.min((b + 1) * ZIP_BATCH_SIZE, total)}`
        : "";
      const blob = await zip.generateAsync({ type: "blob", streamFiles: true });
      downloadBlob(blob, `certificates${batchLabel}.zip`);

      // Small pause between batches so the browser can breathe
      if (b < batchCount - 1) await new Promise((res) => setTimeout(res, 400));
    }

    if (afterExportRestore) afterExportRestore();
    return true;
  } catch (error) {
    console.error("ZIP Export Error:", error);
    throw new Error(`Failed to export ZIP: ${error?.message || error}`);
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}

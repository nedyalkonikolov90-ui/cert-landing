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
// PDF export — page dimensions are set to the actual PNG pixel size, not the
// canvas point size. This means 1 PDF point = 1 pixel, so when a printer
// renders the page at its native size the effective DPI is:
//   DEFAULT_PIXEL_RATIO × 72  =  4 × 72  =  288 DPI  ✅ print quality
//
// PDF viewers display it at the correct physical A4/Letter size because they
// read the page dimensions and scale to the media size automatically.
//
// Memory ceiling at 4×, 100 certs: pdf-lib holds all embedded PNGs in memory
// until save(). Each PNG ≈ 3–5MB → peak ≈ 300–500MB. This is within Chrome's
// limits for 100 certs but approaches the ceiling — batching is recommended
// above ~150 certs. The ZIP export uses batches of 20 for this reason.
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

    // Page dimensions in PDF points = canvas pixels × pixelRatio.
    // This sets the PDF's intrinsic DPI to pixelRatio × 72.
    const pageW = cw * DEFAULT_PIXEL_RATIO;
    const pageH = ch * DEFAULT_PIXEL_RATIO;

    for (let i = 0; i < total; i++) {
      const r = rows[i];

      if (beforeEachRow) await beforeEachRow(r);
      await new Promise((res) => setTimeout(res, 120));

      const pngBytes = await snapshotStagePngBytes({
        stageRef, transformerRef, selectedId, setSelectedId,
        editingId, closeEditor,
        pixelRatio: DEFAULT_PIXEL_RATIO,
      });

      // Page size matches the image pixel dimensions exactly — no upscaling.
      const page = pdfDoc.addPage([pageW, pageH]);
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

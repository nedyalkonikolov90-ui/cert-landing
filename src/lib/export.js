import { PDFDocument } from "pdf-lib";

// ---------------------------------------------------------------------------
// Pixel ratio: 1.5 gives ~44% smaller files vs 2.0 at imperceptible quality
// loss for certificate-sized output. Increase to 2 if you need higher DPI.
// ---------------------------------------------------------------------------
const DEFAULT_PIXEL_RATIO = 1.5;

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
// PDF export — all pages collected in one pdf-lib document then downloaded.
// Memory ceiling: total PNG bytes + pdf-lib overhead. For 100 certs at 1.5×
// this is roughly 100 × 0.8MB ≈ 80MB which is within browser limits.
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
  onProgress,            // (done, total) => void
  filename = "certificates.pdf",
}) {
  try {
    const pdfDoc = await PDFDocument.create();
    const total = rows.length;

    for (let i = 0; i < total; i++) {
      const r = rows[i];

      if (beforeEachRow) await beforeEachRow(r);
      await new Promise((res) => setTimeout(res, 120));

      const pngBytes = await snapshotStagePngBytes({
        stageRef, transformerRef, selectedId, setSelectedId,
        editingId, closeEditor,
        pixelRatio: DEFAULT_PIXEL_RATIO,
      });

      const page = pdfDoc.addPage([cw, ch]);
      const img = await pdfDoc.embedPng(pngBytes);
      page.drawImage(img, { x: 0, y: 0, width: cw, height: ch });

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
// ZIP export — each PNG is added to JSZip one at a time with DEFLATE so the
// compressor can flush processed bytes. After zip.file() the local `bytes`
// reference is dropped so GC can reclaim the raw buffer while we process the
// next certificate.  generateAsync() then streams the zip in chunks rather
// than holding the entire archive in one allocation.
// ---------------------------------------------------------------------------
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
  zip,
  onProgress,            // (done, total) => void
}) {
  try {
    const total = rows.length;

    for (let i = 0; i < total; i++) {
      const r = rows[i];

      if (beforeEachRow) await beforeEachRow(r);
      await new Promise((res) => setTimeout(res, 120));

      let bytes = await snapshotStagePngBytes({
        stageRef, transformerRef, selectedId, setSelectedId,
        editingId, closeEditor,
        pixelRatio: DEFAULT_PIXEL_RATIO,
      });

      const filename = safeFilename(r.name, `certificate_${i + 1}`);

      // DEFLATE compresses PNGs ~30-40% inside the zip.
      zip.file(`${filename}.png`, bytes, { compression: "DEFLATE", compressionOptions: { level: 6 } });

      // Drop the reference so GC can reclaim this buffer before next iteration.
      bytes = null;

      if (onProgress) onProgress(i + 1, total);
    }

    // streamFiles:true lets JSZip emit chunks rather than building one giant buffer.
    const blob = await zip.generateAsync({ type: "blob", streamFiles: true });
    downloadBlob(blob, "certificates.zip");

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

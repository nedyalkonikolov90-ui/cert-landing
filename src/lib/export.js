import { PDFDocument } from "pdf-lib";

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function snapshotStagePngBytes({
  stageRef,
  transformerRef,
  selectedId,
  setSelectedId,
  editingId,
  closeEditor,
  pixelRatio = 2,
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

  // ✅ Always export PNG (stable for pdf-lib + avoids JPEG SOI errors)
  let dataUrl;
  try {
    dataUrl = stage.toDataURL({
      pixelRatio,
      mimeType: "image/png",
    });
  } catch (e) {
    // Restore transformer before rethrowing
    if (tr) {
      tr.visible(true);
      tr.getLayer()?.batchDraw();
    }
    setSelectedId(prevSelected);
    throw new Error(
      "Canvas export blocked (tainted canvas). The template image must be " +
      "served with an Access-Control-Allow-Origin header. " +
      "Original error: " + e.message
    );
  }

  // Convert dataURL → bytes without fetch()
  const bytes = dataUrlToUint8Array(dataUrl);

  // Detect a tainted or blank canvas — toDataURL() returns a minimal PNG
  // (~67 bytes) when the canvas is empty, and an empty string when tainted.
  if (!bytes || bytes.byteLength < 100) {
    if (tr) {
      tr.visible(true);
      tr.getLayer()?.batchDraw();
    }
    setSelectedId(prevSelected);
    throw new Error(
      "Canvas snapshot produced 0 bytes — the template image was likely " +
      "loaded without CORS, tainting the canvas. Ensure the template URL " +
      "returns Access-Control-Allow-Origin: * and reload the page."
    );
  }

  // Restore selection + transformer
  if (tr) {
    tr.visible(true);
    tr.getLayer()?.batchDraw();
  }
  setSelectedId(prevSelected);

  return bytes;
}

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
  filename = "certificates.pdf",
  max = 5,
}) {
  try {
    console.log("Starting PDF export...");
    const pdfDoc = await PDFDocument.create();
    const previewRows = rows.slice(0, max);

    console.log(`Exporting ${previewRows.length} certificates`);

    for (let i = 0; i < previewRows.length; i++) {
      const r = previewRows[i];
      console.log(`Processing certificate ${i + 1}/${previewRows.length}`);

      if (beforeEachRow) await beforeEachRow(r);
      await new Promise((res) => setTimeout(res, 120));

      const pngBytes = await snapshotStagePngBytes({
        stageRef,
        transformerRef,
        selectedId,
        setSelectedId,
        editingId,
        closeEditor,
        pixelRatio: 2,
      });

      console.log(`Captured image ${i + 1}, size: ${pngBytes.byteLength} bytes`);

      const page = pdfDoc.addPage([cw, ch]);

      // ✅ Embed PNG (not JPG)
      const img = await pdfDoc.embedPng(pngBytes);
      page.drawImage(img, { x: 0, y: 0, width: cw, height: ch });
    }

    console.log("Generating PDF...");
    const pdfBytes = await pdfDoc.save();
    console.log(`PDF generated, size: ${pdfBytes.byteLength} bytes`);

    downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), filename);
    console.log("PDF download initiated");

    if (afterExportRestore) afterExportRestore();

    return true;
  } catch (error) {
    console.error("PDF Export Error:", error);
    throw new Error(`Failed to export PDF: ${error?.message || error}`);
  }
}

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
  max = 5,
}) {
  try {
    console.log("Starting ZIP export...");
    const previewRows = rows.slice(0, max);

    console.log(`Exporting ${previewRows.length} certificates`);

    for (let i = 0; i < previewRows.length; i++) {
      const r = previewRows[i];
      console.log(`Processing certificate ${i + 1}/${previewRows.length}`);

      if (beforeEachRow) await beforeEachRow(r);
      await new Promise((res) => setTimeout(res, 120));

      const bytes = await snapshotStagePngBytes({
        stageRef,
        transformerRef,
        selectedId,
        setSelectedId,
        editingId,
        closeEditor,
        pixelRatio: 2,
      });

      console.log(`Captured PNG ${i + 1}, size: ${bytes.byteLength} bytes`);
      const safeName = (r.name || "")
  .trim()
  .replace(/[\\/:*?"<>|]/g, "")  // strip chars illegal on Windows/macOS/Linux
  .replace(/\s+/g, "_")           // spaces → underscores
  .slice(0, 100)                  // cap length
  || `certificate_${i + 1}`;     // fallback if name was empty
zip.file(`${safeName}.png`, bytes); // ✅ now really PNG
    }

    console.log("Generating ZIP...");
    const blob = await zip.generateAsync({ type: "blob" });
    console.log(`ZIP generated, size: ${blob.size} bytes`);

    downloadBlob(blob, "certificates.zip");
    console.log("ZIP download initiated");

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

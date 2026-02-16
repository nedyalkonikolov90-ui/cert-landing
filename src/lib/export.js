import { PDFDocument } from "pdf-lib";

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

  // Close HTML textarea overlay if open (not part of canvas, but keeps state consistent)
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
  await new Promise((r) => setTimeout(r, 50));
  
  const dataUrl = stage.toDataURL({
    pixelRatio: pixelRatio,  // ✅ Fixed: Use the parameter value
    mimeType: "image/jpeg",
    quality: 0.9,
  });
  
  const bytes = await (await fetch(dataUrl)).arrayBuffer();

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
      await new Promise((res) => setTimeout(res, 100)); // ✅ Increased delay for rendering

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
      const img = await pdfDoc.embedJpg(pngBytes);
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
    throw new Error(`Failed to export PDF: ${error.message}`);
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
      await new Promise((res) => setTimeout(res, 100)); // ✅ Increased delay

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
      zip.file(`certificate_${i + 1}.png`, bytes);
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
    throw new Error(`Failed to export ZIP: ${error.message}`);
  }
}

export function downloadBlob(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    
    // Clean up after a delay
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    console.log(`Download triggered for ${filename}`);
  } catch (error) {
    console.error("Download Error:", error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
}
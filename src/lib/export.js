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
  await new Promise((r) => setTimeout(r, 30));
  const dataUrl = stage.toDataURL({
  pixelRatio: 2.5,
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
  beforeEachRow, // async (row) => void
  afterExportRestore, // () => void
  filename = "certificate_preview.pdf",
  max = 5,
}) {
  const pdfDoc = await PDFDocument.create();
  const previewRows = rows.slice(0, max);

  for (let i = 0; i < previewRows.length; i++) {
    const r = previewRows[i];

    if (beforeEachRow) await beforeEachRow(r);
    await new Promise((res) => setTimeout(res, 30));

    const pngBytes = await snapshotStagePngBytes({
      stageRef,
      transformerRef,
      selectedId,
      setSelectedId,
      editingId,
      closeEditor,
      pixelRatio: 2,
    });

    const page = pdfDoc.addPage([cw, ch]);
    const img = await pdfDoc.embedJpg(pngBytes);
    page.drawImage(img, { x: 0, y: 0, width: cw, height: ch });
  }

  const pdfBytes = await pdfDoc.save();
  downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), filename);

  if (afterExportRestore) afterExportRestore();
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
  const previewRows = rows.slice(0, max);

  for (let i = 0; i < previewRows.length; i++) {
    const r = previewRows[i];

    if (beforeEachRow) await beforeEachRow(r);
    await new Promise((res) => setTimeout(res, 30));

    const bytes = await snapshotStagePngBytes({
      stageRef,
      transformerRef,
      selectedId,
      setSelectedId,
      editingId,
      closeEditor,
      pixelRatio: 2,
    });

    zip.file(`certificate_${i + 1}.png`, bytes);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, "certificates_preview.zip");

  if (afterExportRestore) afterExportRestore();
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

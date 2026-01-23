import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

const MAX_PREVIEW = 5;

function parseCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return { error: "CSV must include header + at least 1 row." };

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIndex = header.indexOf("name");
  const titleIndex = header.indexOf("title");
  const dateIndex = header.indexOf("date");

  if (nameIndex === -1 || titleIndex === -1) {
    return { error: "CSV must include headers: name,title (date optional)." };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const name = cols[nameIndex] || "";
    const title = cols[titleIndex] || "";
    const date = dateIndex >= 0 ? (cols[dateIndex] || "") : "";
    if (!name || !title) continue;
    rows.push({ name, title, date });
  }

  if (rows.length === 0) return { error: "No valid rows found (need name + title)." };
  return { rows };
}

function pageSize(paperSize) {
  // Points (pt). Good enough for MVP.
  // A4: 595 x 842 pt, US Letter: 612 x 792 pt
  return paperSize === "LETTER" ? [612, 792] : [595, 842];
}

async function makeCertificatePdf({ name, title, date, paperSize, templateId }) {
  const [w, h] = pageSize(paperSize);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([w, h]);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Background (simple MVP)
  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(1, 1, 1) });

  // Small “template” accent differences
  if (templateId === "t1") {
    page.drawRectangle({ x: 0, y: h - 80, width: w, height: 80, color: rgb(0.12, 0.12, 0.12) });
  } else if (templateId === "t2") {
    page.drawRectangle({ x: 0, y: h - 80, width: w, height: 80, color: rgb(0.2, 0.45, 1) });
  } else {
    page.drawRectangle({ x: 0, y: h - 80, width: w, height: 80, color: rgb(0.65, 0.2, 0.85) });
  }

  // Title
  page.drawText("Certificate", {
    x: 40,
    y: h - 52,
    size: 22,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // Main text
  const centerX = w / 2;

  const nameSize = 34;
  const titleSize = 18;

  const nameWidth = fontBold.widthOfTextAtSize(name, nameSize);
  page.drawText(name, {
    x: centerX - nameWidth / 2,
    y: h * 0.55,
    size: nameSize,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  const titleText = title;
  const titleWidth = font.widthOfTextAtSize(titleText, titleSize);
  page.drawText(titleText, {
    x: centerX - titleWidth / 2,
    y: h * 0.48,
    size: titleSize,
    font,
    color: rgb(0.25, 0.25, 0.25),
  });

  if (date) {
    const dateText = `Date: ${date}`;
    const dateWidth = font.widthOfTextAtSize(dateText, 12);
    page.drawText(dateText, {
      x: centerX - dateWidth / 2,
      y: h * 0.22,
      size: 12,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
  }

  // Watermark (preview)
  const watermark = "PREVIEW — UPGRADE TO REMOVE WATERMARK";
  page.drawText(watermark, {
    x: 40,
    y: h * 0.35,
    size: 22,
    font: fontBold,
    color: rgb(0.75, 0.75, 0.75),
    rotate: degrees(25),
    opacity: 0.35,
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const templateId = (form.get("template_id") || "t1").toString();
    const paperSize = (form.get("paper_size") || "A4").toString().toUpperCase();

    if (!file || typeof file === "string") {
      return new Response(JSON.stringify({ error: "Missing CSV file." }), { status: 400 });
    }

    if (!["A4", "LETTER"].includes(paperSize)) {
      return new Response(JSON.stringify({ error: "paper_size must be A4 or LETTER." }), { status: 400 });
    }

    const csvText = await file.text();
    const parsed = parseCsv(csvText);
    if (parsed.error) {
      return new Response(JSON.stringify({ error: parsed.error }), { status: 400 });
    }

    const rows = parsed.rows.slice(0, MAX_PREVIEW);

    const zip = new JSZip();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const pdfBytes = await makeCertificatePdf({
        ...r,
        paperSize,
        templateId,
      });
      const safe = r.name.replace(/[^a-z0-9 _-]/gi, "").trim().replace(/\s+/g, "_") || `recipient_${i + 1}`;
      zip.file(`${String(i + 1).padStart(2, "0")}_${safe}.pdf`, pdfBytes);
    }

    const zipBytes = await zip.generateAsync({ type: "uint8array" });

    const key = `previews/${crypto.randomUUID()}.zip`;
    await env.CERTS_BUCKET.put(key, zipBytes, {
      httpMetadata: { contentType: "application/zip" },
    });

    return new Response(JSON.stringify({ download_url: `/api/download/${encodeURIComponent(key)}` }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

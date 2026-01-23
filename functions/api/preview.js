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
  // A4: 595 x 842 pt, US Letter: 612 x 792 pt
  return paperSize === "LETTER" ? [612, 792] : [595, 842];
}

function drawCenteredText(page, font, text, size, y, color, bold = false) {
  const width = font.widthOfTextAtSize(text, size);
  const { width: w } = page.getSize();
  page.drawText(text, {
    x: (w - width) / 2,
    y,
    size,
    font,
    color,
  });
}

export async function onRequestPost({ request }) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const templateId = (form.get("template_id") || "modern").toString();
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

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const [w, h] = pageSize(paperSize);

    for (let i = 0; i < rows.length; i++) {
      const { name, title, date } = rows[i];

      const page = pdfDoc.addPage([w, h]);

      // Background
      page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(1, 1, 1) });

      // Template accent bar
      const barColor =
        templateId === "modern" ? rgb(0.12, 0.12, 0.12) :
        templateId === "elegant" ? rgb(0.2, 0.45, 1) :
        rgb(0.65, 0.2, 0.85);

      page.drawRectangle({ x: 0, y: h - 80, width: w, height: 80, color: barColor });
      page.drawText("Certificate", { x: 40, y: h - 52, size: 22, font: fontBold, color: rgb(1, 1, 1) });

      // Content
      drawCenteredText(page, fontBold, name, 34, h * 0.55, rgb(0.1, 0.1, 0.1));
      drawCenteredText(page, font, title, 18, h * 0.48, rgb(0.25, 0.25, 0.25));

      if (date) {
        drawCenteredText(page, font, `Date: ${date}`, 12, h * 0.22, rgb(0.35, 0.35, 0.35));
      }

      // Watermark
      page.drawText("PREVIEW — UPGRADE TO REMOVE WATERMARK", {
        x: 40,
        y: h * 0.35,
        size: 22,
        font: fontBold,
        color: rgb(0.75, 0.75, 0.75),
        rotate: degrees(25),
        opacity: 0.35,
      });

      // Optional footer page number
      page.drawText(`Preview page ${i + 1} of ${rows.length}`, {
        x: 40,
        y: 30,
        size: 10,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="certificate_preview.pdf"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}


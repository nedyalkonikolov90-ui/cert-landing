import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

const MAX_PREVIEW = 5;

// Template registry (add more later)
const TEMPLATES = {
  "kids-fantasy-1": {
    A4: "https://cdn.budgetwonders.eu/templates/ChatGPT%20Image%2026.01.2026%20%D0%B3.%2C%2011_07_48.png",
    LETTER:
      "https://cdn.budgetwonders.eu/templates/ChatGPT%20Image%2026.01.2026%20%D0%B3.%2C%2011_07_48.png",
  },
};

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
    const award = cols[titleIndex] || "";
    const date = dateIndex >= 0 ? cols[dateIndex] || "" : "";
    if (!name || !award) continue;
    rows.push({ name, award, date });
  }

  if (rows.length === 0) return { error: "No valid rows found (need name + title)." };
  return { rows };
}

function pageSize(paperSize) {
  // A4: 595x842 pt, US Letter: 612x792 pt
  return paperSize === "LETTER" ? [612, 792] : [595, 842];
}

function centeredX(page, font, text, size) {
  const w = page.getSize().width;
  const tw = font.widthOfTextAtSize(text, size);
  return (w - tw) / 2;
}

function fitTextSize(font, text, maxWidth, startSize, minSize) {
  let size = startSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1;
  return size;
}

async function fetchTemplateBytes(url) {
  const res = await fetch(url, {
    // Helps cache at Cloudflare edge
    cf: { cacheTtl: 86400, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`Failed to fetch template image: ${res.status} ${res.statusText}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function onRequestPost({ request }) {
  try {
    const form = await request.formData();

    const file = form.get("file");
    const templateId = (form.get("template_id") || "kids-fantasy-1").toString();
    const paperSize = (form.get("paper_size") || "A4").toString().toUpperCase();
    const certificateTitle = (form.get("certificate_title") || "Certificate of Achievement").toString();

    if (!file || typeof file === "string") {
      return new Response(JSON.stringify({ error: "Missing CSV file." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!["A4", "LETTER"].includes(paperSize)) {
      return new Response(JSON.stringify({ error: "paper_size must be A4 or LETTER." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const template = TEMPLATES[templateId];
    if (!template) {
      return new Response(JSON.stringify({ error: `Unknown template_id: ${templateId}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const templateUrl = template[paperSize] || template.A4;
    const templateBytes = await fetchTemplateBytes(templateUrl);

    const csvText = await file.text();
    const parsed = parseCsv(csvText);
    if (parsed.error) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rows = parsed.rows.slice(0, MAX_PREVIEW);

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Embed PNG once, reuse for every page
    const bgImg = await pdfDoc.embedPng(templateBytes);

    const [w, h] = pageSize(paperSize);

    // These are “good enough” coordinates for MVP; we can fine-tune after you confirm positioning.
    // (They roughly match the on-screen overlay: title around 18%, name ~42%, award ~50%)
    const yTitle = h * 0.82;
    const yName = h * 0.58;
    const yAward = h * 0.52;
    const yDate = h * 0.20;

    for (let i = 0; i < rows.length; i++) {
      const { name, award, date } = rows[i];
      const page = pdfDoc.addPage([w, h]);

      // Draw full-page background (stretched to page size)
      page.drawImage(bgImg, { x: 0, y: 0, width: w, height: h });

      // Certificate title (user-provided)
      const maxTitleWidth = w * 0.82;
      const titleSize = fitTextSize(fontBold, certificateTitle, maxTitleWidth, 38, 18);
      page.drawText(certificateTitle, {
        x: centeredX(page, fontBold, certificateTitle, titleSize),
        y: yTitle,
        size: titleSize,
        font: fontBold,
        color: rgb(0.15, 0.15, 0.15),
      });

      // Name (from CSV)
      const maxNameWidth = w * 0.82;
      const nameSize = fitTextSize(fontBold, name, maxNameWidth, 34, 18);
      page.drawText(name, {
        x: centeredX(page, fontBold, name, nameSize),
        y: yName,
        size: nameSize,
        font: fontBold,
        color: rgb(0.12, 0.12, 0.12),
      });

      // Award line (CSV "title")
      const maxAwardWidth = w * 0.82;
      const awardSize = fitTextSize(font, award, maxAwardWidth, 18, 11);
      page.drawText(award, {
        x: centeredX(page, font, award, awardSize),
        y: yAward,
        size: awardSize,
        font,
        color: rgb(0.22, 0.22, 0.22),
      });

      // Optional date
      if (date) {
        const dt = `Date: ${date}`;
        page.drawText(dt, {
          x: centeredX(page, font, dt, 12),
          y: yDate,
          size: 12,
          font,
          color: rgb(0.25, 0.25, 0.25),
        });
      }

      // Watermark (preview)
      page.drawText("PREVIEW — UPGRADE TO REMOVE WATERMARK", {
        x: 40,
        y: h * 0.35,
        size: 22,
        font: fontBold,
        color: rgb(0.75, 0.75, 0.75),
        rotate: degrees(25),
        opacity: 0.35,
      });
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="certificate_preview.pdf"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

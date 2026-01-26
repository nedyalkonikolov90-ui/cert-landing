/// functions/api/preview.js
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

const MAX_PREVIEW = 5;

function parseCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return { error: "CSV must include header + at least 1 row." };

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIndex = header.indexOf("name");
  const titleIndex = header.indexOf("title");
  const dateIndex = header.indexOf("date");
  const issuerIndex = header.indexOf("issuer");

  if (nameIndex === -1 || titleIndex === -1) {
    return { error: "CSV must include headers: name,title (date optional, issuer optional)." };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const name = cols[nameIndex] || "";
    const award = cols[titleIndex] || "";
    const date = dateIndex >= 0 ? cols[dateIndex] || "" : "";
    const issuer = issuerIndex >= 0 ? cols[issuerIndex] || "" : "";
    if (!name || !award) continue;
    rows.push({ name, award, date, issuer });
  }

  if (rows.length === 0) return { error: "No valid rows found (need name + title)." };
  return { rows };
}

function pageSize(paperSize) {
  return paperSize === "LETTER" ? [792, 612] : [842, 595];
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function posToPdf(posObj, w, h) {
  const x = clamp01(Number(posObj?.x ?? 0.5)) * w;
  const yTop = clamp01(Number(posObj?.y ?? 0.5));
  const y = (1 - yTop) * h;
  return { x, y };
}

function hexToRgb01(hex) {
  const raw = (hex || "#000000").toString().trim();
  const h = raw.startsWith("#") ? raw.slice(1) : raw;
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(v, 16);
  if (!Number.isFinite(n)) return rgb(0, 0, 0);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function fitTextSize(font, text, maxWidth, startSize, minSize) {
  const t = (text ?? "").toString();
  let size = startSize;
  while (size > minSize && font.widthOfTextAtSize(t, size) > maxWidth) size -= 1;
  return size;
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function resolveFontKey(style, fieldKey, isBold) {
  const fontId = (style?.[fieldKey]?.font || "helvetica").toString().toLowerCase();
  return `${fontId}:${isBold ? "bold" : "regular"}`;
}

function fontNameForKey(key) {
  const [fontId, weight] = key.split(":");
  const bold = weight === "bold";
  if (fontId === "times") return bold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman;
  if (fontId === "courier") return bold ? StandardFonts.CourierBold : StandardFonts.Courier;
  return bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica;
}

// Background “cover” crop (MUST match preview object-fit: cover)
function drawBackgroundCover(page, img, pageW, pageH) {
  const imgW = img.width;
  const imgH = img.height;

  const scale = Math.max(pageW / imgW, pageH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;

  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;

  page.drawImage(img, { x, y, width: drawW, height: drawH });
}

function sizeFor(style, fieldKey, fallback) {
  const n = Number(style?.[fieldKey]?.size);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();

    const templateKey = (form.get("template_key") || "").toString();
    if (!templateKey) {
      return new Response(JSON.stringify({ error: "Missing template_key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const paperSize = (form.get("paper_size") || "A4").toString().toUpperCase();
    if (!["A4", "LETTER"].includes(paperSize)) {
      return new Response(JSON.stringify({ error: "paper_size must be A4 or LETTER." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Load template image from R2
    const obj = await env.CERT_TEMPLATES.get(templateKey);
    if (!obj) {
      return new Response(JSON.stringify({ error: "Template not found in R2" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    const templateBytes = new Uint8Array(await obj.arrayBuffer());

    // Rows (json or old csv)
    const rowsJsonStr = (form.get("rows_json") || "").toString();
    const file = form.get("file");
    let rows = [];

    if (rowsJsonStr) {
      const parsedRows = safeJsonParse(rowsJsonStr, []);
      if (!Array.isArray(parsedRows)) {
        return new Response(JSON.stringify({ error: "rows_json must be a JSON array." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      rows = parsedRows;
    } else {
      if (!file || typeof file === "string") {
        return new Response(JSON.stringify({ error: "Missing rows_json or CSV file." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const csvText = await file.text();
      const parsed = parseCsv(csvText);
      if (parsed.error) {
        return new Response(JSON.stringify({ error: parsed.error }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      rows = parsed.rows;
    }

    rows = rows
      .map((r) => ({
        name: (r?.name || "").toString(),
        award: (r?.award ?? r?.title ?? "").toString(),
        date: (r?.date || "").toString(),
        issuer: (r?.issuer || "").toString(),
      }))
      .filter((r) => r.name && r.award)
      .slice(0, MAX_PREVIEW);

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "No valid rows found (need name + title/award)." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fields
    const certificateTitle = (form.get("certificate_title") || "Certificate of Achievement").toString();
    const subtitle = (form.get("subtitle") || "").toString();
    const description = (form.get("description") || "").toString();
    const dateTextDefault = (form.get("date_text") || "").toString();
    const issuerDefault = (form.get("issuer") || "").toString();

    // Pos/style
    const pos = safeJsonParse((form.get("pos_json") || "{}").toString(), {});
    const style = safeJsonParse((form.get("style_json") || "{}").toString(), {});

    const pdfDoc = await PDFDocument.create();

    // Embed template image (PNG/JPG)
    const ext = templateKey.toLowerCase().split(".").pop();
    const bgImg =
      ext === "png"
        ? await pdfDoc.embedPng(templateBytes)
        : ext === "jpg" || ext === "jpeg"
        ? await pdfDoc.embedJpg(templateBytes)
        : null;

    if (!bgImg) {
      return new Response(JSON.stringify({ error: "Unsupported template format. Use PNG or JPG." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const [w, h] = pageSize(paperSize);

    // Font cache
    const fontCache = new Map();
    async function getFont(fieldKey, isBold) {
      const key = resolveFontKey(style, fieldKey, isBold);
      if (fontCache.has(key)) return fontCache.get(key);
      const font = await pdfDoc.embedFont(fontNameForKey(key));
      fontCache.set(key, font);
      return font;
    }
    const wmFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    function colorFor(fieldKey, fallbackHex) {
      const hex = (style?.[fieldKey]?.color || fallbackHex || "#000000").toString();
      return hexToRgb01(hex);
    }

    // Width rules must match App.jsx ratios
    const MAX_MAIN = w * 0.82;
    const MAX_SMALL = w * 0.5;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const page = pdfDoc.addPage([w, h]);

      // IMPORTANT: matches preview object-fit cover
      drawBackgroundCover(page, bgImg, w, h);

      // --- CERT TITLE ---
      {
        const text = certificateTitle;
        const { x, y } = posToPdf(pos?.certTitle, w, h);

        const font = await getFont("certTitle", true);
        const color = colorFor("certTitle", "#2a2a2a");

        const start = sizeFor(style, "certTitle", 38);
        const size = fitTextSize(font, text, MAX_MAIN, start, Math.max(10, start * 0.4));
        const tw = font.widthOfTextAtSize(text, size);

        page.drawText(text, { x: x - tw / 2, y, size, font, color });
      }

      // --- SUBTITLE ---
      if (subtitle) {
        const text = subtitle;
        const { x, y } = posToPdf(pos?.subtitle, w, h);

        const font = await getFont("subtitle", false);
        const color = colorFor("subtitle", "#3a3a3a");

        const start = sizeFor(style, "subtitle", 18);
        const size = fitTextSize(font, text, MAX_MAIN, start, Math.max(10, start * 0.5));
        const tw = font.widthOfTextAtSize(text, size);

        page.drawText(text, { x: x - tw / 2, y, size, font, color });
      }

      // --- NAME ---
      {
        const text = row.name;
        const { x, y } = posToPdf(pos?.name, w, h);

        const font = await getFont("name", true);
        const color = colorFor("name", "#2a2a2a");

        const start = sizeFor(style, "name", 34);
        const size = fitTextSize(font, text, MAX_MAIN, start, Math.max(12, start * 0.5));
        const tw = font.widthOfTextAtSize(text, size);

        page.drawText(text, { x: x - tw / 2, y, size, font, color });
      }

      // --- DESCRIPTION ---
      if (description) {
        const text = description;
        const { x, y } = posToPdf(pos?.description, w, h);

        const font = await getFont("description", false);
        const color = colorFor("description", "#3a3a3a");

        const start = sizeFor(style, "description", 16);
        const size = fitTextSize(font, text, MAX_MAIN, start, Math.max(10, start * 0.6));
        const tw = font.widthOfTextAtSize(text, size);

        page.drawText(text, { x: x - tw / 2, y, size, font, color });
      }

      // --- AWARD / TITLE ---
      {
        const text = row.award;
        const { x, y } = posToPdf(pos?.award, w, h);

        const font = await getFont("award", false);
        const color = colorFor("award", "#3a3a3a");

        const start = sizeFor(style, "award", 18);
        const size = fitTextSize(font, text, MAX_MAIN, start, Math.max(10, start * 0.6));
        const tw = font.widthOfTextAtSize(text, size);

        page.drawText(text, { x: x - tw / 2, y, size, font, color });
      }

      // --- DATE ---
      {
        const effectiveDate = row.date || dateTextDefault;
        if (effectiveDate) {
          const text = `Date: ${effectiveDate}`;
          const { x, y } = posToPdf(pos?.date, w, h);

          const font = await getFont("date", false);
          const color = colorFor("date", "#3a3a3a");

          const start = sizeFor(style, "date", 12);
          const size = fitTextSize(font, text, MAX_SMALL, start, 9);
          const tw = font.widthOfTextAtSize(text, size);

          page.drawText(text, { x: x - tw / 2, y, size, font, color });
        }
      }

      // --- ISSUER ---
      {
        const effectiveIssuer = row.issuer || issuerDefault;
        if (effectiveIssuer) {
          const text = effectiveIssuer;
          const { x, y } = posToPdf(pos?.issuer, w, h);

          const font = await getFont("issuer", true);
          const color = colorFor("issuer", "#2a2a2a");

          const start = sizeFor(style, "issuer", 14);
          const size = fitTextSize(font, text, MAX_SMALL, start, 10);
          const tw = font.widthOfTextAtSize(text, size);

          page.drawText(text, { x: x - tw / 2, y, size, font, color });
        }
      }

      // Watermark
      page.drawText("PREVIEW — UPGRADE TO REMOVE WATERMARK", {
        x: 40,
        y: h * 0.35,
        size: 22,
        font: wmFont,
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


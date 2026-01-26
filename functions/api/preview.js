import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

const MAX_PREVIEW = 5;

// Template registry (add more later)
const TEMPLATES = { "kids-fantasy-1": { A4: "https://cdn.budgetwonders.eu/templates/ChatGPT%20Image%2026.01.2026%20%D0%B3.%2C%2011_07_48.png", LETTER: "https://cdn.budgetwonders.eu/templates/ChatGPT%20Image%2026.01.2026%20%D0%B3.%2C%2011_07_48.png", }, "professional": { A4: "https://cdn.budgetwonders.eu/templates/ChatGPT%20Image%2026.01.2026%20%D0%B3.%2C%2014_17_04.png", LETTER: "https://cdn.budgetwonders.eu/templates/ChatGPT%20Image%2026.01.2026%20%D0%B3.%2C%2014_17_04.png", }, };

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
  // Landscape sizes (pt)
  // A4 landscape: 842 x 595, Letter landscape: 792 x 612
  return paperSize === "LETTER" ? [792, 612] : [842, 595];
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// UI position: {x:0..1, y:0..1} where y=0 is top
// PDF uses y=0 bottom => flip y
function posToPdf(posObj, w, h) {
  const x = clamp01(Number(posObj?.x ?? 0.5)) * w;
  const yTop = clamp01(Number(posObj?.y ?? 0.5));
  const y = (1 - yTop) * h;
  return { x, y };
}

function getPdfFontName(fontId) {
  if (fontId === "times") return StandardFonts.TimesRoman;
  if (fontId === "courier") return StandardFonts.Courier;
  return StandardFonts.Helvetica;
}

function hexToRgb01(hex) {
  const raw = (hex || "#000000").toString().trim();
  const h = raw.startsWith("#") ? raw.slice(1) : raw;
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(v, 16);
  if (!Number.isFinite(n)) return rgb(0, 0, 0);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return rgb(r, g, b);
}

function fitTextSize(font, text, maxWidth, startSize, minSize) {
  const t = (text ?? "").toString();
  let size = startSize;
  while (size > minSize && font.widthOfTextAtSize(t, size) > maxWidth) size -= 1;
  return size;
}

async function fetchTemplateBytes(url) {
  const res = await fetch(url, { cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!res.ok) throw new Error(`Failed to fetch template image: ${res.status} ${res.statusText}`);
  return new Uint8Array(await res.arrayBuffer());
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export async function onRequestPost({ request }) {
  try {
    const form = await request.formData();

    // New mode: rows_json (from manual OR parsed upload in frontend)
    const rowsJsonStr = (form.get("rows_json") || "").toString();

    // Back-compat: old mode: file CSV
    const file = form.get("file");

    const templateId = (form.get("template_id") || "kids-fantasy-1").toString();
    const paperSize = (form.get("paper_size") || "A4").toString().toUpperCase();

    const certificateTitle = (form.get("certificate_title") || "Certificate of Achievement").toString();
    const dateTextDefault = (form.get("date_text") || "").toString();
    const issuerDefault = (form.get("issuer") || "").toString();

    // Positions/styles from UI
    const pos = safeJsonParse((form.get("pos_json") || "{}").toString(), {});
    const style = safeJsonParse((form.get("style_json") || "{}").toString(), {});

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

    // Resolve rows: prefer rows_json; fallback to CSV file
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
      // fallback: must have file
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

    // Normalize + limit preview
    rows = rows
      .map((r) => ({
        name: (r?.name || "").toString(),
        award: (r?.award ?? r?.title ?? "").toString(), // accept award or title
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

    const templateUrl = template[paperSize] || template.A4;
    const templateBytes = await fetchTemplateBytes(templateUrl);

    const pdfDoc = await PDFDocument.create();

    // Embed background once
    const bgImg = await pdfDoc.embedPng(templateBytes);

    const [w, h] = pageSize(paperSize);

    // Field font+color helpers (per-field)
    async function embedFontFor(fieldKey, isBold) {
      const fontId = (style?.[fieldKey]?.font || "helvetica").toString();
      // Bold variants for built-in fonts:
      if (fontId === "times") return pdfDoc.embedFont(isBold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman);
      if (fontId === "courier") return pdfDoc.embedFont(isBold ? StandardFonts.CourierBold : StandardFonts.Courier);
      return pdfDoc.embedFont(isBold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
    }

    function colorFor(fieldKey, fallbackHex) {
      const hex = (style?.[fieldKey]?.color || fallbackHex || "#000000").toString();
      return hexToRgb01(hex);
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const page = pdfDoc.addPage([w, h]);
      page.drawImage(bgImg, { x: 0, y: 0, width: w, height: h });

      // --- CERT TITLE ---
      {
        const text = certificateTitle;
        const { x, y } = posToPdf(pos?.certTitle, w, h);

        const font = await embedFontFor("certTitle", true);
        const color = colorFor("certTitle", "#2a2a2a");

        const maxWidth = w * 0.82;
        const size = fitTextSize(font, text, maxWidth, 38, 18);
        const tw = font.widthOfTextAtSize(text, size);

        page.drawText(text, {
          x: x - tw / 2,
          y,
          size,
          font,
          color,
        });
      }

      // --- NAME ---
      {
        const text = row.name;
        const { x, y } = posToPdf(pos?.name, w, h);

        const font = await embedFontFor("name", true);
        const color = colorFor("name", "#2a2a2a");

        const maxWidth = w * 0.82;
        const size = fitTextSize(font, text, maxWidth, 34, 18);
        const tw = font.widthOfTextAtSize(text, size);

        page.drawText(text, {
          x: x - tw / 2,
          y,
          size,
          font,
          color,
        });
      }

      // --- AWARD / TITLE ---
      {
        const text = row.award;
        const { x, y } = posToPdf(pos?.award, w, h);

        const font = await embedFontFor("award", false);
        const color = colorFor("award", "#3a3a3a");

        const maxWidth = w * 0.82;
        const size = fitTextSize(font, text, maxWidth, 18, 11);
        const tw = font.widthOfTextAtSize(text, size);

        page.drawText(text, {
          x: x - tw / 2,
          y,
          size,
          font,
          color,
        });
      }

      // --- DATE ---
      {
        const effectiveDate = row.date || dateTextDefault;
        if (effectiveDate) {
          const text = `Date: ${effectiveDate}`;
          const { x, y } = posToPdf(pos?.date, w, h);

          const font = await embedFontFor("date", false);
          const color = colorFor("date", "#3a3a3a");

          const size = 12;
          const tw = font.widthOfTextAtSize(text, size);

          // Center at drag point (same behavior as UI)
          page.drawText(text, {
            x: x - tw / 2,
            y,
            size,
            font,
            color,
          });
        }
      }

      // --- ISSUER ---
      {
        const effectiveIssuer = row.issuer || issuerDefault;
        if (effectiveIssuer) {
          const text = effectiveIssuer;
          const { x, y } = posToPdf(pos?.issuer, w, h);

          const font = await embedFontFor("issuer", true);
          const color = colorFor("issuer", "#2a2a2a");

          const size = 14;
          const tw = font.widthOfTextAtSize(text, size);

          page.drawText(text, {
            x: x - tw / 2,
            y,
            size,
            font,
            color,
          });
        }
      }

      // Watermark (preview)
      {
        const wmFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
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


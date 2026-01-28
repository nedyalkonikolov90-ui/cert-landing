// functions/api/preview.js
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

function hexToRgb01(hex) {
  const raw = (hex || "#000000").toString().trim();
  const h = raw.startsWith("#") ? raw.slice(1) : raw;
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(v, 16);
  if (!Number.isFinite(n)) return rgb(0, 0, 0);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// Draw background image as "cover" (keeps aspect ratio, fills page)
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

// StandardFonts mapping
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

// ---------- NEW: size handling + optional fit ----------
function readSize(style, fieldKey, fallback) {
  const raw = style?.[fieldKey]?.size;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 1 && n < 300) return n;
  return fallback;
}

function fitToWidth(font, text, size, maxWidth, minSize = 8) {
  const t = (text ?? "").toString();
  let s = size;
  while (s > minSize && font.widthOfTextAtSize(t, s) > maxWidth) s -= 1;
  return s;
}

// Optional: treat “weight” on UI as bold toggle for PDF built-in fonts
function isBoldFromWeight(style, fieldKey, defaultBold) {
  const w = Number(style?.[fieldKey]?.weight);
  if (Number.isFinite(w)) return w >= 700;
  return !!defaultBold;
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

    // Get template from R2
    const obj = await env.CERT_TEMPLATES.get(templateKey);
    if (!obj) {
      return new Response(JSON.stringify({ error: "Template not found in R2" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    const templateBytes = new Uint8Array(await obj.arrayBuffer());

    // Rows
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

    // Field values
    const certificateTitle = (form.get("certificate_title") || "Certificate of Achievement").toString();
    const subtitle = (form.get("subtitle") || "").toString();
    const description = (form.get("description") || "").toString();
    const dateTextDefault = (form.get("date_text") || "").toString();
    const issuerDefault = (form.get("issuer") || "").toString();

    // Positions + style
    const pos = safeJsonParse((form.get("pos_json") || "{}").toString(), {});
    const style = safeJsonParse((form.get("style_json") || "{}").toString(), {});

    const pdfDoc = await PDFDocument.create();

    // Embed background (PNG/JPG)
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
    async function getFont(fieldKey, defaultBold) {
      const bold = isBoldFromWeight(style, fieldKey, defaultBold);
      const key = resolveFontKey(style, fieldKey, bold);
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

    // Helper to draw centered text with "size" from style_json + fit-to-width
    async function drawCentered({
      page,
      fieldKey,
      text,
      posKey,
      defaultBold,
      fallbackColor,
      defaultSize,
      maxWidthPct = 0.82,
      minSize = 10,
      allowFit = true,
    }) {
      const t = (text ?? "").toString();
      if (!t) return;

      const { x, y } = posToPdf(pos?.[posKey], w, h);
      const font = await getFont(fieldKey, defaultBold);
      const color = colorFor(fieldKey, fallbackColor);

      const maxWidth = w * maxWidthPct;
      let size = readSize(style, fieldKey, defaultSize);
      if (allowFit) size = fitToWidth(font, t, size, maxWidth, minSize);

      const tw = font.widthOfTextAtSize(t, size);
      page.drawText(t, { x: x - tw / 2, y, size, font, color });
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const page = pdfDoc.addPage([w, h]);
      drawBackgroundCover(page, bgImg, w, h);

      // Title
      await drawCentered({
        page,
        fieldKey: "certTitle",
        text: certificateTitle,
        posKey: "certTitle",
        defaultBold: true,
        fallbackColor: "#1e2233",
        defaultSize: 40,
        minSize: 18,
        maxWidthPct: 0.86,
        allowFit: true,
      });

      // Subtitle
      await drawCentered({
        page,
        fieldKey: "subtitle",
        text: subtitle,
        posKey: "subtitle",
        defaultBold: false,
        fallbackColor: "#2b2f44",
        defaultSize: 18,
        minSize: 10,
        maxWidthPct: 0.86,
        allowFit: true,
      });

      // Name
      await drawCentered({
        page,
        fieldKey: "name",
        text: row.name,
        posKey: "name",
        defaultBold: true,
        fallbackColor: "#1e2233",
        defaultSize: 32,
        minSize: 18,
        maxWidthPct: 0.86,
        allowFit: true,
      });

      // Description
      await drawCentered({
        page,
        fieldKey: "description",
        text: description,
        posKey: "description",
        defaultBold: false,
        fallbackColor: "#2b2f44",
        defaultSize: 16,
        minSize: 10,
        maxWidthPct: 0.86,
        allowFit: true,
      });

      // Award / Title
      await drawCentered({
        page,
        fieldKey: "award",
        text: row.award,
        posKey: "award",
        defaultBold: false,
        fallbackColor: "#2b2f44",
        defaultSize: 18,
        minSize: 11,
        maxWidthPct: 0.86,
        allowFit: true,
      });

      // Date (keep your "Date: " prefix)
      {
        const effectiveDate = row.date || dateTextDefault;
        if (effectiveDate) {
          await drawCentered({
            page,
            fieldKey: "date",
            text: `Date: ${effectiveDate}`,
            posKey: "date",
            defaultBold: false,
            fallbackColor: "#2b2f44",
            defaultSize: 12,
            minSize: 9,
            maxWidthPct: 0.40, // date usually smaller area; adjust if you want
            allowFit: true,
          });
        }
      }

      // Issuer
      {
        const effectiveIssuer = row.issuer || issuerDefault;
        if (effectiveIssuer) {
          await drawCentered({
            page,
            fieldKey: "issuer",
            text: effectiveIssuer,
            posKey: "issuer",
            defaultBold: true,
            fallbackColor: "#1e2233",
            defaultSize: 14,
            minSize: 10,
            maxWidthPct: 0.45,
            allowFit: true,
          });
        }
      }

      // Watermark (preview)
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

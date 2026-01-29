export function ensureFontLink() {
  const id = "certifyly-fonts";
  if (document.getElementById(id)) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Playfair+Display:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Poppins:wght@400;600;700&family=Oswald:wght@400;600;700&display=swap";
  document.head.appendChild(link);
}

// Draw background “cover”
export function coverRect(imgW, imgH, boxW, boxH) {
  const scale = Math.max(boxW / imgW, boxH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  const x = (boxW - w) / 2;
  const y = (boxH - h) / 2;
  return { x, y, w, h };
}

export async function fetchTemplates() {
  const res = await fetch("/api/templates");
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.templates || [];
}

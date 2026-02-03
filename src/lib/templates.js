export function ensureFontLink() {
  const id = "certifyly-fonts";
  if (document.getElementById(id)) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?" +
    [
      // Existing
      "family=Inter:wght@400;600;700;800",
      "family=Playfair+Display:wght@400;600;700",
      "family=Montserrat:wght@400;600;700",
      "family=Poppins:wght@400;600;700",
      "family=Oswald:wght@400;600;700",

      // NEW – certificate fonts
      "family=Cormorant+Garamond:wght@400;600;700",
      "family=Libre+Baskerville:wght@400;700",
      "family=Crimson+Pro:wght@400;600;700",
      "family=EB+Garamond:wght@400;600;700",
      "family=Merriweather:wght@400;700",
      "family=Cinzel:wght@400;600;700",
      "family=Playfair+Display+SC",
      "family=Libre+Caslon+Display",
      "family=Prata",
      "family=Bodoni+Moda:wght@400;600;700",
      "family=DM+Serif+Display",
      "family=Source+Serif+4:wght@400;600;700",
      "family=Lora:wght@400;600;700",
      "family=Spectral:wght@400;600;700",
      "family=Alegreya:wght@400;600;700",
    ].join("&") +
    "&display=swap";

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

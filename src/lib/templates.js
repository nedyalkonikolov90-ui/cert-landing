// Template management with CORS support

export function ensureFontLink() {
  const existing = document.getElementById("google-fonts-link");
  if (existing) return;

  const link = document.createElement("link");
  link.id = "google-fonts-link";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;700&family=Roboto:wght@400;500;700&family=Lora:wght@400;700&family=Merriweather:wght@400;700&family=Open+Sans:wght@400;600;700&family=Montserrat:wght@400;600;700&display=swap";
  document.head.appendChild(link);
}

export async function ensureFontLoaded(fontFamily, fontWeight = 400) {
  if (!document.fonts) return;
  
  try {
    await document.fonts.load(`${fontWeight} 16px "${fontFamily}"`);
  } catch (err) {
    console.warn(`Failed to load font ${fontFamily}:`, err);
  }
}

export async function fetchTemplates() {
  try {
    const response = await fetch("/api/templates");
    if (!response.ok) {
      throw new Error(`Failed to fetch templates: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Template fetch error:", err);
    throw err;
  }
}

export function coverRect(imgW, imgH, targetW, targetH) {
  const imgAspect = imgW / imgH;
  const targetAspect = targetW / targetH;

  let w, h, x, y;

  if (imgAspect > targetAspect) {
    h = targetH;
    w = h * imgAspect;
    x = -(w - targetW) / 2;
    y = 0;
  } else {
    w = targetW;
    h = w / imgAspect;
    x = 0;
    y = -(h - targetH) / 2;
  }

  return { x, y, w, h };
}

// ✅ NEW: Load image with CORS support
export function loadImageWithCORS(url) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error("No URL provided"));
      return;
    }

    const img = new Image();
    
    // ✅ CRITICAL: Enable CORS
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      console.log(`Image loaded successfully: ${url}`);
      resolve(img);
    };
    
    img.onerror = (err) => {
      console.error(`Failed to load image: ${url}`, err);
      // Try loading without CORS as fallback
      const fallbackImg = new Image();
      fallbackImg.onload = () => {
        console.warn(`Image loaded without CORS (export may fail): ${url}`);
        resolve(fallbackImg);
      };
      fallbackImg.onerror = () => {
        reject(new Error(`Failed to load image: ${url}`));
      };
      fallbackImg.src = url;
    };
    
    img.src = url;
  });
}

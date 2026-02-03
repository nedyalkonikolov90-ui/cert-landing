export const SIZES = {
  A4: { w: 842, h: 595 },     // landscape
  LETTER: { w: 792, h: 612 }, // landscape
};

export const MAX_PREVIEW = 5;

export const FONT_OPTIONS = [
  // Existing
  { id: "Inter", label: "Inter (Modern)" },
  { id: "Playfair Display", label: "Playfair Display (Elegant)" },
  { id: "Montserrat", label: "Montserrat (Clean)" },
  { id: "Poppins", label: "Poppins (Friendly)" },
  { id: "Oswald", label: "Oswald (Bold)" },

  // NEW – Certificates
  { id: "Cormorant Garamond", label: "Cormorant Garamond (Classic)" },
  { id: "Libre Baskerville", label: "Libre Baskerville (Academic)" },
  { id: "Crimson Pro", label: "Crimson Pro (Bookish)" },
  { id: "EB Garamond", label: "EB Garamond (Traditional)" },
  { id: "Merriweather", label: "Merriweather (Professional)" },

  { id: "Cinzel", label: "Cinzel (Luxury / Roman)" },
  { id: "Playfair Display SC", label: "Playfair SC (Formal Caps)" },
  { id: "Libre Caslon Display", label: "Libre Caslon (Premium)" },
  { id: "Prata", label: "Prata (Elegant Serif)" },
  { id: "Bodoni Moda", label: "Bodoni Moda (Fashion)" },

  { id: "DM Serif Display", label: "DM Serif Display (Modern Serif)" },
  { id: "Source Serif 4", label: "Source Serif 4 (Document)" },
  { id: "Lora", label: "Lora (Friendly Serif)" },
  { id: "Spectral", label: "Spectral (Publishing)" },
  { id: "Alegreya", label: "Alegreya (Elegant Text)" },
];

export function niceFieldLabel(id) {
  return (
    {
      certTitle: "Certificate Title",
      subtitle: "Free text (below title)",
      name: "Name",
      description: "Free text (below name)",
      award: "Title / Award",
      date: "Date",
      issuer: "Issuer",
    }[id] || id
  );
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

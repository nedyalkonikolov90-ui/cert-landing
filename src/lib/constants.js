export const SIZES = {
  A4: { w: 842, h: 595 },     // landscape
  LETTER: { w: 792, h: 612 }, // landscape
};

export const MAX_PREVIEW = 5;

export const FONT_OPTIONS = [
  { id: "Inter", label: "Inter (Modern)" },
  { id: "Playfair Display", label: "Playfair Display (Elegant)" },
  { id: "Montserrat", label: "Montserrat (Clean)" },
  { id: "Poppins", label: "Poppins (Friendly)" },
  { id: "Oswald", label: "Oswald (Bold)" },
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

export function parseCsv(text) {
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

// TXT: "Name - Title"
export function parseTxt(text) {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { error: "TXT must include at least 1 line." };

  const rows = [];
  for (const line of lines) {
    const parts = line.split(" - ");
    if (parts.length >= 2) {
      rows.push({
        name: parts[0].trim(),
        award: parts.slice(1).join(" - ").trim(),
        date: "",
        issuer: "",
      });
    }
  }
  if (rows.length === 0) return { error: 'TXT lines must be like: "Name - Title"' };
  return { rows };
}

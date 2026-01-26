export async function onRequestGet({ env }) {
  const PREFIX = "templates/templates/";
  const bucket = env.CERT_TEMPLATES;

  const listed = await bucket.list({ prefix: PREFIX });

  // Keep only image files directly under the prefix (no subfolders)
  const templates = listed.objects
    .map((o) => o.key)
    .filter((key) => {
      const rest = key.slice(PREFIX.length);
      if (!rest || rest.includes("/")) return false; // no subfolders
      return /\.(png|jpg|jpeg|webp)$/i.test(rest);
    })
    .map((key) => {
      const filename = key.slice(PREFIX.length); // e.g. professional.png
      const id = filename.replace(/\.(png|jpg|jpeg|webp)$/i, "");
      // Optional: nicer label from filename
      const label = id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return { id, label, key };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return new Response(JSON.stringify({ templates }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

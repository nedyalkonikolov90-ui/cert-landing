export async function onRequestGet({ params, env }) {
  const key = params.key; // includes the path chunk after /download/
  if (!key) return new Response("Missing key", { status: 400 });

  const obj = await env.CERTS_BUCKET.get(decodeURIComponent(key));
  if (!obj) return new Response("Not found", { status: 404 });

 return new Response(pdfBytes, {
  headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="certificate_preview.pdf"',
    "Cache-Control": "no-store"
  }
});
}

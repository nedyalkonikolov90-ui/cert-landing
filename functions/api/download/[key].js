export async function onRequestGet({ params, env }) {
  const key = params.key; // includes the path chunk after /download/
  if (!key) return new Response("Missing key", { status: 400 });

  const obj = await env.CERTS_BUCKET.get(decodeURIComponent(key));
  if (!obj) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(zipBytes), {
  headers: {
    "Content-Type": "application/zip",
    "Content-Disposition": 'attachment; filename="certificate_TEST.zip"',
    "Cache-Control": "no-store",
  },
});
}

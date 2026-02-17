export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return new Response("Missing key", { status: 400 });

  const obj = await env.CERT_TEMPLATES.get(key);
  if (!obj) return new Response("Not found", { status: 404 });

  const ext = key.toLowerCase().split(".").pop();
  const contentType =
    ext === "svg" ? "image/svg+xml" :
    ext === "png" ? "image/png" :
    ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
    ext === "webp" ? "image/webp" :
    "application/octet-stream";

  // CORS headers are required so the canvas can call toDataURL() without
  // being tainted. Without Access-Control-Allow-Origin the browser blocks
  // canvas export even when crossOrigin="anonymous" is set on the <img>.
  return new Response(obj.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}

// Handle pre-flight OPTIONS requests
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Max-Age": "86400",
    },
  });
}

// functions/api/templates.js
export async function onRequestGet({ env, request }) {
  const origin = new URL(request.url).origin;

  try {
    // Your bucket name binding must exist in Cloudflare Pages/Workers env:
    // e.g. CERT_TEMPLATES -> bucket "templates"
    // and files are under prefix "templates/"
    const prefix = "templates/";
    const list = await env.CERT_TEMPLATES.list({ prefix });

    const templates = (list.objects || [])
      .filter((o) => o.key && !o.key.endsWith("/"))
      .filter((o) => /\.(png|jpg|jpeg|svg)$/i.test(o.key))
      .map((o) => {
        const file = o.key.split("/").pop();
        const label = file.replace(/\.(png|jpg|jpeg|svg)$/i, "");
        // Route through same-origin proxy so crossOrigin="anonymous" works
        // and the canvas is never tainted during export.
        const proxyUrl = `${origin}/api/template?key=${encodeURIComponent(o.key)}`;
        return {
          key: o.key,
          label,
          url: proxyUrl,
          thumbUrl: proxyUrl,
        };
      });

    return new Response(JSON.stringify({ templates }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Failed to list templates" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}

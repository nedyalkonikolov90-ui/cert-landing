// functions/api/templates.js
export async function onRequestGet({ env }) {
  try {
    // Your bucket name binding must exist in Cloudflare Pages/Workers env:
    // e.g. CERT_TEMPLATES -> bucket "templates"
    // and files are under prefix "templates/"
    const prefix = "templates/";
    const list = await env.CERT_TEMPLATES.list({ prefix });

    const cdnBase = "https://cdn.budgetwonders.eu"; // your public R2 domain
    const templates = (list.objects || [])
      .filter((o) => o.key && !o.key.endsWith("/"))
      .filter((o) => /\.(png|jpg|jpeg)$/i.test(o.key))
      .map((o) => {
        const file = o.key.split("/").pop();
        const label = file.replace(/\.(png|jpg|jpeg)$/i, "");
        return {
          key: o.key,
          label,
          url: `${cdnBase}/${o.key}`,
        };
      });

    return new Response(JSON.stringify({ templates }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Failed to list templates" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

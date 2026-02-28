export async function POST(req) {
  try {
    const { baseUrl, token, endpoint, method = "GET", body, params } = await req.json();
    if (!baseUrl || !token || !endpoint) return Response.json({ error: "Faltam parâmetros" }, { status: 400 });
    let url = `${baseUrl.replace(/\/+$/, "")}${endpoint}`;
    if (params) url += "?" + new URLSearchParams(params).toString();
    const h = { "Content-Type": "application/json", "Accept": "application/json" };
    if (token.startsWith("Basic ")) h["Authorization"] = token;
    else h["Authorization"] = `Bearer ${token}`;
    const opts = { method, headers: h };
    if (body && method !== "GET") opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    const t = await r.text();
    let d; try { d = JSON.parse(t); } catch { d = t; }
    if (!r.ok) return Response.json({ error: `${r.status}`, detail: t.substring(0, 500) }, { status: r.status });
    return Response.json({ success: true, data: d });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}

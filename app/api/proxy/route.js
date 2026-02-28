// POST /api/proxy — Generic proxy to SG Sistemas
// Adds ?filial=1 automatically

export async function POST(request) {
  try {
    const { baseUrl, token, endpoint, method = "GET", body, params, filial = "1" } = await request.json();
    if (!baseUrl || !token || !endpoint) {
      return Response.json({ error: "baseUrl, token e endpoint obrigatórios" }, { status: 400 });
    }

    const cleanBase = baseUrl.replace(/\/+$/, "");
    
    // Build URL with filial and any extra params
    const allParams = { filial, ...params };
    const qs = new URLSearchParams(allParams).toString();
    const url = `${cleanBase}${endpoint}?${qs}`;

    console.log(`[PROXY] ${method} ${url}`);

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    };

    const fetchOpts = { method, headers };
    if (body && method !== "GET") fetchOpts.body = JSON.stringify(body);

    const res = await fetch(url, fetchOpts);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      return Response.json({ error: `API retornou ${res.status}`, detail: errorText.substring(0, 500) }, { status: res.status });
    }

    const data = await res.json();
    return Response.json({ success: true, data, endpoint });
  } catch (err) {
    return Response.json({ error: "Erro ao conectar", detail: err.message }, { status: 500 });
  }
}

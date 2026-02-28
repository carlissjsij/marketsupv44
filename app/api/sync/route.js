// POST /api/sync — Full data sync from SG Sistemas
// IMPORTANT: All endpoints require ?filial=1 parameter

const ENDPOINTS = {
  produtos: "/produtos",
  estoque: "/produtos/estoque",
  precos: "/produtos/precos",
  grupos: "/produtos/grupos",
  subgrupos: "/produtos/subgrupos",
  marcas: "/produtos/marcas",
  vendas: "/vendas",
  vendasHoje: "/vendas/hoje",
  entradas: "/entradas",
  entradasProdutos: "/entradas/produtos",
  contasReceber: "/contas/receber",
  contasPagar: "/contas/pagar",
  despesas: "/despesas",
  fornecedores: "/fornecedores",
  clientes: "/clientes",
  usuarios: "/usuarios",
  condicoesPagamento: "/condicoespagamento",
};

async function fetchEndpoint(baseUrl, token, endpoint, filial) {
  try {
    // Add filial parameter to all requests
    const sep = endpoint.includes("?") ? "&" : "?";
    const url = `${baseUrl}${endpoint}${sep}filial=${filial}`;
    console.log(`[SYNC] GET ${url}`);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[SYNC] ${endpoint}: HTTP ${res.status} — ${errText.substring(0, 200)}`);
      return { endpoint, success: false, status: res.status, data: null, error: errText.substring(0, 200) };
    }

    const raw = await res.json();

    // Count items
    let count = 0;
    if (Array.isArray(raw)) count = raw.length;
    else if (raw?.data && Array.isArray(raw.data)) count = raw.data.length;
    else if (raw?.paginacao?.quantidadeItens) count = raw.paginacao.quantidadeItens;

    console.log(`[SYNC] ${endpoint}: OK — ${count} items`);
    return { endpoint, success: true, data: raw, count };
  } catch (err) {
    console.warn(`[SYNC] ${endpoint}: ERROR — ${err.message}`);
    return { endpoint, success: false, error: err.message, data: null };
  }
}

export async function POST(request) {
  try {
    const { baseUrl, token, filial = "1" } = await request.json();
    if (!baseUrl || !token) {
      return Response.json({ error: "baseUrl e token são obrigatórios" }, { status: 400 });
    }

    const cleanBase = baseUrl.replace(/\/+$/, "");
    console.log(`[SYNC] Starting sync: ${cleanBase} (filial=${filial})`);
    console.log(`[SYNC] Token: ${token.substring(0, 30)}...`);

    const results = {};
    const entries = Object.entries(ENDPOINTS);

    // Fetch in batches of 3 (conservative to avoid overloading)
    for (let i = 0; i < entries.length; i += 3) {
      const batch = entries.slice(i, i + 3);
      console.log(`[SYNC] Batch ${Math.floor(i / 3) + 1}: ${batch.map(([k]) => k).join(", ")}`);

      const batchResults = await Promise.all(
        batch.map(([key, ep]) => fetchEndpoint(cleanBase, token, ep, filial))
      );

      batch.forEach(([key], idx) => {
        results[key] = batchResults[idx];
      });
    }

    // Build report
    const report = {};
    for (const [key, result] of Object.entries(results)) {
      report[key] = {
        success: result.success,
        count: result.count || 0,
        endpoint: ENDPOINTS[key],
        error: result.error || null,
      };
    }

    const successCount = Object.values(report).filter((r) => r.success).length;
    const totalCount = Object.keys(report).length;
    console.log(`[SYNC] Complete: ${successCount}/${totalCount} OK`);

    // Log summary of what we got
    for (const [key, r] of Object.entries(report)) {
      if (r.success) console.log(`  ✓ ${key}: ${r.count} items`);
      else console.log(`  ✗ ${key}: ${r.error || "failed"}`);
    }

    // Return raw data
    const data = {};
    for (const [key, result] of Object.entries(results)) {
      data[key] = result.success ? result.data : [];
    }

    return Response.json({
      success: true,
      syncedAt: new Date().toISOString(),
      report,
      stats: { total: totalCount, success: successCount, failed: totalCount - successCount },
      data,
    });
  } catch (err) {
    console.error("[SYNC] Fatal:", err);
    return Response.json({ error: "Erro na sincronização", detail: err.message }, { status: 500 });
  }
}

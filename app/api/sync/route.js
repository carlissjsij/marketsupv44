// POST /api/sync — Full data sync from SG Sistemas
// Returns RAW API responses — frontend transform.js handles extraction

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

async function fetchEndpoint(baseUrl, token, endpoint) {
  try {
    const url = `${baseUrl}${endpoint}`;
    console.log(`[SYNC] Fetching ${url}`);
    
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[SYNC] ${endpoint}: HTTP ${res.status} - ${errText.substring(0, 100)}`);
      return { endpoint, success: false, status: res.status, data: null };
    }

    // Get raw response — could be { data: [...], paginacao: {...} } or just [...]
    const raw = await res.json();
    
    // Count items for logging
    let count = 0;
    if (Array.isArray(raw)) count = raw.length;
    else if (raw?.data && Array.isArray(raw.data)) count = raw.data.length;
    else if (raw?.paginacao) count = raw.paginacao.quantidadeItens || 0;
    
    console.log(`[SYNC] ${endpoint}: OK — ${count} items`);
    
    // Return the RAW response — transform.js will handle extraction
    return { endpoint, success: true, data: raw, count };
  } catch (err) {
    console.warn(`[SYNC] ${endpoint}: ERROR — ${err.message}`);
    return { endpoint, success: false, error: err.message, data: null };
  }
}

export async function POST(request) {
  try {
    const { baseUrl, token } = await request.json();
    if (!baseUrl || !token) {
      return Response.json({ error: "baseUrl e token são obrigatórios" }, { status: 400 });
    }

    const cleanBase = baseUrl.replace(/\/+$/, "");
    console.log(`[SYNC] Starting full sync: ${cleanBase}`);
    console.log(`[SYNC] Token: ${token.substring(0, 20)}...`);

    const results = {};
    const entries = Object.entries(ENDPOINTS);

    // Fetch in batches of 4 to not overwhelm the API
    for (let i = 0; i < entries.length; i += 4) {
      const batch = entries.slice(i, i + 4);
      console.log(`[SYNC] Batch ${Math.floor(i/4)+1}: ${batch.map(([k])=>k).join(", ")}`);
      
      const batchResults = await Promise.all(
        batch.map(([key, ep]) => fetchEndpoint(cleanBase, token, ep))
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

    const successCount = Object.values(report).filter(r => r.success).length;
    const totalCount = Object.keys(report).length;
    console.log(`[SYNC] Done: ${successCount}/${totalCount} OK`);

    // Return raw data for each endpoint — transform.js on frontend handles extraction
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

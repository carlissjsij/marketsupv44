// POST /api/sync — Full data sync from SG Sistemas
// Each endpoint has specific required parameters

function getDateParams() {
  const now = new Date();
  const today = now.toISOString().split("T")[0]; // YYYY-MM-DD
  
  // Last 30 days
  const d30 = new Date(now);
  d30.setDate(d30.getDate() - 30);
  const thirtyDaysAgo = d30.toISOString().split("T")[0];
  
  // Last 90 days for financial
  const d90 = new Date(now);
  d90.setDate(d90.getDate() - 90);
  const ninetyDaysAgo = d90.toISOString().split("T")[0];
  
  // First of current month
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  
  return { today, thirtyDaysAgo, ninetyDaysAgo, firstOfMonth };
}

function buildEndpoints(dates, filial) {
  const f = `filial=${filial}`;
  return {
    // No date params needed
    produtos:           { path: `/produtos?${f}`, desc: "Produtos" },
    fornecedores:       { path: `/fornecedores?${f}`, desc: "Fornecedores" },
    clientes:           { path: `/clientes?${f}`, desc: "Clientes" },
    grupos:             { path: `/produtos/grupos?${f}`, desc: "Grupos" },
    subgrupos:          { path: `/produtos/subgrupos?${f}`, desc: "Subgrupos" },
    marcas:             { path: `/produtos/marcas?${f}`, desc: "Marcas" },
    estoque:            { path: `/produtos/estoque?${f}`, desc: "Estoque" },
    precos:             { path: `/produtos/precos?${f}`, desc: "Preços" },
    usuarios:           { path: `/usuarios?${f}`, desc: "Usuários" },
    condicoesPagamento: { path: `/condicoespagamento?${f}`, desc: "Condições Pgto" },
    
    // vendas/hoje — no date needed
    vendasHoje:         { path: `/vendas/hoje?${f}`, desc: "Vendas Hoje" },
    
    // vendas — needs ?data=YYYY-MM-DD (fetch last 30 days, one day at a time would be slow, try with range)
    vendas:             { path: `/vendas?${f}&data=${dates.today}`, desc: "Vendas (hoje)" },
    vendasMes:          { path: `/vendas?${f}&data=${dates.firstOfMonth}`, desc: "Vendas (mês)" },
    
    // entradas — needs ?dataInicial=...&dataFinal=...
    entradas:           { path: `/entradas?${f}&dataInicial=${dates.thirtyDaysAgo}&dataFinal=${dates.today}`, desc: "Entradas 30d" },
    entradasProdutos:   { path: `/entradas/produtos?${f}&dataInicial=${dates.thirtyDaysAgo}&dataFinal=${dates.today}`, desc: "Entradas Prod 30d" },
    
    // contas — needs ?filtroDataInicial=...&filtroDataFinal=...
    contasReceber:      { path: `/contas/receber?${f}&filtroDataInicial=${dates.ninetyDaysAgo}&filtroDataFinal=${dates.today}`, desc: "Contas Receber 90d" },
    contasPagar:        { path: `/contas/pagar?${f}&filtroDataInicial=${dates.ninetyDaysAgo}&filtroDataFinal=${dates.today}`, desc: "Contas Pagar 90d" },
    despesas:           { path: `/despesas?${f}&filtroDataInicial=${dates.thirtyDaysAgo}&filtroDataFinal=${dates.today}`, desc: "Despesas 30d" },
  };
}

// Extract array from SG Sistemas response format
function extractArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (raw.data && Array.isArray(raw.data)) return raw.data;
  if (raw.items && Array.isArray(raw.items)) return raw.items;
  if (raw.result && Array.isArray(raw.result)) return raw.result;
  // Single object with id? Wrap it
  if (typeof raw === "object" && raw.id !== undefined && !raw.data) return [raw];
  return [];
}

async function fetchEndpoint(baseUrl, token, key, ep) {
  try {
    const url = `${baseUrl}${ep.path}`;
    console.log(`[SYNC] GET ${key}: ${url}`);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[SYNC] ${key}: HTTP ${res.status} — ${errText.substring(0, 300)}`);
      return { key, success: false, status: res.status, data: [], count: 0, error: errText.substring(0, 300) };
    }

    const raw = await res.json();
    
    // EXTRACT array from response — this is critical!
    const arr = extractArray(raw);
    const count = arr.length || raw?.paginacao?.quantidadeItens || 0;
    
    console.log(`[SYNC] ${key}: OK — ${count} items (raw type: ${Array.isArray(raw) ? "array" : typeof raw}, has .data: ${!!raw?.data}, has .paginacao: ${!!raw?.paginacao})`);
    
    // Return the EXTRACTED array, not the raw response
    return { key, success: true, data: arr, count };
  } catch (err) {
    console.warn(`[SYNC] ${key}: ERROR — ${err.message}`);
    return { key, success: false, error: err.message, data: [], count: 0 };
  }
}

export async function POST(request) {
  try {
    const { baseUrl, token, filial = "1" } = await request.json();
    if (!baseUrl || !token) {
      return Response.json({ error: "baseUrl e token são obrigatórios" }, { status: 400 });
    }

    const cleanBase = baseUrl.replace(/\/+$/, "");
    const dates = getDateParams();
    const endpoints = buildEndpoints(dates, filial);
    
    console.log(`[SYNC] Starting sync: ${cleanBase} filial=${filial}`);
    console.log(`[SYNC] Dates: today=${dates.today}, 30d=${dates.thirtyDaysAgo}, 90d=${dates.ninetyDaysAgo}`);
    console.log(`[SYNC] ${Object.keys(endpoints).length} endpoints to fetch`);

    const results = {};
    const entries = Object.entries(endpoints);

    // Fetch in batches of 3
    for (let i = 0; i < entries.length; i += 3) {
      const batch = entries.slice(i, i + 3);
      const batchResults = await Promise.all(
        batch.map(([key, ep]) => fetchEndpoint(cleanBase, token, key, ep))
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
        endpoint: endpoints[key]?.path?.split("?")[0] || key,
        error: result.error || null,
      };
    }

    const successCount = Object.values(report).filter((r) => r.success).length;
    const totalCount = Object.keys(report).length;
    
    console.log(`[SYNC] === RESULTS ===`);
    for (const [key, r] of Object.entries(report)) {
      console.log(`  ${r.success ? "✓" : "✗"} ${key}: ${r.count} items ${r.error ? "(" + r.error.substring(0, 50) + ")" : ""}`);
    }
    console.log(`[SYNC] ${successCount}/${totalCount} OK`);

    // Merge vendas + vendasMes into vendas
    const vendasAll = [...(results.vendas?.data || []), ...(results.vendasMes?.data || [])];
    // Dedupe by id if present
    const vendasMap = new Map();
    vendasAll.forEach(v => { const id = v.id || v.numero || JSON.stringify(v); vendasMap.set(id, v); });
    
    // Build final data object — all arrays already extracted
    const data = {
      produtos: results.produtos?.data || [],
      estoque: results.estoque?.data || [],
      precos: results.precos?.data || [],
      grupos: results.grupos?.data || [],
      subgrupos: results.subgrupos?.data || [],
      marcas: results.marcas?.data || [],
      vendas: [...vendasMap.values()],
      vendasHoje: results.vendasHoje?.data || [],
      entradas: results.entradas?.data || [],
      entradasProdutos: results.entradasProdutos?.data || [],
      contasReceber: results.contasReceber?.data || [],
      contasPagar: results.contasPagar?.data || [],
      despesas: results.despesas?.data || [],
      fornecedores: results.fornecedores?.data || [],
      clientes: results.clientes?.data || [],
      usuarios: results.usuarios?.data || [],
      condicoesPagamento: results.condicoesPagamento?.data || [],
    };

    console.log(`[SYNC] Final data sizes: ${Object.entries(data).map(([k, v]) => `${k}:${v.length}`).join(", ")}`);

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

// POST /api/sync — Full data sync from SG Sistemas
// TRANSFORMS data server-side to reduce payload (Vercel 4.5MB response limit)

function getDates() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = fmt(now);
  const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
  const d90 = new Date(now); d90.setDate(d90.getDate() - 90);
  const firstOfMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  return { today, d30: fmt(d30), d90: fmt(d90), firstOfMonth };
}

function extractArr(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  // Try common field names first
  if (raw.data && Array.isArray(raw.data)) return raw.data;
  if (raw.items && Array.isArray(raw.items)) return raw.items;
  if (raw.result && Array.isArray(raw.result)) return raw.result;
  if (raw.registros && Array.isArray(raw.registros)) return raw.registros;
  if (raw.itens && Array.isArray(raw.itens)) return raw.itens;
  // Scan ALL keys for any array
  if (typeof raw === "object") {
    const keys = Object.keys(raw);
    for (const k of keys) {
      if (Array.isArray(raw[k]) && raw[k].length > 0) {
        console.log(`[EXTRACT] Found array in key "${k}" with ${raw[k].length} items`);
        return raw[k];
      }
    }
    // Check for empty arrays too
    for (const k of keys) {
      if (Array.isArray(raw[k])) {
        console.log(`[EXTRACT] Found empty array in key "${k}"`);
        return raw[k];
      }
    }
  }
  if (typeof raw === "object" && raw.id !== undefined) return [raw];
  return [];
}

const num = (v) => {
  if (v == null || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
  return isNaN(n) ? 0 : n;
};

async function fetchEP(base, token, path, label) {
  try {
    const url = `${base}${path}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { ok: false, data: [], count: 0, error: err.substring(0, 200), label };
    }
    const raw = await res.json();
    
    // Log structure for debugging
    const rawKeys = typeof raw === "object" && !Array.isArray(raw) ? Object.keys(raw) : [];
    const keyTypes = rawKeys.map(k => `${k}:${Array.isArray(raw[k]) ? "arr["+raw[k].length+"]" : typeof raw[k]}`);
    console.log(`[SYNC] ${key} raw structure: {${keyTypes.join(", ")}}`);
    
    const arr = extractArr(raw);
    return { ok: true, data: arr, count: arr.length, label };
  } catch (e) {
    return { ok: false, data: [], count: 0, error: e.message, label };
  }
}

export async function POST(request) {
  const startTime = Date.now();
  try {
    const { baseUrl, token, filial = "1" } = await request.json();
    if (!baseUrl || !token) return Response.json({ error: "baseUrl e token obrigatórios" }, { status: 400 });

    const base = baseUrl.replace(/\/+$/, "");
    const dt = getDates();
    const f = `filial=${filial}`;

    console.log(`[SYNC] Start: ${base} filial=${filial} today=${dt.today}`);

    // ═══ BATCH 1: Core data ═══
    const [rProd, rForn, rClientes, rGrupos] = await Promise.all([
      fetchEP(base, token, `/produtos?${f}`, "produtos"),
      fetchEP(base, token, `/fornecedores?${f}`, "fornecedores"),
      fetchEP(base, token, `/clientes?${f}`, "clientes"),
      fetchEP(base, token, `/produtos/grupos?${f}`, "grupos"),
    ]);

    // ═══ BATCH 2: More data ═══
    const [rMarcas, rEstoque, rPrecos, rVendasHoje] = await Promise.all([
      fetchEP(base, token, `/produtos/marcas?${f}`, "marcas"),
      fetchEP(base, token, `/produtos/estoque?${f}`, "estoque"),
      fetchEP(base, token, `/produtos/precos?${f}`, "precos"),
      fetchEP(base, token, `/vendas/hoje?${f}`, "vendasHoje"),
    ]);

    // ═══ BATCH 3: Date-dependent ═══
    const [rVendasHj, rVendasMes, rEntradas] = await Promise.all([
      fetchEP(base, token, `/vendas?${f}&data=${dt.today}`, "vendas_hoje"),
      fetchEP(base, token, `/vendas?${f}&data=${dt.firstOfMonth}`, "vendas_mes"),
      fetchEP(base, token, `/entradas?${f}&dataInicial=${dt.d30}&dataFinal=${dt.today}`, "entradas"),
    ]);

    // ═══ BATCH 4: Financial ═══
    const [rReceber, rPagar, rDespesas] = await Promise.all([
      fetchEP(base, token, `/contas/receber?${f}&filtroDataInicial=${dt.d90}&filtroDataFinal=${dt.today}`, "contasReceber"),
      fetchEP(base, token, `/contas/pagar?${f}&filtroDataInicial=${dt.d90}&filtroDataFinal=${dt.today}`, "contasPagar"),
      fetchEP(base, token, `/despesas?${f}&filtroDataInicial=${dt.d30}&filtroDataFinal=${dt.today}`, "despesas"),
    ]);

    // ═══ BUILD REPORT ═══
    const allResults = { produtos: rProd, fornecedores: rForn, clientes: rClientes, grupos: rGrupos, marcas: rMarcas, estoque: rEstoque, precos: rPrecos, vendasHoje: rVendasHoje, vendas_hoje: rVendasHj, vendas_mes: rVendasMes, entradas: rEntradas, contasReceber: rReceber, contasPagar: rPagar, despesas: rDespesas };
    
    const report = {};
    for (const [k, r] of Object.entries(allResults)) {
      report[k] = { success: r.ok, count: r.count, error: r.error || null };
      console.log(`  ${r.ok ? "✓" : "✗"} ${k}: ${r.count} ${r.error ? "(" + r.error.substring(0, 60) + ")" : ""}`);
    }

    const successCount = Object.values(report).filter(r => r.success).length;

    // ═══ TRANSFORM ON SERVER — reduce payload ═══
    console.log(`[SYNC] Transforming ${rProd.count} products...`);

    // Build lookup maps
    const grupoMap = {};
    rGrupos.data.forEach(g => { if (g.id != null) grupoMap[g.id] = g.descricao || g.nome || ""; });
    const marcaMap = {};
    rMarcas.data.forEach(m => { if (m.id != null) marcaMap[m.id] = m.descricao || m.nome || ""; });

    // Transform products — only keep needed fields
    const produtos = rProd.data
      .filter(p => p.ativo !== false)
      .map(p => {
        const custo = num(p.custoMedio || p.custoReal || p.custoComEncargos || p.precoDeCusto);
        const preco = num(p.precoDeVenda2 || p.precoDeVenda1);
        const est = num(p.estoqueAtual);
        const mg = preco > 0 ? Math.round(((preco - custo) / preco) * 10000) / 100 : 0;
        const curva = (p.curvaABC || "D").toUpperCase();
        return {
          id: p.id, n: (p.descricao || "").substring(0, 60),
          g: grupoMap[p.departamentalizacaoNivel1] || `Dept ${p.departamentalizacaoNivel1 || "?"}`,
          m: marcaMap[p.marca] || "", c: curva,
          cu: Math.round(custo * 100) / 100, pr: Math.round(preco * 100) / 100,
          mg, e: Math.round(est * 100) / 100,
          f: (p.ultimoFornecedor || "").substring(0, 40),
          u: p.unidadeDeMedida || "UN",
        };
      })
      .filter(p => p.n && p.id);

    console.log(`[SYNC] ${produtos.length} active products transformed`);

    // Merge vendas
    const allVendas = [...rVendasHj.data, ...rVendasMes.data];
    const vendasMap = new Map();
    allVendas.forEach(v => vendasMap.set(v.id || v.numero || Math.random(), v));
    const vendas = [...vendasMap.values()];

    // Aggregate vendas
    let totalVenda = 0, totalQtd = 0, cupons = 0;
    const vendasPorProd = {};
    const vendasPorDia = {};
    vendas.forEach(v => {
      const val = num(v.valorTotal || v.total || v.valor || v.valorLiquido);
      const qtd = num(v.quantidadeItens || v.quantidade || 1);
      totalVenda += val; totalQtd += qtd; cupons++;
      const pid = v.idProduto || v.produtoId;
      if (pid) { if (!vendasPorProd[pid]) vendasPorProd[pid] = { v: 0, q: 0 }; vendasPorProd[pid].v += val; vendasPorProd[pid].q += qtd; }
      const dia = (v.data || v.dataVenda || v.dataEmissao || "").substring(0, 10);
      if (dia) { if (!vendasPorDia[dia]) vendasPorDia[dia] = { v: 0, c: 0 }; vendasPorDia[dia].v += val; vendasPorDia[dia].c++; }
    });

    // Vendas hoje
    let vendasHojeTotal = 0, vendasHojeCupons = 0;
    rVendasHoje.data.forEach(v => {
      vendasHojeTotal += num(v.valorTotal || v.total || v.valor);
      vendasHojeCupons++;
    });

    // Entradas
    let totalCompra = 0;
    const comprasPorForn = {};
    rEntradas.data.forEach(e => {
      const val = num(e.valorTotal || e.total || e.valor || e.valorProdutos);
      totalCompra += val;
      const fid = e.idFornecedor || e.fornecedorId;
      const fnome = e.nomeFornecedor || e.razaoSocialFornecedor || "";
      const key = fid || fnome;
      if (key) {
        if (!comprasPorForn[key]) comprasPorForn[key] = { cp: 0, cnt: 0, last: "", nome: fnome };
        comprasPorForn[key].cp += val; comprasPorForn[key].cnt++;
        const dt = e.dataEntrada || e.data || "";
        if (dt > comprasPorForn[key].last) comprasPorForn[key].last = dt;
      }
    });

    // Financeiro
    const totalReceber = rReceber.data.reduce((a, r) => a + num(r.valor || r.valorOriginal || r.valorTitulo), 0);
    const totalPagar = rPagar.data.reduce((a, r) => a + num(r.valor || r.valorOriginal || r.valorTitulo), 0);
    const totalDespesas = rDespesas.data.reduce((a, r) => a + num(r.valor || r.valorTotal), 0);

    // Enrich products with sales
    let enriched = 0;
    produtos.forEach(p => {
      const s = vendasPorProd[p.id];
      if (s) { p.vd = Math.round(s.v * 100) / 100; p.qt = Math.round(s.q * 100) / 100; p.lu = Math.round((p.mg / 100) * s.v * 100) / 100; enriched++; }
      else { p.vd = 0; p.qt = 0; p.lu = 0; }
    });
    console.log(`[SYNC] ${enriched} products enriched with sales`);

    // Build setores
    const gm = {};
    produtos.forEach(p => {
      const g = p.g || "Outros";
      if (!gm[g]) gm[g] = { n: g, vd: 0, sk: 0, mgS: 0, mgC: 0 };
      gm[g].vd += p.vd; gm[g].sk++; if (p.mg) { gm[g].mgS += p.mg; gm[g].mgC++; }
    });
    const tvs = Object.values(gm).reduce((a, s) => a + s.vd, 0) || 1;
    const setores = Object.values(gm).map(s => {
      const mg = s.mgC > 0 ? Math.round((s.mgS / s.mgC) * 100) / 100 : 0;
      const cp = totalCompra > 0 ? Math.round((s.vd / tvs) * totalCompra) : Math.round(s.vd * 0.72);
      return { n: s.n, vd: Math.round(s.vd), cp, mg, pt: Math.round((s.vd / tvs) * 1000) / 10, rcv: s.vd > 0 ? Math.round((cp / s.vd) * 1000) / 10 : 0, mv: Math.round(s.vd * 1.05), mm: 25, sk: s.sk };
    }).sort((a, b) => b.vd - a.vd).slice(0, 20);

    // Fornecedores
    const fornecedores = rForn.data.map(f => {
      const nome = f.razaoSocial || f.nomeFantasia || f.nome || f.descricao || "";
      const ed = comprasPorForn[f.id] || Object.values(comprasPorForn).find(x => x.nome && nome && x.nome.toLowerCase().includes(nome.toLowerCase().substring(0, 8)));
      return {
        id: f.id, n: nome.substring(0, 50),
        cp: ed ? Math.round(ed.cp * 100) / 100 : 0,
        uc: ed?.last?.substring(0, 10) || "",
        pr: produtos.filter(p => p.f && nome && p.f.toLowerCase().includes(nome.toLowerCase().substring(0, 8))).length,
        cn: f.cnpjCpf || f.cnpj || "",
      };
    }).filter(f => f.n).sort((a, b) => b.cp - a.cp);

    // Daily chart
    const vd7 = Object.entries(vendasPorDia).sort(([a], [b]) => a.localeCompare(b)).slice(-7).map(([d, v]) => {
      let label; try { label = new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""); } catch { label = d.substring(8, 10); }
      return { d: label, v: Math.round(v.v), m: Math.round(v.v * 1.05) };
    });

    const mgMedia = produtos.length > 0 ? produtos.reduce((a, p) => a + p.mg, 0) / produtos.length : 0;

    const elapsed = Date.now() - startTime;
    console.log(`[SYNC] Done in ${elapsed}ms. Produtos: ${produtos.length}, Vendas: R$${totalVenda.toFixed(2)}, Compras: R$${totalCompra.toFixed(2)}`);

    // ═══ SEND TRANSFORMED DATA (small payload!) ═══
    return Response.json({
      success: true,
      syncedAt: new Date().toISOString(),
      elapsed,
      report,
      stats: { total: Object.keys(report).length, success: successCount, failed: Object.keys(report).length - successCount },
      // Pre-built dashboard — no need for client-side transform
      dashboard: {
        produtos: produtos.sort((a, b) => b.vd - a.vd).slice(0, 5000), // Top 5000 by sales
        setores,
        fornecedores,
        vendasDiarias: vd7.length > 0 ? vd7 : null,
        kpis: {
          receitaBruta: Math.round(totalVenda * 100) / 100,
          totalCompra: Math.round(totalCompra * 100) / 100,
          lucroBruto: Math.round(produtos.reduce((a, p) => a + (p.lu || 0), 0) * 100) / 100,
          margemMedia: Math.round(mgMedia * 100) / 100,
          rcv: totalVenda > 0 ? Math.round((totalCompra / totalVenda) * 10000) / 100 : 0,
          totalQtd: Math.round(totalQtd),
          cupons,
          ticketMedio: cupons > 0 ? Math.round((totalVenda / cupons) * 100) / 100 : 0,
          contasReceber: Math.round(totalReceber * 100) / 100,
          contasPagar: Math.round(totalPagar * 100) / 100,
          saldo: Math.round((totalReceber - totalPagar) * 100) / 100,
          despesas: Math.round(totalDespesas * 100) / 100,
          totalProdutos: produtos.length,
          totalFornecedores: fornecedores.length,
          totalClientes: rClientes.count,
          ruptura: produtos.filter(p => p.e <= 0 && p.c !== "D").length,
          estBaixo: produtos.filter(p => p.e > 0 && p.e < 10).length,
          mgNegativa: produtos.filter(p => p.mg < 0 && p.pr > 0).length,
          vendasHoje: Math.round(vendasHojeTotal * 100) / 100,
          vendasHojeCupons,
        },
        isReal: true,
      },
    });
  } catch (err) {
    console.error("[SYNC] Fatal:", err);
    return Response.json({ error: "Erro na sincronização", detail: err.message }, { status: 500 });
  }
}

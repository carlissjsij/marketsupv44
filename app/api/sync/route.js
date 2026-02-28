// POST /api/sync — Full data sync from SG Sistemas
// API returns: { dados: [...], paginacao|ordenacao: {...} }

function getDates() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = fmt(now);
  const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
  const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
  const d90 = new Date(now); d90.setDate(d90.getDate() - 90);
  const firstOfMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  return { today, d7: fmt(d7), d30: fmt(d30), d90: fmt(d90), firstOfMonth };
}

// SG Sistemas returns { dados: [...], paginacao|ordenacao: {...} }
function extractArr(raw, label) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  // SG Sistemas uses "dados" as the key
  if (raw.dados && Array.isArray(raw.dados)) {
    console.log(`[EXTRACT] ${label}: found "dados" with ${raw.dados.length} items`);
    return raw.dados;
  }
  // Fallback: scan all keys
  if (typeof raw === "object") {
    for (const k of Object.keys(raw)) {
      if (Array.isArray(raw[k]) && raw[k].length > 0) {
        console.log(`[EXTRACT] ${label}: found array in "${k}" with ${raw[k].length} items`);
        return raw[k];
      }
    }
    for (const k of Object.keys(raw)) {
      if (Array.isArray(raw[k])) return raw[k];
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
    console.log(`[FETCH] ${label}: ${path}`);
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.log(`[FETCH] ${label}: HTTP ${res.status} - ${err.substring(0, 100)}`);
      return { ok: false, data: [], count: 0, error: `HTTP ${res.status}: ${err.substring(0, 100)}`, label };
    }
    const raw = await res.json();

    // Log structure
    if (typeof raw === "object" && !Array.isArray(raw)) {
      const keys = Object.keys(raw);
      const desc = keys.map(k => `${k}:${Array.isArray(raw[k]) ? "arr[" + raw[k].length + "]" : typeof raw[k]}`);
      console.log(`[FETCH] ${label}: {${desc.join(", ")}}`);
    } else if (Array.isArray(raw)) {
      console.log(`[FETCH] ${label}: array[${raw.length}]`);
    }

    const arr = extractArr(raw, label);
    console.log(`[FETCH] ${label}: OK — ${arr.length} items extracted`);
    return { ok: true, data: arr, count: arr.length, label };
  } catch (e) {
    console.log(`[FETCH] ${label}: ERROR — ${e.message}`);
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

    console.log(`[SYNC] === START === base=${base} filial=${filial} today=${dt.today} d30=${dt.d30}`);

    // ═══ BATCH 1: Core catalog data ═══
    const [rProd, rForn, rClientes, rDepts] = await Promise.all([
      fetchEP(base, token, `/produtos?${f}`, "produtos"),
      fetchEP(base, token, `/fornecedores?${f}`, "fornecedores"),
      fetchEP(base, token, `/clientes?${f}`, "clientes"),
      fetchEP(base, token, `/departamentos/nivel1?${f}`, "departamentos"),
    ]);

    // ═══ BATCH 2: Sales data ═══
    const [rVendasHoje, rProdVendas, rPrecos] = await Promise.all([
      fetchEP(base, token, `/vendas/hoje?${f}`, "vendasHoje"),
      fetchEP(base, token, `/produtos/vendas?${f}`, "produtosVendas"),
      fetchEP(base, token, `/produtos/precos?${f}`, "precos"),
    ]);

    // ═══ BATCH 3: Entries and more sales ═══
    const [rEntradas, rEntProd, rVendas] = await Promise.all([
      fetchEP(base, token, `/entradas?${f}&dataInicial=${dt.d30}&dataFinal=${dt.today}`, "entradas"),
      fetchEP(base, token, `/entradas/produtos?${f}&dataInicial=${dt.d30}&dataFinal=${dt.today}`, "entradasProd"),
      fetchEP(base, token, `/vendas?${f}`, "vendas"),
    ]);

    // ═══ BATCH 4: Financial ═══
    const [rReceber, rPagar, rDespesas] = await Promise.all([
      fetchEP(base, token, `/contas/receber?${f}`, "contasReceber"),
      fetchEP(base, token, `/contas/pagar?${f}`, "contasPagar"),
      fetchEP(base, token, `/despesas?${f}`, "despesas"),
    ]);

    // ═══ BUILD REPORT ═══
    const allResults = {
      produtos: rProd, fornecedores: rForn, clientes: rClientes, departamentos: rDepts,
      vendasHoje: rVendasHoje, produtosVendas: rProdVendas, precos: rPrecos,
      entradas: rEntradas, entradasProd: rEntProd, vendas: rVendas,
      contasReceber: rReceber, contasPagar: rPagar, despesas: rDespesas,
    };

    const report = {};
    for (const [k, r] of Object.entries(allResults)) {
      report[k] = { success: r.ok, count: r.count, error: r.error || null };
    }
    const successCount = Object.values(report).filter(r => r.success).length;
    console.log(`[SYNC] Fetch done: ${successCount}/${Object.keys(report).length} OK`);

    // ═══ TRANSFORM ON SERVER ═══

    // 1. Department map (id -> name)
    const deptMap = {};
    rDepts.data.forEach(d => { if (d.id != null) deptMap[d.id] = d.descricao || ""; });
    console.log(`[SYNC] ${Object.keys(deptMap).length} departments mapped`);

    // 2. Transform products
    const produtos = rProd.data
      .filter(p => p.ativo !== false)
      .map(p => {
        const custo = num(p.custoMedio || p.custoReal || p.custoComEncargos || p.precoDeCusto);
        const preco = num(p.precoDeVenda2 || p.precoDeVenda1);
        const est = num(p.estoqueAtual);
        const mg = preco > 0 ? Math.round(((preco - custo) / preco) * 10000) / 100 : 0;
        const curva = (p.curvaABC || "D").toUpperCase();
        return {
          id: p.id,
          n: (p.descricao || "").substring(0, 60),
          g: deptMap[p.departamentalizacaoNivel1] || `Dept ${p.departamentalizacaoNivel1 || "?"}`,
          gid: p.departamentalizacaoNivel1,
          c: curva,
          cu: Math.round(custo * 100) / 100,
          pr: Math.round(preco * 100) / 100,
          mg,
          e: Math.round(est * 100) / 100,
          f: (p.ultimoFornecedor || "").substring(0, 40),
          u: p.unidadeDeMedida || "UN",
        };
      })
      .filter(p => p.n && p.id);

    console.log(`[SYNC] ${produtos.length} active products`);

    // 3. Process vendas/hoje — has nested itens[] per sale
    // Structure: { caixa, cupom, horario, valorTotal, cancelada, itens: [{idProduto, quantidadeVendida, precoVenda}] }
    let vendasHojeTotal = 0, vendasHojeCupons = 0;
    const vendasPorProd = {};

    rVendasHoje.data.forEach(v => {
      if (v.cancelada) return;
      vendasHojeTotal += num(v.valorTotal);
      vendasHojeCupons++;
      // Extract items from nested itens[]
      if (Array.isArray(v.itens)) {
        v.itens.forEach(item => {
          if (item.cancelado) return;
          const pid = item.idProduto;
          const val = num(item.precoVenda) * num(item.quantidadeVendida);
          const qtd = num(item.quantidadeVendida);
          if (pid) {
            if (!vendasPorProd[pid]) vendasPorProd[pid] = { v: 0, q: 0 };
            vendasPorProd[pid].v += val;
            vendasPorProd[pid].q += qtd;
          }
        });
      }
    });
    console.log(`[SYNC] Vendas hoje: R$${vendasHojeTotal.toFixed(2)}, ${vendasHojeCupons} cupons, ${Object.keys(vendasPorProd).length} products sold`);

    // 4. Process produtos/vendas if available (aggregated sales per product)
    rProdVendas.data.forEach(pv => {
      const pid = pv.idProduto || pv.id;
      const val = num(pv.valorTotal || pv.valor || pv.total);
      const qtd = num(pv.quantidade || pv.quantidadeVendida || 1);
      if (pid && val > 0) {
        if (!vendasPorProd[pid]) vendasPorProd[pid] = { v: 0, q: 0 };
        vendasPorProd[pid].v += val;
        vendasPorProd[pid].q += qtd;
      }
    });

    // 5. Process vendas (general endpoint) - also has nested itens
    let totalVendaMes = 0, cuponsMes = 0;
    const vendasPorDia = {};
    rVendas.data.forEach(v => {
      if (v.cancelada) return;
      const val = num(v.valorTotal);
      totalVendaMes += val;
      cuponsMes++;
      // Group by day
      const dia = (v.data || v.dataVenda || v.dataEmissao || "").substring(0, 10);
      if (dia) {
        if (!vendasPorDia[dia]) vendasPorDia[dia] = { v: 0, c: 0 };
        vendasPorDia[dia].v += val;
        vendasPorDia[dia].c++;
      }
      // Extract items
      if (Array.isArray(v.itens)) {
        v.itens.forEach(item => {
          if (item.cancelado) return;
          const pid = item.idProduto;
          const ival = num(item.precoVenda) * num(item.quantidadeVendida);
          const qtd = num(item.quantidadeVendida);
          if (pid) {
            if (!vendasPorProd[pid]) vendasPorProd[pid] = { v: 0, q: 0 };
            vendasPorProd[pid].v += ival;
            vendasPorProd[pid].q += qtd;
          }
        });
      }
    });

    // Use best total: vendas mes if available, else today
    const totalVenda = totalVendaMes > 0 ? totalVendaMes : vendasHojeTotal;
    const cupons = cuponsMes > 0 ? cuponsMes : vendasHojeCupons;

    console.log(`[SYNC] Vendas mês: R$${totalVendaMes.toFixed(2)}, ${cuponsMes} cupons`);
    console.log(`[SYNC] ${Object.keys(vendasPorProd).length} products with sales data`);

    // 6. Process entradas (purchases)
    let totalCompra = 0;
    const comprasPorForn = {};
    rEntradas.data.forEach(e => {
      const val = num(e.valorTotal || e.total || e.valor || e.valorProdutos);
      totalCompra += val;
      const fid = e.idFornecedor || e.fornecedorId;
      const fnome = e.nomeFornecedor || e.razaoSocialFornecedor || e.fornecedor || "";
      const key = fid || fnome;
      if (key) {
        if (!comprasPorForn[key]) comprasPorForn[key] = { cp: 0, cnt: 0, last: "", nome: fnome };
        comprasPorForn[key].cp += val;
        comprasPorForn[key].cnt++;
        const dt2 = e.dataEntrada || e.data || "";
        if (dt2 > comprasPorForn[key].last) comprasPorForn[key].last = dt2;
      }
    });
    console.log(`[SYNC] Entradas: R$${totalCompra.toFixed(2)}, ${rEntradas.count} notas`);

    // 7. Financial
    const totalReceber = rReceber.data.reduce((a, r) => a + num(r.valor || r.valorOriginal || r.valorTitulo), 0);
    const totalPagar = rPagar.data.reduce((a, r) => a + num(r.valor || r.valorOriginal || r.valorTitulo), 0);
    const totalDespesas = rDespesas.data.reduce((a, r) => a + num(r.valor || r.valorTotal), 0);

    // 8. Enrich products with sales
    let enriched = 0;
    produtos.forEach(p => {
      const s = vendasPorProd[p.id];
      if (s) {
        p.vd = Math.round(s.v * 100) / 100;
        p.qt = Math.round(s.q * 100) / 100;
        p.lu = Math.round((p.mg / 100) * s.v * 100) / 100;
        enriched++;
      } else {
        p.vd = 0; p.qt = 0; p.lu = 0;
      }
    });
    console.log(`[SYNC] ${enriched} products enriched with sales`);

    // 9. Build setores from departments
    const gm = {};
    produtos.forEach(p => {
      const g = p.g || "Outros";
      if (!gm[g]) gm[g] = { n: g, vd: 0, sk: 0, mgS: 0, mgC: 0 };
      gm[g].vd += p.vd;
      gm[g].sk++;
      if (p.mg) { gm[g].mgS += p.mg; gm[g].mgC++; }
    });
    const tvs = Object.values(gm).reduce((a, s) => a + s.vd, 0) || 1;
    const setores = Object.values(gm).map(s => {
      const mg = s.mgC > 0 ? Math.round((s.mgS / s.mgC) * 100) / 100 : 0;
      const cp = totalCompra > 0 ? Math.round((s.vd / tvs) * totalCompra) : Math.round(s.vd * 0.72);
      return {
        n: s.n, vd: Math.round(s.vd), cp, mg,
        pt: Math.round((s.vd / tvs) * 1000) / 10,
        rcv: s.vd > 0 ? Math.round((cp / s.vd) * 1000) / 10 : 0,
        mv: Math.round(s.vd * 1.05), mm: 25, sk: s.sk,
      };
    }).sort((a, b) => b.vd - a.vd).slice(0, 30);

    // 10. Fornecedores enriched
    const fornecedores = rForn.data.map(fo => {
      const nome = fo.razaoSocial || fo.nomeFantasia || fo.nome || fo.descricao || "";
      const ed = comprasPorForn[fo.id] || Object.values(comprasPorForn).find(x =>
        x.nome && nome && x.nome.toLowerCase().includes(nome.toLowerCase().substring(0, 8))
      );
      return {
        id: fo.id,
        n: nome.substring(0, 50),
        cp: ed ? Math.round(ed.cp * 100) / 100 : 0,
        uc: ed?.last?.substring(0, 10) || "",
        pr: produtos.filter(p => p.f && nome && p.f.toLowerCase().includes(nome.toLowerCase().substring(0, 8))).length,
        cn: fo.cnpj || fo.cnpjCpf || "",
      };
    }).filter(fo => fo.n).sort((a, b) => b.cp - a.cp);

    // 11. Daily chart — last 7 days
    const vd7 = Object.entries(vendasPorDia)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([d, v]) => {
        let label;
        try { label = new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""); }
        catch { label = d.substring(8, 10); }
        return { d: label, v: Math.round(v.v), m: Math.round(v.v * 1.05) };
      });

    const mgMedia = produtos.length > 0 ? produtos.reduce((a, p) => a + p.mg, 0) / produtos.length : 0;

    const elapsed = Date.now() - startTime;
    console.log(`[SYNC] === DONE in ${elapsed}ms ===`);
    console.log(`[SYNC] Produtos: ${produtos.length}, Setores: ${setores.length}, Fornecedores: ${fornecedores.length}`);
    console.log(`[SYNC] Vendas: R$${totalVenda.toFixed(2)}, Compras: R$${totalCompra.toFixed(2)}, Margem: ${mgMedia.toFixed(1)}%`);

    return Response.json({
      success: true,
      syncedAt: new Date().toISOString(),
      elapsed,
      report,
      stats: { total: Object.keys(report).length, success: successCount, failed: Object.keys(report).length - successCount },
      dashboard: {
        produtos: produtos.sort((a, b) => b.vd - a.vd).slice(0, 5000),
        setores,
        fornecedores,
        vendasDiarias: vd7.length > 0 ? vd7 : null,
        kpis: {
          receitaBruta: Math.round(totalVenda * 100) / 100,
          totalCompra: Math.round(totalCompra * 100) / 100,
          lucroBruto: Math.round(produtos.reduce((a, p) => a + (p.lu || 0), 0) * 100) / 100,
          margemMedia: Math.round(mgMedia * 100) / 100,
          rcv: totalVenda > 0 ? Math.round((totalCompra / totalVenda) * 10000) / 100 : 0,
          totalQtd: Math.round(produtos.reduce((a, p) => a + (p.qt || 0), 0)),
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

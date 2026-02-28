// POST /api/sync — Full data sync from SG Sistemas (ALL endpoints)
// API returns: { dados: [...], paginacao|ordenacao: {...} }

function extractArr(raw, label) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (raw.dados && Array.isArray(raw.dados)) return raw.dados;
  if (typeof raw === "object") {
    for (const k of Object.keys(raw)) {
      if (Array.isArray(raw[k]) && raw[k].length > 0) return raw[k];
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
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.log(`[FETCH] ${label}: HTTP ${res.status} — ${err.substring(0, 120)}`);
      return { ok: false, data: [], count: 0, error: `HTTP ${res.status}: ${err.substring(0, 120)}`, label };
    }
    const raw = await res.json();
    const arr = extractArr(raw, label);
    console.log(`[FETCH] ${label}: ${arr.length} items`);
    return { ok: true, data: arr, count: arr.length, label };
  } catch (e) {
    return { ok: false, data: [], count: 0, error: e.message, label };
  }
}

export async function POST(request) {
  const startTime = Date.now();
  try {
    const body = await request.json();
    const { baseUrl, token, filial = "1", dataInicial, dataFinal } = body;
    if (!baseUrl || !token) return Response.json({ error: "baseUrl e token obrigatórios" }, { status: 400 });

    const base = baseUrl.replace(/\/+$/, "");
    const f = `filial=${filial}`;

    // Date range — use provided or default 30d
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const today = fmt(now);
    const dEnd = dataFinal || today;
    const dStartObj = dataInicial ? new Date(dataInicial + "T00:00:00") : (() => { const d = new Date(now); d.setDate(d.getDate() - 30); return d; })();
    const dStart = dataInicial || fmt(dStartObj);

    console.log(`[SYNC] START base=${base} filial=${filial} range=${dStart} to ${dEnd}`);

    // ═══ BATCH 1: Catalog ═══
    const [rProd, rForn, rClientes, rDepts, rMarcas, rClasses] = await Promise.all([
      fetchEP(base, token, `/produtos?${f}`, "produtos"),
      fetchEP(base, token, `/fornecedores?${f}`, "fornecedores"),
      fetchEP(base, token, `/clientes?${f}`, "clientes"),
      fetchEP(base, token, `/departamentos/nivel1?${f}`, "departamentos"),
      fetchEP(base, token, `/marcas?${f}`, "marcas"),
      fetchEP(base, token, `/classes?${f}`, "classes"),
    ]);

    // ═══ BATCH 2: More catalog ═══
    const [rAgrup, rPrecos, rDept2, rDept3, rFornProd] = await Promise.all([
      fetchEP(base, token, `/agrupamentos?${f}`, "agrupamentos"),
      fetchEP(base, token, `/produtos/precos?${f}`, "precos"),
      fetchEP(base, token, `/departamentos/nivel2?${f}`, "deptNivel2"),
      fetchEP(base, token, `/departamentos/nivel3?${f}`, "deptNivel3"),
      fetchEP(base, token, `/fornecedores/produtos?${f}`, "fornecedoresProd"),
    ]);

    // ═══ BATCH 3: Sales (date-dependent) ═══
    const [rVendasHoje, rProdVendas, rVendas, rVendasCart, rVendasFin] = await Promise.all([
      fetchEP(base, token, `/vendas/hoje?${f}`, "vendasHoje"),
      fetchEP(base, token, `/produtos/vendas?${f}&filtroDataInicial=${dStart}&filtroDataFinal=${dEnd}`, "produtosVendas"),
      fetchEP(base, token, `/vendas?${f}&data=${dEnd}`, "vendas"),
      fetchEP(base, token, `/vendascartoes?${f}`, "vendasCartoes"),
      fetchEP(base, token, `/vendas/finalizadoras?${f}`, "vendasFinalizadoras"),
    ]);

    // ═══ BATCH 4: Purchases ═══
    const [rEntradas, rEntProd, rPedidos, rPedProd] = await Promise.all([
      fetchEP(base, token, `/entradas?${f}&dataInicial=${dStart}&dataFinal=${dEnd}`, "entradas"),
      fetchEP(base, token, `/entradas/produtos?${f}&dataInicial=${dStart}&dataFinal=${dEnd}`, "entradasProd"),
      fetchEP(base, token, `/pedidoscompra?${f}`, "pedidosCompra"),
      fetchEP(base, token, `/pedidoscompra/produtos?${f}`, "pedidosCompraProd"),
    ]);

    // ═══ BATCH 5: Financial (date-dependent) ═══
    const [rReceber, rPagar, rDespesas, rFormasPag, rPrazosPag] = await Promise.all([
      fetchEP(base, token, `/contas/receber?${f}&filtroDataInicial=${dStart}&filtroDataFinal=${dEnd}`, "contasReceber"),
      fetchEP(base, token, `/contas/pagar?${f}&filtroDataInicial=${dStart}&filtroDataFinal=${dEnd}`, "contasPagar"),
      fetchEP(base, token, `/despesas?${f}&filtroDataInicial=${dStart}&filtroDataFinal=${dEnd}`, "despesas"),
      fetchEP(base, token, `/formaspagamento?${f}`, "formasPagamento"),
      fetchEP(base, token, `/prazospagamento?${f}`, "prazosPagamento"),
    ]);

    // ═══ BATCH 6: Extra ═══
    const [rOfertas, rOfertaProd, rSaidas, rSaidaProd, rVencimentos] = await Promise.all([
      fetchEP(base, token, `/ofertas?${f}`, "ofertas"),
      fetchEP(base, token, `/ofertas/produtos?${f}`, "ofertasProd"),
      fetchEP(base, token, `/saidas?${f}`, "saidas"),
      fetchEP(base, token, `/saidas/produtos?${f}`, "saidasProd"),
      fetchEP(base, token, `/produtos/vencimentos?${f}`, "vencimentos"),
    ]);

    // ═══ BATCH 7: Extras ═══
    const [rPerdas, rPDV, rVendedores, rCompradores, rFiliais] = await Promise.all([
      fetchEP(base, token, `/produtos/perdas?${f}`, "perdas"),
      fetchEP(base, token, `/pdv?${f}`, "pdv"),
      fetchEP(base, token, `/vendedores?${f}`, "vendedores"),
      fetchEP(base, token, `/compradores?${f}`, "compradores"),
      fetchEP(base, token, `/filiais?${f}`, "filiais"),
    ]);

    // ═══ REPORT ═══
    const allResults = {
      produtos: rProd, fornecedores: rForn, clientes: rClientes, departamentos: rDepts,
      marcas: rMarcas, classes: rClasses, agrupamentos: rAgrup, precos: rPrecos,
      deptNivel2: rDept2, deptNivel3: rDept3, fornecedoresProd: rFornProd,
      vendasHoje: rVendasHoje, produtosVendas: rProdVendas, vendas: rVendas,
      vendasCartoes: rVendasCart, vendasFinalizadoras: rVendasFin,
      entradas: rEntradas, entradasProd: rEntProd, pedidosCompra: rPedidos, pedidosCompraProd: rPedProd,
      contasReceber: rReceber, contasPagar: rPagar, despesas: rDespesas,
      formasPagamento: rFormasPag, prazosPagamento: rPrazosPag,
      ofertas: rOfertas, ofertasProd: rOfertaProd, saidas: rSaidas, saidasProd: rSaidaProd,
      vencimentos: rVencimentos, perdas: rPerdas, pdv: rPDV,
      vendedores: rVendedores, compradores: rCompradores, filiais: rFiliais,
    };

    const report = {};
    for (const [k, r] of Object.entries(allResults)) {
      report[k] = { success: r.ok, count: r.count, error: r.error || null };
    }
    const successCount = Object.values(report).filter(r => r.success).length;
    console.log(`[SYNC] Fetch: ${successCount}/${Object.keys(report).length} OK`);

    // ═══ TRANSFORM ═══

    // Maps
    const deptMap = {};
    rDepts.data.forEach(d => { if (d.id != null) deptMap[d.id] = d.descricao || ""; });
    const dept2Map = {};
    rDept2.data.forEach(d => { if (d.id != null) dept2Map[d.id] = d.descricao || ""; });
    const dept3Map = {};
    rDept3.data.forEach(d => { if (d.id != null) dept3Map[d.id] = d.descricao || ""; });
    const marcaMap = {};
    rMarcas.data.forEach(m => { if (m.id != null) marcaMap[m.id] = m.descricao || ""; });
    const classeMap = {};
    rClasses.data.forEach(c => { if (c.id != null) classeMap[c.id] = c.descricao || ""; });
    const agrupMap = {};
    rAgrup.data.forEach(a => { if (a.id != null) agrupMap[a.id] = a.descricao || ""; });

    // Products
    const produtos = rProd.data.filter(p => p.ativo !== false).map(p => {
      const custo = num(p.custoMedio || p.custoReal || p.custoComEncargos);
      const preco = num(p.precoDeVenda2 || p.precoDeVenda1);
      const est = num(p.estoqueAtual);
      const mg = preco > 0 ? Math.round(((preco - custo) / preco) * 10000) / 100 : 0;
      return {
        id: p.id, n: (p.descricao || "").substring(0, 60),
        g: deptMap[p.departamentalizacaoNivel1] || "",
        gid: p.departamentalizacaoNivel1 || 0,
        sg: dept2Map[p.departamentalizacaoNivel2] || "",
        sgid: p.departamentalizacaoNivel2 || 0,
        sg3: dept3Map[p.departamentalizacaoNivel3] || "",
        marca: marcaMap[p.marca] || "",
        mid: p.marca || 0,
        classe: classeMap[p.classe] || "",
        agrup: agrupMap[p.agrupamento] || "",
        c: (p.curvaABC || "D").toUpperCase(),
        cu: Math.round(custo * 100) / 100, pr: Math.round(preco * 100) / 100, mg,
        e: Math.round(est * 100) / 100,
        f: (p.ultimoFornecedor || "").substring(0, 40),
        u: p.unidadeDeMedida || "UN",
        bal: p.balanca || "",
        dtCad: (p.dataCadastro || "").substring(0, 10),
        dtPreco: (p.dataAlteracaoPreco || "").substring(0, 10),
        dtCusto: (p.dataAlteracaoCusto || "").substring(0, 10),
        pv1: num(p.precoDeVenda1),
      };
    }).filter(p => p.n && p.id);

    // Sales from vendas/hoje (nested itens)
    let vendasHojeTotal = 0, vendasHojeCupons = 0;
    const vendasPorProd = {};
    rVendasHoje.data.forEach(v => {
      if (v.cancelada) return;
      vendasHojeTotal += num(v.valorTotal);
      vendasHojeCupons++;
      if (Array.isArray(v.itens)) {
        v.itens.forEach(item => {
          if (item.cancelado) return;
          const pid = item.idProduto;
          const val = num(item.precoVenda) * num(item.quantidadeVendida);
          const qtd = num(item.quantidadeVendida);
          if (pid) {
            if (!vendasPorProd[pid]) vendasPorProd[pid] = { v: 0, q: 0 };
            vendasPorProd[pid].v += val; vendasPorProd[pid].q += qtd;
          }
        });
      }
    });

    // Sales from produtos/vendas
    rProdVendas.data.forEach(pv => {
      const pid = pv.idProduto || pv.id;
      const val = num(pv.valorTotal || pv.valor);
      const qtd = num(pv.quantidade || pv.quantidadeVendida || 1);
      if (pid && val > 0) {
        if (!vendasPorProd[pid]) vendasPorProd[pid] = { v: 0, q: 0 };
        vendasPorProd[pid].v += val; vendasPorProd[pid].q += qtd;
      }
    });

    // Sales from vendas (general)
    let totalVendaPeriodo = 0, cuponsPeriodo = 0;
    const vendasPorDia = {};
    rVendas.data.forEach(v => {
      if (v.cancelada) return;
      const val = num(v.valorTotal);
      totalVendaPeriodo += val; cuponsPeriodo++;
      const dia = (v.data || v.dataVenda || v.dataEmissao || "").substring(0, 10);
      if (dia) {
        if (!vendasPorDia[dia]) vendasPorDia[dia] = { v: 0, c: 0 };
        vendasPorDia[dia].v += val; vendasPorDia[dia].c++;
      }
      if (Array.isArray(v.itens)) {
        v.itens.forEach(item => {
          if (item.cancelado) return;
          const pid = item.idProduto;
          const ival = num(item.precoVenda) * num(item.quantidadeVendida);
          const qtd = num(item.quantidadeVendida);
          if (pid) {
            if (!vendasPorProd[pid]) vendasPorProd[pid] = { v: 0, q: 0 };
            vendasPorProd[pid].v += ival; vendasPorProd[pid].q += qtd;
          }
        });
      }
    });

    const totalVenda = totalVendaPeriodo > 0 ? totalVendaPeriodo : vendasHojeTotal;
    const cupons = cuponsPeriodo > 0 ? cuponsPeriodo : vendasHojeCupons;

    // Purchases
    let totalCompra = 0, totalEntradas = 0;
    const comprasPorForn = {};
    rEntradas.data.forEach(e => {
      const val = num(e.valorTotal || e.total || e.valor || e.valorProdutos);
      totalCompra += val; totalEntradas++;
      const fid = e.idFornecedor || e.fornecedorId;
      const fnome = e.nomeFornecedor || e.razaoSocialFornecedor || e.fornecedor || "";
      const key = fid || fnome;
      if (key) {
        if (!comprasPorForn[key]) comprasPorForn[key] = { cp: 0, cnt: 0, last: "", nome: fnome };
        comprasPorForn[key].cp += val; comprasPorForn[key].cnt++;
        const dt2 = e.dataEntrada || e.data || "";
        if (dt2 > comprasPorForn[key].last) comprasPorForn[key].last = dt2;
      }
    });

    // Financial
    let totalReceber = 0, totalReceberVencido = 0;
    rReceber.data.forEach(r => {
      const val = num(r.valor || r.valorOriginal || r.valorTitulo);
      totalReceber += val;
      const venc = r.dataVencimento || "";
      if (venc && venc < today) totalReceberVencido += val;
    });
    let totalPagar = 0, totalPagarVencido = 0;
    rPagar.data.forEach(r => {
      const val = num(r.valor || r.valorOriginal || r.valorTitulo);
      totalPagar += val;
      const venc = r.dataVencimento || "";
      if (venc && venc < today) totalPagarVencido += val;
    });
    const totalDespesas = rDespesas.data.reduce((a, r) => a + num(r.valor || r.valorTotal), 0);

    // Vendas cartoes breakdown
    const cartoesTipos = {};
    rVendasCart.data.forEach(vc => {
      const tipo = vc.descricao || vc.tipo || vc.bandeira || "Outro";
      const val = num(vc.valor || vc.valorTotal);
      if (!cartoesTipos[tipo]) cartoesTipos[tipo] = 0;
      cartoesTipos[tipo] += val;
    });

    // Vendas finalizadoras breakdown
    const finalizadoras = {};
    rVendasFin.data.forEach(vf => {
      const tipo = vf.descricao || vf.finalizadora || "Outro";
      const val = num(vf.valor || vf.valorTotal);
      if (!finalizadoras[tipo]) finalizadoras[tipo] = 0;
      finalizadoras[tipo] += val;
    });

    // Ofertas
    const ofertasAtivas = rOfertas.data.filter(o => {
      const fim = o.dataFinal || o.dataFim || "";
      return !fim || fim >= today;
    }).length;

    // Vencimentos
    const vencProximos = rVencimentos.data.filter(v => {
      const venc = v.dataVencimento || v.data || "";
      return venc && venc <= dEnd && venc >= dStart;
    }).length;

    // Perdas
    const totalPerdas = rPerdas.data.reduce((a, p) => a + num(p.valor || p.valorTotal || p.quantidade), 0);

    // Enrich products
    let enriched = 0;
    produtos.forEach(p => {
      const s = vendasPorProd[p.id];
      if (s) { p.vd = Math.round(s.v * 100) / 100; p.qt = Math.round(s.q * 100) / 100; p.lu = Math.round((p.mg / 100) * s.v * 100) / 100; enriched++; }
      else { p.vd = 0; p.qt = 0; p.lu = 0; }
    });

    // Setores
    const gm = {};
    produtos.forEach(p => {
      const g = p.g || "Outros";
      if (!gm[g]) gm[g] = { n: g, vd: 0, cp: 0, sk: 0, mgS: 0, mgC: 0, estT: 0, rupt: 0 };
      gm[g].vd += p.vd; gm[g].sk++; gm[g].estT += p.e;
      if (p.e <= 0 && p.c !== "D") gm[g].rupt++;
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
        sk: s.sk, est: Math.round(s.estT), rupt: s.rupt,
      };
    }).sort((a, b) => b.vd - a.vd).slice(0, 50);

    // Fornecedores
    const fornecedores = rForn.data.map(fo => {
      const nome = fo.razaoSocial || fo.nomeFantasia || fo.nome || "";
      const ed = comprasPorForn[fo.id] || Object.values(comprasPorForn).find(x => x.nome && nome && x.nome.toLowerCase().includes(nome.toLowerCase().substring(0, 8)));
      return {
        id: fo.id, n: nome.substring(0, 50),
        cp: ed ? Math.round(ed.cp * 100) / 100 : 0,
        cnt: ed?.cnt || 0, uc: ed?.last?.substring(0, 10) || "",
        pr: produtos.filter(p => p.f && nome && p.f.toLowerCase().includes(nome.toLowerCase().substring(0, 8))).length,
        cn: fo.cnpj || "", dias: fo.diasPrevisaoEntrega || 0,
      };
    }).filter(fo => fo.n).sort((a, b) => b.cp - a.cp);

    // Daily chart
    const vd7 = Object.entries(vendasPorDia).sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([d, v]) => {
      let label;
      try { label = new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); } catch { label = d.substring(5); }
      return { d: label, v: Math.round(v.v), c: v.c, dt: d };
    });

    const mgMedia = produtos.length > 0 ? produtos.reduce((a, p) => a + p.mg, 0) / produtos.length : 0;

    // Contas details
    const contasReceber = rReceber.data.slice(0, 500).map(r => ({
      valor: num(r.valor || r.valorOriginal), venc: r.dataVencimento || "", cliente: r.nomeCliente || r.cliente || "",
      doc: r.documento || r.numero || "", status: r.situacao || r.status || "",
    }));
    const contasPagar = rPagar.data.slice(0, 500).map(r => ({
      valor: num(r.valor || r.valorOriginal), venc: r.dataVencimento || "", forn: r.nomeFornecedor || r.fornecedor || "",
      doc: r.documento || r.numero || "", status: r.situacao || r.status || "",
    }));

    // Despesas details
    const despesasDetail = rDespesas.data.slice(0, 200).map(d => ({
      valor: num(d.valor || d.valorTotal), desc: d.descricao || d.tipo || "", data: d.data || d.dataVencimento || "",
    }));

    // Pedidos compra
    const pedidosCompra = rPedidos.data.slice(0, 200).map(p => ({
      id: p.id, forn: p.nomeFornecedor || p.fornecedor || "", valor: num(p.valorTotal || p.valor),
      data: p.data || p.dataPedido || "", status: p.situacao || p.status || "",
    }));

    const elapsed = Date.now() - startTime;
    console.log(`[SYNC] DONE ${elapsed}ms — ${produtos.length} prod, R$${totalVenda.toFixed(2)} vendas, R$${totalCompra.toFixed(2)} compras`);

    return Response.json({
      success: true, syncedAt: new Date().toISOString(), elapsed,
      report, stats: { total: Object.keys(report).length, success: successCount, failed: Object.keys(report).length - successCount },
      dateRange: { start: dStart, end: dEnd },
      dashboard: {
        produtos: produtos.sort((a, b) => b.vd - a.vd).slice(0, 6000),
        setores, fornecedores,
        vendasDiarias: vd7,
        contasReceber, contasPagar, despesas: despesasDetail, pedidosCompra,
        kpis: {
          receitaBruta: Math.round(totalVenda * 100) / 100,
          vendasHoje: Math.round(vendasHojeTotal * 100) / 100,
          vendasHojeCupons,
          totalCompra: Math.round(totalCompra * 100) / 100,
          totalEntradas,
          lucroBruto: Math.round(produtos.reduce((a, p) => a + (p.lu || 0), 0) * 100) / 100,
          margemMedia: Math.round(mgMedia * 100) / 100,
          rcv: totalVenda > 0 ? Math.round((totalCompra / totalVenda) * 10000) / 100 : 0,
          totalQtd: Math.round(produtos.reduce((a, p) => a + (p.qt || 0), 0)),
          cupons, ticketMedio: cupons > 0 ? Math.round((totalVenda / cupons) * 100) / 100 : 0,
          contasReceber: Math.round(totalReceber * 100) / 100,
          contasReceberVencido: Math.round(totalReceberVencido * 100) / 100,
          contasPagar: Math.round(totalPagar * 100) / 100,
          contasPagarVencido: Math.round(totalPagarVencido * 100) / 100,
          saldo: Math.round((totalReceber - totalPagar) * 100) / 100,
          despesas: Math.round(totalDespesas * 100) / 100,
          totalProdutos: produtos.length,
          totalFornecedores: fornecedores.length,
          totalClientes: rClientes.count,
          ruptura: produtos.filter(p => p.e <= 0 && p.c !== "D").length,
          estBaixo: produtos.filter(p => p.e > 0 && p.e < 10).length,
          mgNegativa: produtos.filter(p => p.mg < 0 && p.pr > 0).length,
          ofertasAtivas, vencProximos, totalPerdas: Math.round(totalPerdas * 100) / 100,
          pdvAtivos: rPDV.count, vendedores: rVendedores.count, compradores: rCompradores.count,
          produtosEnriched: enriched,
        },
        extras: {
          cartoesTipos: Object.entries(cartoesTipos).map(([k, v]) => ({ n: k, v: Math.round(v) })).sort((a, b) => b.v - a.v),
          finalizadoras: Object.entries(finalizadoras).map(([k, v]) => ({ n: k, v: Math.round(v) })).sort((a, b) => b.v - a.v),
          ofertas: rOfertas.data.slice(0, 100),
          vencimentos: rVencimentos.data.slice(0, 100),
          perdas: rPerdas.data.slice(0, 100),
          filiais: rFiliais.data,
          departamentos: rDepts.data.map(d => ({ id: d.id, n: d.descricao || "" })),
          subgrupos: rDept2.data.map(d => ({ id: d.id, n: d.descricao || "" })),
          marcas: rMarcas.data.map(m => ({ id: m.id, n: m.descricao || "" })),
          classes: rClasses.data.map(c => ({ id: c.id, n: c.descricao || "" })),
          fornecedoresLista: rForn.data.map(f => f.razaoSocial || f.nomeFantasia || "").filter(Boolean),
        },
        isReal: true,
      },
    });
  } catch (err) {
    console.error("[SYNC] Fatal:", err);
    return Response.json({ error: "Erro na sincronização", detail: err.message }, { status: 500 });
  }
}

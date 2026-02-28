// lib/transform.js — Transforms SG Sistemas data to dashboard format

// Aggressive field getter — tries many variations
const g = (o, ...ks) => {
  if (!o) return null;
  for (const k of ks) {
    if (o[k] !== undefined && o[k] !== null) return o[k];
    // Try lowercase, uppercase, camelCase variations
    const lk = k.toLowerCase();
    const uk = k.toUpperCase();
    const ck = k.charAt(0).toUpperCase() + k.slice(1);
    for (const v of [lk, uk, ck]) {
      if (o[v] !== undefined && o[v] !== null) return o[v];
    }
  }
  // Last resort: scan all keys for partial match
  const keys = Object.keys(o);
  for (const k of ks) {
    const lk = k.toLowerCase();
    const found = keys.find(ok => ok.toLowerCase() === lk || ok.toLowerCase().includes(lk));
    if (found && o[found] !== undefined) return o[found];
  }
  return null;
};

const n = v => { if (v == null || v === "") return 0; const x = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v); return isNaN(x) ? 0 : x; };
const s = v => v == null ? "" : String(v).trim();

export function buildDashboard(raw) {
  // === LOOKUP MAPS ===
  const estoqueMap = {};
  (raw.estoque || []).forEach(e => {
    const id = g(e, "idProduto", "id_produto", "produtoId", "codigo", "id", "codigoProduto");
    if (id != null) estoqueMap[String(id)] = n(g(e, "quantidade", "qtd", "saldo", "estoque", "qtdEstoque", "saldoAtual"));
  });

  const precoMap = {};
  (raw.precos || []).forEach(p => {
    const id = g(p, "idProduto", "id_produto", "produtoId", "codigo", "id", "codigoProduto");
    if (id != null) precoMap[String(id)] = n(g(p, "preco", "precoVenda", "valor", "vlrVenda", "precoAtual"));
  });

  const grupoMap = {};
  (raw.grupos || []).forEach(x => {
    const id = g(x, "id", "idGrupo", "codigo"); if (id != null) grupoMap[String(id)] = s(g(x, "descricao", "nome", "grupo"));
  });

  const subgrupoMap = {};
  (raw.subgrupos || []).forEach(x => {
    const id = g(x, "id", "idSubgrupo", "codigo"); if (id != null) subgrupoMap[String(id)] = s(g(x, "descricao", "nome"));
  });

  const marcaMap = {};
  (raw.marcas || []).forEach(x => {
    const id = g(x, "id", "idMarca", "codigo"); if (id != null) marcaMap[String(id)] = s(g(x, "descricao", "nome", "marca"));
  });

  // === PRODUCTS ===
  const produtos = (raw.produtos || []).map(p => {
    const id = g(p, "id", "idProduto", "codigo", "codigoProduto", "codProduto");
    const sid = String(id);
    const custo = n(g(p, "custoMedio", "custo", "precoCusto", "valorCusto", "vlrCusto", "custoUnitario"));
    const preco = precoMap[sid] || n(g(p, "precoVenda", "preco", "valorVenda", "vlrVenda"));
    const est = estoqueMap[sid] ?? n(g(p, "estoque", "saldoEstoque", "qtdEstoque", "quantidade"));
    const gid = g(p, "idGrupo", "grupoId", "grupo", "codGrupo");
    const sgid = g(p, "idSubgrupo", "subgrupoId", "subgrupo", "codSubgrupo");
    const mid = g(p, "idMarca", "marcaId", "marca", "codMarca");
    const mg = preco > 0 ? Math.round(((preco - custo) / preco) * 10000) / 100 : 0;

    return {
      id, nome: s(g(p, "descricao", "nome", "produto", "nomeProduto", "descProduto")),
      grupo: grupoMap[String(gid)] || s(gid) || "Sem Grupo",
      sub: subgrupoMap[String(sgid)] || s(sgid) || "",
      marca: marcaMap[String(mid)] || s(mid) || "",
      curva: s(g(p, "curva", "curvaAbc", "classificacao")) || "C",
      custo, preco, mg, est,
      forn: s(g(p, "fornecedor", "nomeFornecedor", "razaoSocialFornecedor")) || "",
      fornId: g(p, "idFornecedor", "fornecedorId", "codFornecedor"),
      vd: 0, qtd: 0, lucro: 0, meta_mg: 25,
    };
  }).filter(p => p.nome && p.id != null);

  // === SALES ===
  let totalVenda = 0, totalQtdVenda = 0, cupons = 0;
  const vendaPorProd = {};
  const vendaPorDia = {};

  (raw.vendas || []).forEach(v => {
    const val = n(g(v, "valorTotal", "total", "valor", "vlrTotal", "vlrVenda"));
    const qt = n(g(v, "quantidade", "qtd", "qtdItens")) || 1;
    totalVenda += val; totalQtdVenda += qt; cupons++;
    
    const pid = g(v, "idProduto", "produtoId", "codigoProduto", "codProduto");
    if (pid != null) {
      const sp = String(pid);
      if (!vendaPorProd[sp]) vendaPorProd[sp] = { vd: 0, qtd: 0 };
      vendaPorProd[sp].vd += val; vendaPorProd[sp].qtd += qt;
    }
    
    const dt = s(g(v, "data", "dataVenda", "dtVenda", "dataEmissao"));
    const dia = dt.substring(0, 10);
    if (dia) { if (!vendaPorDia[dia]) vendaPorDia[dia] = 0; vendaPorDia[dia] += val; }
  });

  // Also use vendasHoje
  (raw.vendasHoje || []).forEach(v => {
    const val = n(g(v, "valorTotal", "total", "valor"));
    totalVenda += val; cupons++;
  });

  // Enrich products with sales
  produtos.forEach(p => {
    const vp = vendaPorProd[String(p.id)];
    if (vp) { p.vd = vp.vd; p.qtd = vp.qtd; p.lucro = Math.round((p.mg / 100) * vp.vd); }
  });

  // === PURCHASES ===
  let totalCompra = 0;
  const compraPorForn = {};
  (raw.entradas || []).forEach(e => {
    const val = n(g(e, "valorTotal", "total", "valor", "vlrTotal"));
    totalCompra += val;
    const fid = g(e, "idFornecedor", "fornecedorId", "codFornecedor");
    if (fid != null) {
      const sf = String(fid);
      if (!compraPorForn[sf]) compraPorForn[sf] = { cp: 0, last: "" };
      compraPorForn[sf].cp += val;
      const dt = s(g(e, "dataEntrada", "data", "dtEntrada"));
      if (dt > compraPorForn[sf].last) compraPorForn[sf].last = dt;
    }
  });

  // === SUPPLIERS ===
  const fornecedores = (raw.fornecedores || []).map(f => {
    const fid = g(f, "id", "idFornecedor", "codigo", "codFornecedor");
    const cf = compraPorForn[String(fid)] || {};
    return {
      id: fid,
      n: s(g(f, "razaoSocial", "nome", "nomeFantasia", "descricao", "fornecedor")),
      cp: cf.cp || 0, uc: cf.last || "",
      pr: produtos.filter(p => String(p.fornId) === String(fid)).length,
      lt: n(g(f, "prazoEntrega", "leadTime")) || 3,
      cd: s(g(f, "condicaoPagamento", "condPagamento")) || "—",
      cnpj: s(g(f, "cnpj", "cpfCnpj")),
      fone: s(g(f, "telefone", "fone")), email: s(g(f, "email")),
    };
  }).filter(f => f.n);

  // === SECTORS (from product groups) ===
  const gm = {};
  produtos.forEach(p => {
    if (!gm[p.grupo]) gm[p.grupo] = { n: p.grupo, vd: 0, cp: 0, sk: 0, mgS: 0, mgC: 0 };
    gm[p.grupo].vd += p.vd; gm[p.grupo].sk++;
    if (p.mg) { gm[p.grupo].mgS += p.mg; gm[p.grupo].mgC++; }
  });
  const tvs = Object.values(gm).reduce((a, s) => a + s.vd, 0);
  const setores = Object.values(gm).map(s => ({
    n: s.n, vd: s.vd, cp: Math.round(s.vd * (totalCompra / (totalVenda || 1))),
    mg: s.mgC > 0 ? Math.round((s.mgS / s.mgC) * 100) / 100 : 0,
    pt: tvs > 0 ? Math.round((s.vd / tvs) * 1000) / 10 : 0,
    rcv: s.vd > 0 ? Math.round((s.vd * (totalCompra / (totalVenda || 1)) / s.vd) * 1000) / 10 : 0,
    mv: Math.round(s.vd * 1.05), mm: 25, sk: s.sk,
  })).sort((a, b) => b.vd - a.vd);

  // === FINANCIAL ===
  const totReceber = (raw.contasReceber || []).reduce((a, r) => a + n(g(r, "valor", "valorOriginal", "vlrOriginal")), 0);
  const totPagar = (raw.contasPagar || []).reduce((a, p) => a + n(g(p, "valor", "valorOriginal", "vlrOriginal")), 0);
  const totDespesas = (raw.despesas || []).reduce((a, d) => a + n(g(d, "valor", "vlrDespesa")), 0);

  // === DAILY CHART ===
  const vd7 = Object.entries(vendaPorDia).sort(([a], [b]) => a.localeCompare(b)).slice(-7)
    .map(([d, v]) => ({ d: new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }), v, m: v * 1.05 }));

  // === SUMMARY ===
  return {
    produtos: produtos.sort((a, b) => b.vd - a.vd),
    setores, fornecedores: fornecedores.sort((a, b) => b.cp - a.cp),
    vendasDiarias: vd7.length > 0 ? vd7 : null,
    kpis: {
      receitaBruta: totalVenda, totalCompra,
      rcv: totalVenda > 0 ? Math.round((totalCompra / totalVenda) * 10000) / 100 : 0,
      totalQtd: totalQtdVenda, cupons,
      ticketMedio: cupons > 0 ? Math.round((totalVenda / cupons) * 100) / 100 : 0,
      contasReceber: totReceber, contasPagar: totPagar,
      saldo: totReceber - totPagar, despesas: totDespesas,
      totalProdutos: produtos.length, totalFornecedores: fornecedores.length,
      totalClientes: (raw.clientes || []).length,
      totalUsuarios: (raw.usuarios || []).length,
    },
    rawCounts: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])),
    syncedAt: new Date().toISOString(),
  };
}

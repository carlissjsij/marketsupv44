const EPS = [
  { k: "produtos", p: "/produtos" },
  { k: "estoque", p: "/produtos/estoque" },
  { k: "precos", p: "/produtos/precos" },
  { k: "grupos", p: "/produtos/grupos" },
  { k: "subgrupos", p: "/produtos/subgrupos" },
  { k: "marcas", p: "/produtos/marcas" },
  { k: "embalagens", p: "/produtos/embalagens" },
  { k: "locais", p: "/produtos/locais" },
  { k: "vendas", p: "/vendas" },
  { k: "vendasHoje", p: "/vendas/hoje" },
  { k: "vendasFinalizadoras", p: "/vendas/finalizadoras" },
  { k: "pdv", p: "/pdv" },
  { k: "saidas", p: "/saidas" },
  { k: "saidasProdutos", p: "/saidas/produtos" },
  { k: "saidasChave", p: "/saidas/chave" },
  { k: "entradas", p: "/entradas" },
  { k: "entradasProdutos", p: "/entradas/produtos" },
  { k: "entradasPedidos", p: "/entradas/pedidoscompra" },
  { k: "entradasChave", p: "/entradas/chave" },
  { k: "pedidosCompra", p: "/pedidoscompra" },
  { k: "pedidosCompraProd", p: "/pedidoscompra/produtos" },
  { k: "pedidosCompraStatus", p: "/pedidoscompra/status" },
  { k: "contasReceber", p: "/contas/receber" },
  { k: "contasPagar", p: "/contas/pagar" },
  { k: "despesas", p: "/despesas" },
  { k: "condicoesPgto", p: "/condicoespagamento" },
  { k: "prazosPgto", p: "/prazospagamento" },
  { k: "fornecedores", p: "/fornecedores" },
  { k: "clientes", p: "/clientes" },
  { k: "usuarios", p: "/usuarios" },
  { k: "compradores", p: "/compradores" },
  { k: "vendedores", p: "/vendedores" },
  { k: "nfs", p: "/nfs" },
  { k: "nfsServicos", p: "/nfs/servicos" },
  { k: "series", p: "/series" },
  { k: "tabelasPreco", p: "/tabelaspreco" },
  { k: "tabelasPrecoItens", p: "/tabelaspreco/itens" },
];

async function get(base, token, path) {
  try {
    const h = { "Accept": "application/json" };
    if (token.startsWith("Basic ")) h["Authorization"] = token;
    else h["Authorization"] = `Bearer ${token}`;
    
    const r = await fetch(`${base}${path}`, { headers: h });
    if (!r.ok) return { ok: false, s: r.status, d: [] };
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch { return { ok: false, s: 0, d: [] }; }
    let a = j;
    if (!Array.isArray(a)) a = j.data||j.items||j.result||j.results||j.registros||j.lista||j.content||j.Data||j.Items||j.Result||j.Registros;
    if (!Array.isArray(a)) a = (j && typeof j==="object") ? [j] : [];
    return { ok: true, s: r.status, d: a, n: a.length };
  } catch (e) { return { ok: false, s: 0, d: [], e: e.message }; }
}

export async function POST(req) {
  try {
    const { baseUrl, token } = await req.json();
    if (!baseUrl || !token) return Response.json({ error: "Faltam parâmetros" }, { status: 400 });
    const b = baseUrl.replace(/\/+$/, "");
    const t0 = Date.now();
    const res = {}; const data = {}; const report = {};
    
    for (let i = 0; i < EPS.length; i += 5) {
      const batch = EPS.slice(i, i + 5);
      const rr = await Promise.all(batch.map(e => get(b, token, e.p)));
      batch.forEach((e, idx) => {
        res[e.k] = rr[idx];
        data[e.k] = rr[idx].d;
        report[e.k] = { path: e.p, ok: rr[idx].ok, count: rr[idx].n || 0, error: rr[idx].e };
      });
    }

    const ok = Object.values(res).filter(r => r.ok).length;
    return Response.json({
      success: true, syncedAt: new Date().toISOString(), elapsed: Date.now() - t0,
      stats: { total: EPS.length, success: ok, failed: EPS.length - ok }, report, data,
    });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}

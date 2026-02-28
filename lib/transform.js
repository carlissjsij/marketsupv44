// lib/transform.js — SG Sistemas EXACT fields
// API returns: { data: [...], paginacao: { pagina, itensPorPagina, quantidadeItens } }

export function extractArray(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (response.data && Array.isArray(response.data)) return response.data;
  if (response.items && Array.isArray(response.items)) return response.items;
  if (response.result && Array.isArray(response.result)) return response.result;
  if (typeof response === "object" && response.id) return [response];
  return [];
}

const num = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
  return isNaN(n) ? 0 : n;
};

export function transformProdutos(raw, rawGrupos, rawSubgrupos, rawMarcas) {
  const produtos = extractArray(raw);
  const grupos = extractArray(rawGrupos);
  const marcas = extractArray(rawMarcas);
  const grupoMap = {}; grupos.forEach(g => { if(g.id!=null) grupoMap[g.id] = g.descricao||g.nome||""; });
  const marcaMap = {}; marcas.forEach(m => { if(m.id!=null) marcaMap[m.id] = m.descricao||m.nome||""; });

  return produtos.filter(p => p.ativo !== false).map(p => {
    const custo = num(p.custoMedio || p.custoReal || p.custoComEncargos || p.precoDeCusto);
    const preco = num(p.precoDeVenda2 || p.precoDeVenda1 || p.precoVenda);
    const est = num(p.estoqueAtual || p.estoque);
    const mg = preco > 0 ? ((preco - custo) / preco) * 100 : 0;
    const curva = (p.curvaABC || p.curva || "D").toUpperCase();
    return {
      id: p.id, nome: p.descricao || p.nome || "",
      grupo: grupoMap[p.departamentalizacaoNivel1] || `Dept ${p.departamentalizacaoNivel1||"?"}`,
      sub: "", marca: marcaMap[p.marca] || "",
      curva, custo: Math.round(custo*100)/100, preco: Math.round(preco*100)/100,
      mg: Math.round(mg*100)/100, est: Math.round(est*1000)/1000,
      forn: p.ultimoFornecedor || "", unidade: p.unidadeDeMedida || "UN",
      ativo: true, vd:0, qtd:0, lucro:0,
      meta_mg: curva==="A"?22:curva==="B"?28:curva==="C"?32:25,
    };
  }).filter(p => p.nome && p.id);
}

export function transformFornecedores(raw, rawCond) {
  const forn = extractArray(raw);
  const cond = extractArray(rawCond);
  const condMap = {}; cond.forEach(c => { if(c.id!=null) condMap[c.id] = c.descricao||""; });
  return forn.map(f => ({
    id: f.id||f.codigo, n: f.razaoSocial||f.nomeFantasia||f.nome||f.descricao||"",
    cnpj: f.cnpjCpf||f.cnpj||"", cp:0, pr:0,
    lt: num(f.prazoEntrega)||3, cd: condMap[f.idCondicaoPagamento]||"—", uc:"",
  })).filter(f => f.n);
}

export function transformVendas(raw) {
  const vendas = extractArray(raw);
  let totalVenda=0, totalQtd=0, cupons=0;
  const porProduto={}, porDia={};
  vendas.forEach(v => {
    const valor = num(v.valorTotal||v.total||v.valor||v.valorLiquido);
    const qtd = num(v.quantidadeItens||v.quantidade||1);
    totalVenda += valor; totalQtd += qtd; cupons++;
    const prodId = v.idProduto||v.produtoId;
    if(prodId){ if(!porProduto[prodId]) porProduto[prodId]={vd:0,qtd:0}; porProduto[prodId].vd+=valor; porProduto[prodId].qtd+=qtd; }
    const data = v.data||v.dataVenda||v.dataEmissao||"";
    const dia = typeof data==="string"?data.substring(0,10):"";
    if(dia){ if(!porDia[dia]) porDia[dia]={v:0,c:0}; porDia[dia].v+=valor; porDia[dia].c++; }
  });
  return { totalVenda, totalQtd, cupons, porProduto, porDia };
}

export function transformEntradas(raw) {
  const entradas = extractArray(raw);
  let totalCompra=0; const porFornecedor={};
  entradas.forEach(e => {
    const valor = num(e.valorTotal||e.total||e.valor||e.valorProdutos);
    totalCompra += valor;
    const fornId = e.idFornecedor||e.fornecedorId;
    const fornNome = e.nomeFornecedor||e.razaoSocialFornecedor||"";
    const key = fornId||fornNome;
    if(key){ if(!porFornecedor[key]) porFornecedor[key]={cp:0,count:0,lastDate:"",nome:fornNome}; porFornecedor[key].cp+=valor; porFornecedor[key].count++; const dt=e.dataEntrada||e.data||""; if(dt>porFornecedor[key].lastDate) porFornecedor[key].lastDate=dt; }
  });
  return { totalCompra, porFornecedor };
}

export function transformFinanceiro(rawRec, rawPag, rawDesp) {
  const rec = extractArray(rawRec), pag = extractArray(rawPag), desp = extractArray(rawDesp);
  const totalReceber = rec.reduce((a,r) => a+num(r.valor||r.valorOriginal||r.valorTitulo),0);
  const totalPagar = pag.reduce((a,p) => a+num(p.valor||p.valorOriginal||p.valorTitulo),0);
  const totalDespesas = desp.reduce((a,d) => a+num(d.valor||d.valorTotal),0);
  return { totalReceber, totalPagar, totalDespesas, saldo: totalReceber-totalPagar };
}

export function buildDashboard(rawData) {
  console.log("[BUILD] Starting dashboard build...");
  
  const produtos = transformProdutos(rawData.produtos, rawData.grupos, rawData.subgrupos, rawData.marcas);
  const fornecedores = transformFornecedores(rawData.fornecedores, rawData.condicoesPagamento);
  const vd = transformVendas(rawData.vendas);
  const vendasHoje = transformVendas(rawData.vendasHoje);
  const ent = transformEntradas(rawData.entradas);
  const fin = transformFinanceiro(rawData.contasReceber, rawData.contasPagar, rawData.despesas);

  console.log(`[BUILD] ${produtos.length} produtos, ${fornecedores.length} fornecedores`);
  console.log(`[BUILD] Vendas R$${vd.totalVenda.toFixed(2)}, Compras R$${ent.totalCompra.toFixed(2)}`);

  // Enrich products
  produtos.forEach(p => {
    const s = vd.porProduto[p.id];
    if(s){ p.vd=Math.round(s.vd*100)/100; p.qtd=Math.round(s.qtd*100)/100; p.lucro=Math.round((p.mg/100)*s.vd*100)/100; }
  });

  // Enrich fornecedores
  fornecedores.forEach(f => {
    const e = ent.porFornecedor[f.id] || Object.values(ent.porFornecedor).find(x => x.nome && f.n && x.nome.toLowerCase().includes(f.n.toLowerCase().substring(0,8)));
    if(e){ f.cp=Math.round(e.cp*100)/100; f.uc=e.lastDate?.substring(0,10)||""; }
    f.pr = produtos.filter(p => p.forn && f.n && (p.forn.toLowerCase().includes(f.n.toLowerCase().substring(0,8)) || f.n.toLowerCase().includes(p.forn.toLowerCase().substring(0,8)))).length;
  });

  // Build setores
  const gm = {};
  produtos.forEach(p => {
    const g = p.grupo||"Outros";
    if(!gm[g]) gm[g]={n:g,vd:0,sk:0,mgS:0,mgC:0};
    gm[g].vd+=p.vd; gm[g].sk++; if(p.mg){gm[g].mgS+=p.mg;gm[g].mgC++;}
  });
  const tvs = Object.values(gm).reduce((a,s)=>a+s.vd,0)||1;
  const setores = Object.values(gm).map(s => {
    const mg = s.mgC>0?Math.round((s.mgS/s.mgC)*100)/100:0;
    const cp = ent.totalCompra>0?Math.round((s.vd/tvs)*ent.totalCompra):Math.round(s.vd*0.72);
    return { n:s.n, vd:Math.round(s.vd), cp, mg, pt:Math.round((s.vd/tvs)*1000)/10, rcv:s.vd>0?Math.round((cp/s.vd)*1000)/10:0, mv:Math.round(s.vd*1.05), mm:25, sk:s.sk };
  }).sort((a,b)=>b.vd-a.vd).slice(0,20);

  // Daily chart
  const vendasDiarias = Object.entries(vd.porDia).sort(([a],[b])=>a.localeCompare(b)).slice(-7).map(([d,v])=>{
    let label; try{label=new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short"}).replace(".","");}catch{label=d.substring(8,10);}
    return {d:label,v:Math.round(v.v),m:Math.round(v.v*1.05)};
  });

  const mgMedia = produtos.length>0?produtos.reduce((a,p)=>a+p.mg,0)/produtos.length:0;

  return {
    produtos: produtos.sort((a,b)=>b.vd-a.vd),
    setores, fornecedores: fornecedores.filter(f=>f.n).sort((a,b)=>b.cp-a.cp),
    vendasDiarias: vendasDiarias.length>0?vendasDiarias:null,
    kpis: {
      receitaBruta:Math.round(vd.totalVenda*100)/100, totalCompra:Math.round(ent.totalCompra*100)/100,
      lucroBruto:Math.round(produtos.reduce((a,p)=>a+p.lucro,0)*100)/100,
      margemMedia:Math.round(mgMedia*100)/100,
      rcv:vd.totalVenda>0?Math.round((ent.totalCompra/vd.totalVenda)*10000)/100:0,
      totalQtd:Math.round(vd.totalQtd), cupons:vd.cupons,
      ticketMedio:vd.cupons>0?Math.round((vd.totalVenda/vd.cupons)*100)/100:0,
      contasReceber:Math.round(fin.totalReceber*100)/100, contasPagar:Math.round(fin.totalPagar*100)/100,
      saldo:Math.round(fin.saldo*100)/100, despesas:Math.round(fin.totalDespesas*100)/100,
      totalProdutos:produtos.length, totalFornecedores:fornecedores.length,
      totalClientes:extractArray(rawData.clientes).length,
      totalUsuarios:extractArray(rawData.usuarios).length,
      ruptura:produtos.filter(p=>p.est<=0&&p.curva!=="D").length,
      estBaixo:produtos.filter(p=>p.est>0&&p.est<10).length,
      mgNegativa:produtos.filter(p=>p.mg<0&&p.preco>0).length,
      vendasHoje:vendasHoje.totalVenda,
    },
    syncedAt:new Date().toISOString(), isReal:true,
    rawCounts:{
      produtos:extractArray(rawData.produtos).length, vendas:extractArray(rawData.vendas).length,
      entradas:extractArray(rawData.entradas).length, fornecedores:extractArray(rawData.fornecedores).length,
    },
  };
}

"use client";
import{useState,useRef,useEffect,useMemo,useCallback}from"react";
import{authenticate,syncAll,saveConfig,loadConfig}from"../lib/api-client";

/* ═══ THEME ═══ */
const C={bg:"#f4f5f9",w:"#ffffff",brd:"#e0e3ed",brd2:"#d0d4e0",
acc:"#2563eb",accBg:"#eff6ff",accBd:"#bfdbfe",
g:"#15803d",gL:"#16a34a",gBg:"#f0fdf4",gBd:"#bbf7d0",
r:"#dc2626",rBg:"#fef2f2",rBd:"#fecaca",
a:"#b45309",aBg:"#fffbeb",aBd:"#fde68a",
cy:"#0e7490",cyBg:"#ecfeff",
pu:"#7c3aed",puBg:"#f5f3ff",
tx:"#111827",tx2:"#4b5563",tx3:"#9ca3af",
gold:"#b8860b",goldBg:"#fefce8",
sh:"0 1px 3px rgba(0,0,0,.06)"};
const F="'Inter',system-ui,-apple-system,sans-serif",M="'JetBrains Mono',monospace";

/* ═══ STATE ═══ */
let ST={produtos:[],setores:[],fornecedores:[],vd:[],kpis:{},contasReceber:[],contasPagar:[],despesas:[],pedidos:[],extras:{}};
const n=v=>{if(v==null||v==="")return 0;const x=typeof v==="string"?parseFloat(v.replace(",",".")):Number(v);return isNaN(x)?0:x};
const fmt=v=>{if(v==null||isNaN(v))return"—";if(Math.abs(v)>=1e6)return(v/1e6).toFixed(2).replace(".",",")+"M";if(Math.abs(v)>=1e3)return v.toLocaleString("pt-BR",{maximumFractionDigits:0});return v.toLocaleString("pt-BR",{maximumFractionDigits:2})};
const fR=v=>"R$ "+fmt(v);
const fP=v=>v==null?"—":v.toFixed(2).replace(".",",")+"%";
const dateF=(k)=>{const now=new Date(),p=n=>String(n).padStart(2,"0"),f=d=>`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;const e=f(now);let s;
if(k==="hoje")s=e;else if(k==="7d"){const d=new Date(now);d.setDate(d.getDate()-7);s=f(d);}
else if(k==="15d"){const d=new Date(now);d.setDate(d.getDate()-15);s=f(d);}
else if(k==="30d"){const d=new Date(now);d.setDate(d.getDate()-30);s=f(d);}
else if(k==="60d"){const d=new Date(now);d.setDate(d.getDate()-60);s=f(d);}
else if(k==="trim"){const d=new Date(now);d.setMonth(d.getMonth()-3);s=f(d);}
else{s=`${now.getFullYear()}-01-01`;}
return{start:s,end:e};};

/* ═══ KPI CARD — BUSSOLA STYLE ═══ */
function Kpi({icon,label,value,sub,color="blue",onClick,small}){
const colors={blue:{bg:C.accBg,bd:C.accBd,tx:C.acc},green:{bg:C.gBg,bd:C.gBd,tx:C.gL},red:{bg:C.rBg,bd:C.rBd,tx:C.r},amber:{bg:C.aBg,bd:C.aBd,tx:C.a},cyan:{bg:C.cyBg,bd:"#a5f3fc",tx:C.cy},purple:{bg:C.puBg,bd:"#ddd6fe",tx:C.pu},gray:{bg:"#f3f4f6",bd:"#e5e7eb",tx:C.tx2},gold:{bg:C.goldBg,bd:"#fef08a",tx:C.gold}};
const s=colors[color]||colors.blue;
return(<div onClick={onClick} style={{background:C.w,borderRadius:10,padding:small?"10px 12px":"14px 16px",border:`1px solid ${C.brd}`,boxShadow:C.sh,cursor:onClick?"pointer":"default",position:"relative",overflow:"hidden",transition:"box-shadow .15s",...(onClick?{}:{})}}>
<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:s.tx,borderRadius:"10px 10px 0 0"}}/>
<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:small?3:6}}>
{icon&&<span style={{fontSize:small?11:13}}>{icon}</span>}
<span style={{fontSize:small?8:9,color:C.tx3,fontWeight:700,letterSpacing:".5px",textTransform:"uppercase"}}>{label}</span>
{onClick&&<span style={{fontSize:8,color:C.acc,marginLeft:"auto"}}>▸</span>}
</div>
<div style={{fontSize:small?15:22,fontWeight:800,fontFamily:M,color:s.tx,letterSpacing:"-.5px",lineHeight:1}}>{value}</div>
{sub&&<div style={{fontSize:small?8:9,color:C.tx3,marginTop:3,fontWeight:500}}>{sub}</div>}
</div>);
}

/* ═══ TABLE ═══ */
function Tbl({cols,data,max=100,onClick}){
const vis=useMemo(()=>data.slice(0,max),[data,max]);
if(!vis.length)return<div style={{padding:16,textAlign:"center",color:C.tx3,fontSize:12}}>Sem dados</div>;
return(<div style={{overflow:"auto",borderRadius:8,border:`1px solid ${C.brd}`,background:C.w,boxShadow:C.sh}}>
<table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:F}}>
<thead><tr style={{background:"#f8f9fc"}}>{cols.map((c,i)=><th key={i} style={{padding:"7px 8px",textAlign:c.a||"left",fontWeight:700,color:C.tx2,fontSize:9,letterSpacing:".3px",textTransform:"uppercase",borderBottom:`2px solid ${C.brd}`,whiteSpace:"nowrap",position:"sticky",top:0,background:"#f8f9fc"}}>{c.l}</th>)}</tr></thead>
<tbody>{vis.map((row,ri)=>(<tr key={ri} onClick={()=>onClick?.(row)} style={{cursor:onClick?"pointer":"default"}} onMouseEnter={e=>e.currentTarget.style.background="#f8f9fc"} onMouseLeave={e=>e.currentTarget.style.background=C.w}>
{cols.map((c,ci)=><td key={ci} style={{padding:"6px 8px",textAlign:c.a||"left",color:typeof c.cl==="function"?c.cl(row):(c.cl||C.tx),fontFamily:c.m?M:F,fontWeight:c.b?600:400,fontSize:11,whiteSpace:"nowrap",borderBottom:`1px solid #f3f4f6`}}>{typeof c.r==="function"?c.r(row):""}</td>)}
</tr>))}</tbody></table>
{data.length>max&&<div style={{padding:6,fontSize:9,color:C.tx3,textAlign:"center",background:"#f8f9fc"}}>Mostrando {max} de {data.length.toLocaleString()}</div>}
</div>);
}
function Bg({t}){const s={A:{bg:C.gBg,c:C.gL,bd:C.gBd},B:{bg:C.accBg,c:C.acc,bd:C.accBd},C:{bg:C.aBg,c:C.a,bd:C.aBd},D:{bg:"#f3f4f6",c:C.tx3,bd:"#e5e7eb"}};const st=s[t]||s.D;return<span style={{display:"inline-block",padding:"1px 7px",borderRadius:4,fontSize:9,fontWeight:700,fontFamily:M,background:st.bg,color:st.c,border:`1px solid ${st.bd}`}}>{t}</span>;}
function Sel({label,value,options,onChange,w=150}){return(<div style={{display:"flex",flexDirection:"column",gap:2}}><span style={{fontSize:8,color:C.tx3,fontWeight:700,letterSpacing:".5px",textTransform:"uppercase"}}>{label}</span><select value={value} onChange={e=>onChange(e.target.value)} style={{padding:"5px 6px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.w,color:C.tx,fontSize:11,fontFamily:F,outline:"none",width:w,cursor:"pointer"}}>{options.map(o=><option key={typeof o==="string"?o:o.v} value={typeof o==="string"?o:o.v}>{typeof o==="string"?o:o.l}</option>)}</select></div>);}
function Btn({children,onClick,primary,disabled}){return<button onClick={onClick} disabled={disabled} style={{padding:"5px 14px",borderRadius:5,border:primary?"none":`1px solid ${C.brd}`,background:primary?C.acc:C.w,color:primary?C.w:C.tx2,fontSize:10,fontWeight:600,cursor:disabled?"not-allowed":"pointer",fontFamily:F,opacity:disabled?.5:1}}>{children}</button>;}
function RefreshBtn({onClick,syncing}){return<Btn onClick={onClick} disabled={syncing}>{syncing?"⏳":"🔄"} Atualizar</Btn>;}

/* ═══ PERIOD BAR ═══ */
function PeriodBar({active,onChange}){
return(<div style={{display:"flex",gap:3,alignItems:"center",flexWrap:"wrap"}}>
<span style={{fontSize:9,color:C.tx3,fontWeight:700,marginRight:4}}>PERÍODO:</span>
{[["hoje","Hoje"],["7d","7 Dias"],["15d","15 Dias"],["30d","30 Dias"],["60d","60 Dias"],["trim","Trimestre"],["ano","Ano"]].map(([k,l])=>
<button key={k} onClick={()=>onChange(k)} style={{padding:"5px 12px",borderRadius:5,border:`1px solid ${active===k?C.acc+"60":C.brd}`,background:active===k?C.accBg:C.w,color:active===k?C.acc:C.tx2,fontSize:10,fontWeight:active===k?700:500,cursor:"pointer",fontFamily:F}}>{l}</button>
)}</div>);
}

/* ═══ SIDEBAR ═══ */
const NAV=[{id:"dash",lb:"Painel",ic:"📊"},{id:"prod",lb:"Produtos",ic:"📦"},{id:"comp",lb:"Compras",ic:"🛒"},{id:"forn",lb:"Fornecedores",ic:"🤝"},{id:"fin",lb:"Financeiro",ic:"💰"},{id:"ofer",lb:"Ofertas",ic:"🏷️"},{id:"cfg",lb:"Config",ic:"⚙️"}];
function Side({a,set,conn,sync}){return(<nav style={{width:190,background:C.w,borderRight:`1px solid ${C.brd}`,display:"flex",flexDirection:"column",flexShrink:0,boxShadow:"2px 0 6px rgba(0,0,0,.02)"}}>
<div style={{padding:"16px 16px 12px",borderBottom:`1px solid ${C.brd}`}}><div style={{fontSize:17,fontWeight:800,color:C.acc,fontFamily:F}}>MarketSUP</div><div style={{fontSize:9,color:C.tx3,marginTop:1}}>Retail Intelligence</div></div>
<div style={{padding:"8px 14px",borderBottom:`1px solid ${C.brd}`,display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:"50%",background:conn?C.gL:sync?"#f59e0b":C.r,...(sync?{animation:"pulse 1s infinite"}:{})}}/><span style={{fontSize:10,color:conn?C.gL:sync?C.a:C.tx3,fontWeight:600}}>{conn?"Online":sync?"Sync...":"Offline"}</span></div>
<div style={{flex:1,padding:"6px 8px",display:"flex",flexDirection:"column",gap:1}}>{NAV.map(n=>(<button key={n.id} onClick={()=>set(n.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:7,border:"none",cursor:"pointer",background:a===n.id?C.accBg:C.w,color:a===n.id?C.acc:C.tx2,fontSize:12,fontWeight:a===n.id?600:400,fontFamily:F,textAlign:"left",width:"100%"}}><span style={{fontSize:13}}>{n.ic}</span>{n.lb}</button>))}</div>
<div style={{padding:"10px 14px",borderTop:`1px solid ${C.brd}`,fontSize:8,color:C.tx3}}>v7.0 · Auto-refresh 50min</div>
</nav>);}

/* ═══ DRILL-DOWN MODAL ═══ */
function DrillDown({title,data,cols,onClose}){
const[q,setQ]=useState("");
const filt=useMemo(()=>{if(!q)return data;const s=q.toLowerCase();return data.filter(r=>cols.some(c=>{const v=typeof c.r==="function"?c.r(r):"";return String(v).toLowerCase().includes(s);}));},[data,q,cols]);
return(<div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.3)",backdropFilter:"blur(2px)"}}/>
<div onClick={e=>e.stopPropagation()} style={{position:"relative",width:"90vw",maxWidth:1100,maxHeight:"85vh",background:C.w,borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,.15)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
<div style={{padding:"14px 20px",borderBottom:`1px solid ${C.brd}`,display:"flex",alignItems:"center",gap:10}}>
<h2 style={{fontSize:15,fontWeight:700,color:C.tx,margin:0,flex:1}}>{title}</h2>
<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Filtrar..." style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${C.brd}`,fontSize:11,outline:"none",width:200}}/>
<span style={{fontSize:10,color:C.tx3}}>{filt.length} itens</span>
<button onClick={onClose} style={{background:"#f3f4f6",border:`1px solid ${C.brd}`,width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",color:C.tx2}}>×</button>
</div>
<div style={{flex:1,overflow:"auto",padding:"0"}}><Tbl cols={cols} data={filt} max={500}/></div>
</div></div>);
}

/* ═══ PAINEL ═══ */
function DashPage({onDrill}){
const k=ST.kpis||{};const s=ST.setores;const p=ST.produtos;
const topV=useMemo(()=>[...p].sort((a,b)=>(b.vd||0)-(a.vd||0)).slice(0,10),[p]);
const negMg=useMemo(()=>p.filter(x=>x.mg<0&&x.pr>0).sort((a,b)=>a.mg-b.mg),[p]);
const rupt=useMemo(()=>p.filter(x=>(x.est||x.e)<=0&&(x.curva||x.c)!=="D"),[p]);
const estBx=useMemo(()=>p.filter(x=>{const e=x.est||x.e;return e>0&&e<10;}),[p]);
const semVenda=useMemo(()=>p.filter(x=>(x.vd||0)===0&&(x.est||x.e)>0),[p]);
const prodCols=[{l:"ID",r:r=>r.id,m:1},{l:"Produto",r:r=>(r.nome||r.n||"").substring(0,35),b:1},{l:"Depto",r:r=>(r.grupo||r.g||"").substring(0,15),cl:()=>C.tx2},{l:"Cv",r:r=><Bg t={r.curva||r.c}/>,a:"center"},{l:"Custo",r:r=>fR(r.custo||r.cu),a:"right",m:1},{l:"Preço",r:r=>fR(r.pr),a:"right",m:1},{l:"Mg%",r:r=>fP(r.mg),a:"right",m:1,cl:r=>r.mg<0?C.r:r.mg<15?C.a:C.gL},{l:"Est",r:r=>fmt(r.est||r.e),a:"right",m:1,cl:r=>(r.est||r.e)<=0?C.r:C.tx},{l:"Venda",r:r=>(r.vd||0)>0?fR(r.vd):"—",a:"right",m:1},{l:"Forn",r:r=>(r.forn||r.f||"").substring(0,15),cl:()=>C.tx3}];
return(<div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
{/* RECEITA & MARGEM */}
<div style={{background:C.goldBg,padding:"8px 14px",borderRadius:8,border:"1px solid #fef08a"}}><span style={{fontSize:11,fontWeight:800,color:C.gold}}>📊 PRINCIPAIS INDICADORES</span></div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:8}}>
<Kpi icon="💰" label="Receita Bruta (R$)" value={fR(k.receitaBruta||0)} color="green" sub={k.cupons?`${fmt(k.cupons)} cupons`:null}/>
<Kpi icon="📈" label="Lucro Bruto (R$)" value={fR(k.lucroBruto||0)} color={(k.lucroBruto||0)>=0?"green":"red"}/>
<Kpi icon="🎫" label="Cupons" value={fmt(k.cupons||k.vendasHojeCupons||0)} color="blue"/>
<Kpi icon="🛒" label="Compras (R$)" value={fR(k.totalCompra||0)} color="red" sub={k.totalEntradas?`${k.totalEntradas} NFs`:null}/>
<Kpi icon="⚖️" label="Compra x Venda (RCV)" value={fP(k.rcv||0)} color={(k.rcv||0)>85?"red":(k.rcv||0)>75?"amber":"green"}/>
<Kpi icon="📊" label="Margem Média" value={fP(k.margemMedia||0)} color={(k.margemMedia||0)>=20?"green":(k.margemMedia||0)>=10?"amber":"red"}/>
<Kpi icon="🎫" label="Ticket Médio (R$)" value={fR(k.ticketMedio||0)} color="purple"/>
<Kpi icon="🧮" label="Qtd. Vendida" value={fmt(k.totalQtd||0)} color="blue"/>
<Kpi icon="📊" label="Vendas Hoje (R$)" value={fR(k.vendasHoje||0)} color="cyan" sub={k.vendasHojeCupons?`${k.vendasHojeCupons} cupons`:null}/>
<Kpi icon="📦" label="Produtos Ativos" value={fmt(k.totalProdutos||0)} color="blue" sub={`${k.produtosEnriched||0} com vendas`}/>
<Kpi icon="🤝" label="Fornecedores" value={fmt(k.totalFornecedores||0)} color="gray"/>
<Kpi icon="👥" label="Clientes" value={fmt(k.totalClientes||0)} color="gray"/>
</div>
{/* ALERTAS — CLICÁVEIS */}
<div style={{background:C.rBg,padding:"8px 14px",borderRadius:8,border:`1px solid ${C.rBd}`}}><span style={{fontSize:11,fontWeight:800,color:C.r}}>🚨 ALERTAS & ESTOQUE</span></div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:8}}>
<Kpi icon="🚫" label="Ruptura (sem estoque)" value={fmt(k.ruptura||rupt.length)} color="red" onClick={rupt.length?()=>onDrill("Produtos em Ruptura",rupt,prodCols):null} sub="Clique para ver"/>
<Kpi icon="⚠️" label="Estoque Baixo (<10)" value={fmt(k.estBaixo||estBx.length)} color="amber" onClick={estBx.length?()=>onDrill("Estoque Baixo",estBx,prodCols):null} sub="Clique para ver"/>
<Kpi icon="📉" label="Margem Negativa" value={fmt(k.mgNegativa||negMg.length)} color="red" onClick={negMg.length?()=>onDrill("Margem Negativa",negMg,prodCols):null} sub="Clique para ver"/>
<Kpi icon="💤" label="Sem Venda (c/ estoque)" value={fmt(semVenda.length)} color="amber" onClick={semVenda.length?()=>onDrill("Sem Venda (com estoque)",semVenda,prodCols):null} sub="Clique para ver"/>
<Kpi icon="🏷️" label="Ofertas Ativas" value={fmt(k.ofertasAtivas||0)} color="cyan"/>
<Kpi icon="📋" label="Perdas" value={fR(k.totalPerdas||0)} color={(k.totalPerdas||0)>0?"amber":"gray"}/>
</div>
{/* FINANCEIRO */}
<div style={{background:C.gBg,padding:"8px 14px",borderRadius:8,border:`1px solid ${C.gBd}`}}><span style={{fontSize:11,fontWeight:800,color:C.gL}}>💰 FINANCEIRO</span></div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>
<Kpi icon="💵" label="Contas a Receber" value={fR(k.contasReceber||0)} color="green" sub={k.contasReceberVencido>0?`Vencido: ${fR(k.contasReceberVencido)}`:null}/>
<Kpi icon="💳" label="Contas a Pagar" value={fR(k.contasPagar||0)} color="red" sub={k.contasPagarVencido>0?`Vencido: ${fR(k.contasPagarVencido)}`:null}/>
<Kpi icon="📊" label="Saldo" value={fR(k.saldo||0)} color={(k.saldo||0)>=0?"green":"red"}/>
<Kpi icon="📉" label="Despesas" value={fR(k.despesas||0)} color="gray"/>
</div>
{/* SETORES */}
{s.length>0&&<><div style={{background:C.accBg,padding:"8px 14px",borderRadius:8,border:`1px solid ${C.accBd}`}}><span style={{fontSize:11,fontWeight:800,color:C.acc}}>🏪 DEPARTAMENTOS</span></div>
<Tbl cols={[{l:"Departamento",r:r=>r.n,b:1},{l:"Part%",r:r=>fP(r.pt),a:"right",m:1},{l:"Venda (R$)",r:r=>fR(r.vd),a:"right",m:1},{l:"Compra (R$)",r:r=>fR(r.cp),a:"right",m:1},{l:"Margem",r:r=>fP(r.mg),a:"right",m:1,cl:r=>r.mg>=20?C.gL:r.mg>=10?C.a:C.r},{l:"RCV",r:r=>fP(r.rcv),a:"right",m:1,cl:r=>r.rcv>85?C.r:C.gL},{l:"SKUs",r:r=>fmt(r.sk),a:"right",m:1},{l:"Rupt.",r:r=>r.rupt||0,a:"right",m:1,cl:r=>r.rupt>0?C.r:C.tx3}]} data={s} max={50}/></>}
{/* TOP VENDAS */}
{topV.length>0&&<><div style={{fontSize:12,fontWeight:700,color:C.tx}}>🏆 Top 10 Vendas</div>
<Tbl cols={[{l:"Produto",r:r=>(r.nome||r.n||"").substring(0,35),b:1},{l:"Cv",r:r=><Bg t={r.curva||r.c}/>,a:"center"},{l:"Venda",r:r=>fR(r.vd),a:"right",m:1},{l:"Mg%",r:r=>fP(r.mg),a:"right",m:1,cl:r=>r.mg<0?C.r:C.gL},{l:"Est",r:r=>fmt(r.est||r.e),a:"right",m:1}]} data={topV}/></>}
{p.length===0&&<div style={{padding:40,textAlign:"center",color:C.tx3}}>Conecte a API em Config para carregar dados</div>}
</div>);
}

/* ═══ PRODUTOS ═══ */
function ProdPage({openD,onDrill}){
const[q,setQ]=useState("");const[dept,setDept]=useState("Todos");const[sub,setSub]=useState("Todos");const[cv,setCv]=useState("Todos");const[marca,setMarca]=useState("Todos");const[forn,setForn]=useState("Todos");const[mgF,setMgF]=useState("Todos");const[estF,setEstF]=useState("Todos");const[sb,setSb]=useState("vd");const[maxR,setMaxR]=useState(200);
const depts=useMemo(()=>["Todos",...[...new Set(ST.produtos.map(p=>p.grupo||p.g).filter(Boolean))].sort()],[]);
const subs=useMemo(()=>["Todos",...[...new Set(ST.produtos.filter(p=>dept==="Todos"||(p.grupo||p.g)===dept).map(p=>p.sg).filter(Boolean))].sort()],[dept]);
const marcas=useMemo(()=>["Todos",...[...new Set(ST.produtos.map(p=>p.marca).filter(Boolean))].sort()],[]);
const forns=useMemo(()=>["Todos",...[...new Set(ST.produtos.map(p=>p.forn||p.f).filter(Boolean))].sort()],[]);
const filt=useMemo(()=>{let l=[...ST.produtos];if(q){const s=q.toLowerCase();l=l.filter(p=>(p.nome||p.n||"").toLowerCase().includes(s)||(p.grupo||p.g||"").toLowerCase().includes(s)||(p.forn||p.f||"").toLowerCase().includes(s)||String(p.id).includes(s));}
if(dept!=="Todos")l=l.filter(p=>(p.grupo||p.g)===dept);if(sub!=="Todos")l=l.filter(p=>p.sg===sub);if(cv!=="Todos")l=l.filter(p=>(p.curva||p.c)===cv);if(marca!=="Todos")l=l.filter(p=>p.marca===marca);if(forn!=="Todos")l=l.filter(p=>(p.forn||p.f)===forn);
if(mgF==="Negativa")l=l.filter(p=>p.mg<0);else if(mgF==="0-15%")l=l.filter(p=>p.mg>=0&&p.mg<15);else if(mgF==="15-30%")l=l.filter(p=>p.mg>=15&&p.mg<30);else if(mgF===">30%")l=l.filter(p=>p.mg>=30);
if(estF==="Ruptura")l=l.filter(p=>(p.est||p.e)<=0);else if(estF==="Baixo")l=l.filter(p=>{const e=p.est||p.e;return e>0&&e<10;});else if(estF==="Normal")l=l.filter(p=>(p.est||p.e)>=10);
l.sort((a,b)=>{if(sb==="vd")return(b.vd||0)-(a.vd||0);if(sb==="mg")return(b.mg||0)-(a.mg||0);if(sb==="est")return(a.est||a.e||0)-(b.est||b.e||0);if(sb==="nome")return(a.nome||a.n||"").localeCompare(b.nome||b.n||"");if(sb==="custo")return(b.custo||b.cu||0)-(a.custo||a.cu||0);return 0;});return l;
},[q,dept,sub,cv,marca,forn,mgF,estF,sb]);
const stats=useMemo(()=>{const vd=filt.reduce((a,p)=>a+(p.vd||0),0);const mg=filt.length?filt.reduce((a,p)=>a+p.mg,0)/filt.length:0;const rupt=filt.filter(p=>(p.est||p.e)<=0).length;return{vd,mg,rupt,total:filt.length};},[filt]);
return(<div style={{padding:"14px 20px",display:"flex",flexDirection:"column",gap:10}}>
<div style={{background:C.w,borderRadius:10,padding:"10px 14px",border:`1px solid ${C.brd}`,display:"flex",gap:6,flexWrap:"wrap",alignItems:"flex-end",boxShadow:C.sh}}>
<div style={{display:"flex",flexDirection:"column",gap:2}}><span style={{fontSize:8,color:C.tx3,fontWeight:700,textTransform:"uppercase"}}>Buscar</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Produto, ID, grupo..." style={{padding:"5px 8px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.bg,color:C.tx,fontSize:11,fontFamily:F,outline:"none",width:160}}/></div>
<Sel label="Departamento" value={dept} options={depts} onChange={v=>{setDept(v);setSub("Todos");}} w={160}/>
<Sel label="Subgrupo" value={sub} options={subs} onChange={setSub} w={140}/>
<Sel label="Curva" value={cv} options={["Todos","A","B","C","D"]} onChange={setCv} w={75}/>
<Sel label="Marca" value={marca} options={marcas} onChange={setMarca} w={130}/>
<Sel label="Fornecedor" value={forn} options={forns} onChange={setForn} w={150}/>
<Sel label="Margem" value={mgF} options={["Todos","Negativa","0-15%","15-30%",">30%"]} onChange={setMgF} w={90}/>
<Sel label="Estoque" value={estF} options={["Todos","Ruptura","Baixo","Normal"]} onChange={setEstF} w={85}/>
<Sel label="Ordenar" value={sb} options={[{v:"vd",l:"Venda"},{v:"mg",l:"Margem"},{v:"est",l:"Estoque"},{v:"nome",l:"A-Z"},{v:"custo",l:"Custo"}]} onChange={setSb} w={85}/>
</div>
<div style={{display:"flex",gap:8}}><Kpi small label="Filtrados" value={fmt(stats.total)} color="blue"/><Kpi small label="Venda" value={fR(stats.vd)} color="green"/><Kpi small label="Margem Média" value={fP(stats.mg)} color={stats.mg>=20?"green":stats.mg>=10?"amber":"red"}/><Kpi small label="Ruptura" value={fmt(stats.rupt)} color={stats.rupt>0?"red":"gray"}/></div>
<Tbl cols={[{l:"ID",r:r=>r.id,m:1,a:"right"},{l:"Produto",r:r=>(r.nome||r.n||"").substring(0,38),b:1},{l:"Depto",r:r=>(r.grupo||r.g||"").substring(0,14),cl:()=>C.tx2},{l:"SubGr",r:r=>(r.sg||"").substring(0,14),cl:()=>C.tx3},{l:"Marca",r:r=>(r.marca||"").substring(0,10),cl:()=>C.tx3},{l:"Cv",r:r=><Bg t={r.curva||r.c}/>,a:"center"},{l:"Custo",r:r=>fR(r.custo||r.cu),a:"right",m:1},{l:"Preço",r:r=>fR(r.pr),a:"right",m:1},{l:"Mg%",r:r=>fP(r.mg),a:"right",m:1,cl:r=>r.mg<0?C.r:r.mg<15?C.a:C.gL},{l:"Est",r:r=>fmt(r.est||r.e),a:"right",m:1,cl:r=>(r.est||r.e)<=0?C.r:(r.est||r.e)<10?C.a:C.tx},{l:"Venda",r:r=>(r.vd||0)>0?fR(r.vd):"—",a:"right",m:1},{l:"Forn",r:r=>(r.forn||r.f||"").substring(0,14),cl:()=>C.tx3}]} data={filt} max={maxR} onClick={r=>openD?.(r,"produto")}/>
{filt.length>maxR&&<Btn onClick={()=>setMaxR(m=>m+300)} primary>Carregar mais ({filt.length-maxR} restantes)</Btn>}
</div>);
}

/* ═══ COMPRAS ═══ */
function CompPage(){const k=ST.kpis||{};return(<div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}><Kpi icon="🛒" label="Total Compras" value={fR(k.totalCompra||0)} color="red"/><Kpi icon="📋" label="NFs Entrada" value={fmt(k.totalEntradas||0)} color="blue"/><Kpi icon="🔄" label="RCV" value={fP(k.rcv||0)} color={(k.rcv||0)>85?"red":"green"}/></div>
{ST.pedidos.length>0&&<><div style={{fontSize:12,fontWeight:700,color:C.tx}}>Pedidos de Compra</div><Tbl cols={[{l:"ID",r:r=>r.id,m:1},{l:"Fornecedor",r:r=>(r.forn||"").substring(0,30),b:1},{l:"Valor",r:r=>fR(r.valor),a:"right",m:1},{l:"Data",r:r=>(r.data||"").substring(0,10),m:1},{l:"Status",r:r=>r.status||"—"}]} data={ST.pedidos} max={100}/></>}
</div>);}

/* ═══ FORNECEDORES ═══ */
function FornPage({openD}){const[q,setQ]=useState("");
const filt=useMemo(()=>{let l=[...ST.fornecedores];if(q){const s=q.toLowerCase();l=l.filter(f=>(f.n||"").toLowerCase().includes(s)||(f.cn||"").includes(s));}return l;},[q]);
return(<div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
<div style={{display:"flex",gap:8,alignItems:"flex-end"}}><div style={{display:"flex",flexDirection:"column",gap:2}}><span style={{fontSize:8,color:C.tx3,fontWeight:700,textTransform:"uppercase"}}>Buscar</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Fornecedor, CNPJ..." style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.w,color:C.tx,fontSize:11,outline:"none",width:240}}/></div><div style={{flex:1}}/><span style={{fontSize:10,color:C.tx3}}>{filt.length} fornecedores</span></div>
<Tbl cols={[{l:"Fornecedor",r:r=>r.n,b:1},{l:"CNPJ",r:r=>r.cn||"—",m:1,cl:()=>C.tx3},{l:"Compras (R$)",r:r=>r.cp>0?fR(r.cp):"—",a:"right",m:1},{l:"NFs",r:r=>r.cnt||"—",a:"right",m:1},{l:"Produtos",r:r=>r.pr||"—",a:"right",m:1},{l:"Lead",r:r=>r.dias?r.dias+"d":"—",a:"right",m:1},{l:"Últ.Compra",r:r=>r.uc||"—",a:"right",m:1,cl:()=>C.tx2}]} data={filt} max={300} onClick={r=>openD?.(r,"fornecedor")}/>
</div>);}

/* ═══ FINANCEIRO ═══ */
function FinPage(){const k=ST.kpis||{};const[tab,setTab]=useState("resumo");
return(<div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}><Kpi icon="💵" label="A Receber" value={fR(k.contasReceber||0)} color="green" sub={k.contasReceberVencido>0?`Vencido: ${fR(k.contasReceberVencido)}`:null}/><Kpi icon="💳" label="A Pagar" value={fR(k.contasPagar||0)} color="red" sub={k.contasPagarVencido>0?`Vencido: ${fR(k.contasPagarVencido)}`:null}/><Kpi icon="📊" label="Saldo" value={fR(k.saldo||0)} color={(k.saldo||0)>=0?"green":"red"}/><Kpi icon="📉" label="Despesas" value={fR(k.despesas||0)} color="gray"/></div>
<div style={{display:"flex",gap:2,background:"#f3f4f6",borderRadius:6,padding:2,alignSelf:"flex-start"}}>{[["resumo","Resumo"],["receber","A Receber"],["pagar","A Pagar"],["despesas","Despesas"]].map(([k2,l])=><button key={k2} onClick={()=>setTab(k2)} style={{padding:"6px 14px",borderRadius:5,border:"none",cursor:"pointer",background:tab===k2?C.w:"transparent",color:tab===k2?C.acc:C.tx3,fontSize:11,fontWeight:600,fontFamily:F,boxShadow:tab===k2?C.sh:"none"}}>{l}</button>)}</div>
{tab==="receber"&&<Tbl cols={[{l:"Cliente",r:r=>(r.cliente||"").substring(0,28),b:1},{l:"Valor",r:r=>fR(r.valor),a:"right",m:1},{l:"Venc.",r:r=>(r.venc||"").substring(0,10),m:1,cl:r=>r.venc<new Date().toISOString().substring(0,10)?C.r:C.tx},{l:"Doc",r:r=>r.doc||"—",m:1},{l:"Status",r:r=>r.status||"—"}]} data={ST.contasReceber} max={200}/>}
{tab==="pagar"&&<Tbl cols={[{l:"Forn.",r:r=>(r.forn||"").substring(0,28),b:1},{l:"Valor",r:r=>fR(r.valor),a:"right",m:1},{l:"Venc.",r:r=>(r.venc||"").substring(0,10),m:1,cl:r=>r.venc<new Date().toISOString().substring(0,10)?C.r:C.tx},{l:"Doc",r:r=>r.doc||"—",m:1},{l:"Status",r:r=>r.status||"—"}]} data={ST.contasPagar} max={200}/>}
{tab==="despesas"&&<Tbl cols={[{l:"Descrição",r:r=>(r.desc||"").substring(0,35),b:1},{l:"Valor",r:r=>fR(r.valor),a:"right",m:1},{l:"Data",r:r=>(r.data||"").substring(0,10),m:1}]} data={ST.despesas} max={200}/>}
{tab==="resumo"&&<div style={{color:C.tx3,fontSize:12,padding:16,textAlign:"center"}}>{(k.contasReceber||0)>0?"Selecione uma aba":"Dados carregam após sincronização"}</div>}
</div>);}

/* ═══ OFERTAS ═══ */
function OferPage(){
const ofertas=ST.extras?.ofertas||[];const ofProd=ST.extras?.ofertasProd||[];
const[sel,setSel]=useState(null);
const prodsDaOferta=useMemo(()=>{if(!sel)return[];const ofId=sel.id;return ofProd.filter(op=>op.idOferta===ofId||op.oferta===ofId).map(op=>{const prod=ST.produtos.find(p=>p.id===op.idProduto||p.id===op.produto);return{...op,nome:prod?.nome||prod?.n||(op.descricao||"Produto "+op.idProduto),grupo:prod?.grupo||prod?.g||"",curva:prod?.curva||prod?.c||"",custo:prod?.custo||prod?.cu||0,pr:n(op.precoOferta||op.preco||prod?.pr||0),mg:prod?.mg||0,est:prod?.est||prod?.e||0,forn:prod?.forn||prod?.f||""};});},[sel,ofProd]);
return(<div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>
<div style={{display:"flex",gap:8,alignItems:"center"}}><Kpi small label="Ofertas" value={fmt(ofertas.length)} color="cyan" icon="🏷️"/><Kpi small label="Ativas" value={fmt(ST.kpis?.ofertasAtivas||0)} color="green"/></div>
{ofertas.length>0&&<><div style={{fontSize:12,fontWeight:700,color:C.tx}}>Selecione uma oferta</div>
<div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:200,overflow:"auto"}}>{ofertas.map((o,i)=><div key={i} onClick={()=>setSel(o)} style={{padding:"8px 12px",background:sel?.id===o.id?C.accBg:C.w,border:`1px solid ${sel?.id===o.id?C.accBd:C.brd}`,borderRadius:6,cursor:"pointer",display:"flex",gap:8,alignItems:"center",fontSize:11}}>
<span style={{fontWeight:600,color:C.tx}}>{o.descricao||o.nome||`Oferta #${o.id}`}</span>
<span style={{color:C.tx3,fontSize:10}}>{(o.dataInicial||"").substring(0,10)} a {(o.dataFinal||o.dataFim||"").substring(0,10)}</span>
</div>)}</div></>}
{sel&&<><div style={{fontSize:12,fontWeight:700,color:C.tx}}>Produtos da Oferta: {sel.descricao||sel.nome||sel.id}</div>
{prodsDaOferta.length>0?<Tbl cols={[{l:"Produto",r:r=>(r.nome||"").substring(0,35),b:1},{l:"Cv",r:r=><Bg t={r.curva}/>,a:"center"},{l:"Preço Oferta",r:r=>fR(r.pr),a:"right",m:1},{l:"Custo",r:r=>fR(r.custo),a:"right",m:1},{l:"Mg%",r:r=>fP(r.mg),a:"right",m:1,cl:r=>r.mg<0?C.r:C.gL},{l:"Est",r:r=>fmt(r.est),a:"right",m:1},{l:"Depto",r:r=>(r.grupo||"").substring(0,12)}]} data={prodsDaOferta} max={200}/>:
<div style={{color:C.tx3,fontSize:11,padding:12}}>Nenhum produto encontrado para esta oferta nos dados sincronizados</div>}</>}
{ofertas.length===0&&<div style={{padding:30,textAlign:"center",color:C.tx3}}>Dados de ofertas carregam após sincronização</div>}
</div>);}

/* ═══ CONFIG ═══ */
function CfgPage({as,sas,doSync,syncLog}){const conn=as.connected,sync=as.syncing;
return(<div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:12,maxWidth:680}}>
<div style={{background:C.w,borderRadius:10,padding:18,border:`1px solid ${C.brd}`,boxShadow:C.sh}}>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><div style={{width:8,height:8,borderRadius:"50%",background:conn?C.gL:sync?C.a:C.r}}/><span style={{fontSize:12,fontWeight:600,color:conn?C.gL:C.tx2}}>{conn?"Conectado":sync?"Sincronizando...":"Desconectado"}</span></div>
<div style={{display:"flex",flexDirection:"column",gap:8}}>
<div><label style={{fontSize:9,color:C.tx3,fontWeight:700,display:"block",marginBottom:2}}>URL BASE</label><input value={as.url} onChange={e=>sas(p=>({...p,url:e.target.value}))} style={{width:"100%",padding:"7px 10px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.bg,color:C.acc,fontSize:11,fontFamily:M,outline:"none",boxSizing:"border-box"}}/></div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
<div><label style={{fontSize:9,color:C.tx3,fontWeight:700,display:"block",marginBottom:2}}>USUÁRIO</label><input value={as.user||""} onChange={e=>sas(p=>({...p,user:e.target.value}))} style={{width:"100%",padding:"7px 10px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.bg,color:C.tx,fontSize:11,outline:"none",boxSizing:"border-box"}}/></div>
<div><label style={{fontSize:9,color:C.tx3,fontWeight:700,display:"block",marginBottom:2}}>SENHA</label><input value={as.pass||""} onChange={e=>sas(p=>({...p,pass:e.target.value}))} type="password" style={{width:"100%",padding:"7px 10px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.bg,color:C.tx,fontSize:11,outline:"none",boxSizing:"border-box"}}/></div>
</div>
{as.token&&<div style={{padding:"5px 8px",borderRadius:4,fontFamily:M,fontSize:8,wordBreak:"break-all",background:conn?C.gBg:C.bg,color:conn?C.gL:C.tx3,border:`1px solid ${conn?C.gBd:C.brd}`}}>{as.token.substring(0,80)}...</div>}
{as.error&&<div style={{padding:"6px 8px",borderRadius:4,background:C.rBg,border:`1px solid ${C.rBd}`}}><span style={{fontSize:11,color:C.r,fontWeight:600}}>{as.error}</span></div>}
<Btn onClick={doSync} disabled={sync||!as.user||!as.pass} primary>{sync?"Sincronizando...":conn?"Re-sincronizar":"Conectar"}</Btn>
</div></div>
{syncLog.length>0&&<div style={{background:C.w,borderRadius:10,padding:12,border:`1px solid ${C.brd}`,maxHeight:280,overflowY:"auto",boxShadow:C.sh}}>
<div style={{fontSize:9,fontWeight:700,color:C.tx3,marginBottom:4}}>LOG</div>
{syncLog.slice(-40).map((l,i)=><div key={i} style={{fontSize:9,fontFamily:M,padding:"2px 0",color:l.s==="ok"?C.gL:l.s==="error"?C.r:C.tx3}}><span style={{color:C.tx3,marginRight:4}}>{l.t}</span>{l.m}</div>)}
</div>}
{as.stats&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}><Kpi small label="OK" value={as.stats.success} color="green"/><Kpi small label="Falhou" value={as.stats.failed} color={as.stats.failed>0?"red":"gray"}/><Kpi small label="Total" value={as.stats.total} color="blue"/></div>}
</div>);}

/* ═══ DETAIL ═══ */
function Detail({it,ty,onClose}){if(!it)return null;
return(<div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",justifyContent:"flex-end"}} onClick={onClose}>
<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.25)",backdropFilter:"blur(2px)"}}/>
<div onClick={e=>e.stopPropagation()} style={{position:"relative",width:400,maxWidth:"90vw",height:"100vh",background:C.w,borderLeft:`1px solid ${C.brd}`,overflowY:"auto",padding:18,boxShadow:"-4px 0 20px rgba(0,0,0,.08)"}}>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div><div style={{fontSize:9,color:C.tx3,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>{ty}</div><div style={{fontSize:14,fontWeight:700,color:C.tx}}>{it.nome||it.n}</div>
{ty==="produto"&&<div style={{fontSize:10,color:C.tx3,marginTop:2}}>{it.grupo||it.g} › {it.sg||"—"} · {it.marca||"—"}</div>}</div>
<button onClick={onClose} style={{background:"#f3f4f6",border:`1px solid ${C.brd}`,width:26,height:26,borderRadius:5,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",color:C.tx2}}>×</button></div>
{ty==="produto"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}><Kpi small label="Preço" value={fR(it.pr)} color="blue"/><Kpi small label="Custo" value={fR(it.custo||it.cu)} color="gray"/><Kpi small label="Margem" value={fP(it.mg)} color={it.mg<0?"red":"green"}/><Kpi small label="Estoque" value={fmt(it.est||it.e)} color={(it.est||it.e)<=0?"red":"blue"}/><Kpi small label="Venda" value={(it.vd||0)>0?fR(it.vd):"—"} color="green"/><Kpi small label="Curva" value={it.curva||it.c} color="blue"/><Kpi small label="Unidade" value={it.unidade||it.u||"UN"} color="gray"/><Kpi small label="Fornecedor" value={(it.forn||it.f||"—").substring(0,20)} color="gray"/></div>}
{ty==="fornecedor"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}><Kpi small label="Compras" value={fR(it.cp)} color="red"/><Kpi small label="Produtos" value={it.pr||"—"} color="blue"/><Kpi small label="CNPJ" value={it.cn||"—"} color="gray"/><Kpi small label="Últ.Compra" value={it.uc||"—"} color="gray"/></div>}
</div></div>);
}

/* ═══ MAIN ═══ */
const pages={dash:DashPage,prod:ProdPage,comp:CompPage,forn:FornPage,fin:FinPage,ofer:OferPage};
export default function App(){
const[pg,setPg]=useState("dash");const[det,setDet]=useState(null);const[detT,setDetT]=useState(null);const[drill,setDrill]=useState(null);
const[realData,setRealData]=useState(null);const[syncLog,setSyncLog]=useState([]);
const[period,setPeriod]=useState("30d");
const[apiState,setApiState]=useState({url:"http://177.73.209.174:8059/integracao/sgsistemas/v1",connected:false,syncing:false,user:"",pass:"",token:"",error:null,syncedAt:null,stats:null});
const log=(m,s="info")=>setSyncLog(p=>[...p,{t:new Date().toLocaleTimeString(),m,s}]);
const refreshTimer=useRef(null);

const doSyncWithConfig=useCallback(async(cfg,prd)=>{
const{url,user,pass,token:tk}=cfg;const pr=prd||period;
setApiState(p=>({...p,syncing:true,error:null}));log("Iniciando...");
let token=tk;
if(!token&&user&&pass){log("Autenticando...");try{const a=await authenticate(url,user,pass);if(!a.success){setApiState(p=>({...p,syncing:false,connected:false,error:a.error}));log("FALHA: "+a.error,"error");return;}token=a.token;log("Token obtido!","ok");}catch(e){setApiState(p=>({...p,syncing:false,connected:false,error:e.message}));log("ERRO: "+e.message,"error");return;}}
if(!token){setApiState(p=>({...p,syncing:false,error:"Sem token"}));return;}
setApiState(p=>({...p,token}));
const{start,end}=dateF(pr);log(`Sync ${start} → ${end} (${pr})...`);
try{const s=await syncAll(url,token,"1",start,end);
if(!s.success){setApiState(p=>({...p,syncing:false,connected:false,error:s.error||"Erro"}));log("FALHA: "+(s.error||"Erro desconhecido"),"error");return;}
log(`OK: ${s.stats?.success||0}/${s.stats?.total||0} em ${((s.elapsed||0)/1000).toFixed(1)}s`,"ok");
if(s.report)Object.entries(s.report).forEach(([k,v])=>{log(`  ${k}: ${v.success?v.count+" reg":"FALHOU"+(v.error?" — "+v.error:"")}`,v.success?"ok":"error");});
const d=s.dashboard;if(d){
const mp=(d.produtos||[]).map(p=>({id:p.id,nome:p.n,grupo:p.g,sg:p.sg||"",marca:p.marca||"",curva:p.c,custo:p.cu,pr:p.pr,preco:p.pr,mg:p.mg,est:p.e,forn:p.f,unidade:p.u,vd:p.vd||0,qtd:p.qt||0,lucro:p.lu||0}));
const mf=(d.fornecedores||[]).map(f=>({id:f.id,n:f.n,cp:f.cp,cnt:f.cnt,uc:f.uc,pr:f.pr,cn:f.cn||"",dias:f.dias||0}));
setRealData({produtos:mp,setores:d.setores||[],fornecedores:mf,vd:d.vendasDiarias||[],kpis:d.kpis||{},contasReceber:d.contasReceber||[],contasPagar:d.contasPagar||[],despesas:d.despesas||[],pedidos:d.pedidosCompra||[],extras:d.extras||{}});
log(`Dashboard: ${mp.length} prod, ${mf.length} forn`,"ok");}
setApiState(p=>({...p,url,user:cfg.user||p.user,pass:cfg.pass||p.pass,token,connected:true,syncing:false,error:null,syncedAt:s.syncedAt,stats:s.stats}));
saveConfig({url,user:cfg.user||apiState.user,pass:cfg.pass||apiState.pass,token});
}catch(e){setApiState(p=>({...p,syncing:false,error:e.message}));log("ERRO: "+e.message,"error");}
},[period,apiState.user,apiState.pass]);

const doSync=useCallback(()=>doSyncWithConfig(apiState),[apiState,doSyncWithConfig]);
const changePeriod=useCallback((p)=>{setPeriod(p);if(apiState.token)doSyncWithConfig(apiState,p);},[apiState,doSyncWithConfig]);

// Auto-refresh token every 50min
useEffect(()=>{
if(refreshTimer.current)clearInterval(refreshTimer.current);
if(apiState.connected&&apiState.user&&apiState.pass){
refreshTimer.current=setInterval(async()=>{
try{log("Auto-refresh token...");
const a=await authenticate(apiState.url,apiState.user,apiState.pass);
if(a.success){setApiState(p=>({...p,token:a.token}));saveConfig({url:apiState.url,user:apiState.user,pass:apiState.pass,token:a.token});log("Token renovado!","ok");}
}catch(e){log("Auto-refresh falhou: "+e.message,"error");}
},50*60*1000);}
return()=>{if(refreshTimer.current)clearInterval(refreshTimer.current);};
},[apiState.connected,apiState.user,apiState.pass,apiState.url]);

useEffect(()=>{const sv=loadConfig();if(sv?.token&&sv?.url){setApiState(p=>({...p,...sv}));setTimeout(()=>doSyncWithConfig(sv),300);}},[]);

const openD=(item,type)=>{setDet(item);setDetT(type);};
const onDrill=(title,data,cols)=>setDrill({title,data,cols});
if(realData)ST={...ST,...realData};
const Page=pages[pg]||DashPage;

return(<div style={{display:"flex",height:"100vh",background:C.bg,color:C.tx,fontFamily:F,overflow:"hidden"}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');*{margin:0;padding:0;box-sizing:border-box}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.brd2};border-radius:3px}input::placeholder{color:${C.tx3}}select{font-family:${F}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
<Side a={pg} set={setPg} conn={apiState.connected} sync={apiState.syncing}/>
<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
{/* HEADER */}
<div style={{padding:"8px 20px",borderBottom:`1px solid ${C.brd}`,background:C.w,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",boxShadow:"0 1px 2px rgba(0,0,0,.02)"}}>
<h1 style={{fontSize:15,fontWeight:700,color:C.tx,margin:0,minWidth:120}}>{{dash:"Painel de Performance",prod:"Produtos",comp:"Compras",forn:"Fornecedores",fin:"Financeiro",ofer:"Ofertas",cfg:"Configurações"}[pg]}</h1>
{pg!=="cfg"&&<PeriodBar active={period} onChange={changePeriod}/>}
<div style={{flex:1}}/>
<RefreshBtn onClick={doSync} syncing={apiState.syncing}/>
{apiState.syncedAt&&<span style={{fontSize:9,color:C.tx3,fontFamily:M}}>{new Date(apiState.syncedAt).toLocaleTimeString("pt-BR")}</span>}
</div>
{/* CONTENT */}
<div style={{flex:1,overflowY:"auto"}}>{pg==="cfg"?<CfgPage as={apiState} sas={setApiState} doSync={doSync} syncLog={syncLog}/>:<Page openD={openD} onDrill={onDrill}/>}</div>
</div>
{det&&<Detail it={det} ty={detT} onClose={()=>setDet(null)}/>}
{drill&&<DrillDown title={drill.title} data={drill.data} cols={drill.cols} onClose={()=>setDrill(null)}/>}
</div>);
}

"use client";
import{useState,useRef,useEffect,useMemo,useCallback}from"react";
import{authenticate,syncAll,saveConfig,loadConfig}from"../lib/api-client";

const C={bg:"#f5f6fa",bg1:"#ffffff",bg2:"#f0f1f5",brd:"#e2e4ed",brd2:"#d0d3df",
acc:"#2563eb",accL:"#3b82f6",accBg:"#eff6ff",
g:"#16a34a",gBg:"#f0fdf4",gBd:"#bbf7d0",
r:"#dc2626",rBg:"#fef2f2",rBd:"#fecaca",
a:"#d97706",aBg:"#fffbeb",aBd:"#fde68a",
cy:"#0891b2",cyBg:"#ecfeff",
pu:"#7c3aed",puBg:"#f5f3ff",
tx:"#111827",tx2:"#6b7280",tx3:"#9ca3af",w:"#ffffff",
shadow:"0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)",
shadow2:"0 4px 6px rgba(0,0,0,.05),0 2px 4px rgba(0,0,0,.03)"};
const F="'Inter',system-ui,sans-serif",M="'JetBrains Mono',monospace";

let D={produtos:[],setores:[],fornecedores:[],vd:[],kpis:{},contasReceber:[],contasPagar:[],despesas:[],pedidos:[],extras:{},loaded:false};

const n=v=>{if(v==null||v==="")return 0;const x=typeof v==="string"?parseFloat(v.replace(",",".")):Number(v);return isNaN(x)?0:x};
const fmt=v=>{if(v==null||isNaN(v))return"—";if(Math.abs(v)>=1e6)return(v/1e6).toFixed(2).replace(".",",")+"M";if(Math.abs(v)>=1e3)return v.toLocaleString("pt-BR",{maximumFractionDigits:0});return v.toLocaleString("pt-BR",{maximumFractionDigits:2})};
const fR=v=>"R$ "+fmt(v);const fP=v=>v==null?"—":v.toFixed(2).replace(".",",")+"%";

/* ─── KPI Card (colored like Bussola) ─── */
function Kpi({label,value,sub,color="blue",icon,small}){
  const colors={blue:{bg:C.accBg,bd:"#bfdbfe",tx:C.acc},green:{bg:C.gBg,bd:C.gBd,tx:C.g},red:{bg:C.rBg,bd:C.rBd,tx:C.r},amber:{bg:C.aBg,bd:C.aBd,tx:C.a},cyan:{bg:C.cyBg,bd:"#a5f3fc",tx:C.cy},purple:{bg:C.puBg,bd:"#ddd6fe",tx:C.pu},gray:{bg:C.bg2,bd:C.brd,tx:C.tx2}};
  const s=colors[color]||colors.blue;
  return(
    <div style={{background:C.w,borderRadius:10,padding:small?"10px 14px":"14px 18px",border:`1px solid ${C.brd}`,boxShadow:C.shadow,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:s.tx,borderRadius:"10px 10px 0 0"}}/>
      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:small?4:7}}>
        {icon&&<span style={{fontSize:small?12:14}}>{icon}</span>}
        <span style={{fontSize:small?9:10,color:C.tx3,fontWeight:600,letterSpacing:".4px",textTransform:"uppercase"}}>{label}</span>
      </div>
      <div style={{fontSize:small?16:24,fontWeight:800,fontFamily:M,color:s.tx,letterSpacing:"-.5px",lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:9,color:C.tx3,marginTop:4,fontWeight:500}}>{sub}</div>}
    </div>
  );
}

/* ─── Table ─── */
function Tbl({cols,data,max=100,onClick}){
  const vis=useMemo(()=>data.slice(0,max),[data,max]);
  if(!vis.length)return<div style={{padding:20,textAlign:"center",color:C.tx3,fontSize:12}}>Sem dados</div>;
  return(
    <div style={{overflow:"auto",borderRadius:8,border:`1px solid ${C.brd}`,background:C.w,boxShadow:C.shadow}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:F}}>
        <thead><tr style={{background:C.bg2}}>
          {cols.map((c,i)=><th key={i} style={{padding:"8px 10px",textAlign:c.a||"left",fontWeight:600,color:C.tx2,fontSize:10,letterSpacing:".3px",textTransform:"uppercase",borderBottom:`2px solid ${C.brd}`,whiteSpace:"nowrap",position:"sticky",top:0,background:C.bg2}}>{c.l}</th>)}
        </tr></thead>
        <tbody>{vis.map((row,ri)=>(
          <tr key={ri} onClick={()=>onClick?.(row)} style={{cursor:onClick?"pointer":"default"}}
            onMouseEnter={e=>e.currentTarget.style.background=C.bg2}
            onMouseLeave={e=>e.currentTarget.style.background=C.w}>
            {cols.map((c,ci)=><td key={ci} style={{padding:"7px 10px",textAlign:c.a||"left",color:typeof c.cl==="function"?c.cl(row):(c.cl||C.tx),fontFamily:c.m?M:F,fontWeight:c.b?600:400,fontSize:12,whiteSpace:"nowrap",borderBottom:`1px solid ${C.bg2}`}}>{typeof c.r==="function"?c.r(row):""}</td>)}
          </tr>
        ))}</tbody>
      </table>
      {data.length>max&&<div style={{padding:"8px",fontSize:10,color:C.tx3,textAlign:"center",background:C.bg2,borderTop:`1px solid ${C.brd}`}}>Mostrando {max} de {data.length.toLocaleString()}</div>}
    </div>
  );
}

function Bg({t}){
  const s={A:{bg:C.gBg,c:C.g,bd:C.gBd},B:{bg:C.accBg,c:C.acc,bd:"#bfdbfe"},C:{bg:C.aBg,c:C.a,bd:C.aBd},D:{bg:C.bg2,c:C.tx3,bd:C.brd}};
  const st=s[t]||s.D;
  return<span style={{display:"inline-block",padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700,fontFamily:M,background:st.bg,color:st.c,border:`1px solid ${st.bd}`}}>{t}</span>;
}

function Chart({data,h=120}){
  const mx=Math.max(...data.map(d=>d.v),1);
  return(
    <div style={{display:"flex",alignItems:"flex-end",gap:3,height:h}}>
      {data.map((d,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
        <span style={{fontSize:8,fontFamily:M,color:C.tx2}}>{d.v>0?fmt(d.v):""}</span>
        <div style={{width:"100%",borderRadius:"4px 4px 0 0",height:`${Math.max((d.v/mx)*100,2)}%`,background:`linear-gradient(180deg,${C.accL},${C.acc})`,transition:"height .4s"}}/>
        <span style={{fontSize:8,color:C.tx3,fontFamily:M}}>{d.d}</span>
      </div>)}
    </div>
  );
}

/* ─── Filter Select ─── */
function Sel({label,value,options,onChange,width=160}){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:2}}>
      <span style={{fontSize:8,color:C.tx3,fontWeight:700,letterSpacing:".5px",textTransform:"uppercase"}}>{label}</span>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{padding:"5px 8px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.w,color:C.tx,fontSize:11,fontFamily:F,outline:"none",width,cursor:"pointer",appearance:"auto"}}>
        {options.map(o=><option key={typeof o==="string"?o:o.v} value={typeof o==="string"?o:o.v}>{typeof o==="string"?o:o.l}</option>)}
      </select>
    </div>
  );
}

function DatePick({start,end,onChange,onApply}){
  return(
    <div style={{display:"flex",alignItems:"flex-end",gap:6,flexWrap:"wrap"}}>
      <div style={{display:"flex",flexDirection:"column",gap:2}}>
        <span style={{fontSize:8,color:C.tx3,fontWeight:700,textTransform:"uppercase"}}>De</span>
        <input type="date" value={start} onChange={e=>onChange(e.target.value,end)} style={{padding:"5px 8px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.w,color:C.tx,fontSize:11,fontFamily:M,outline:"none"}}/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:2}}>
        <span style={{fontSize:8,color:C.tx3,fontWeight:700,textTransform:"uppercase"}}>Até</span>
        <input type="date" value={end} onChange={e=>onChange(start,e.target.value)} style={{padding:"5px 8px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.w,color:C.tx,fontSize:11,fontFamily:M,outline:"none"}}/>
      </div>
      {[["7d","7 dias"],["30d","30 dias"],["60d","60d"],["mes","Mês"],["trim","Trim"],["ano","Ano"]].map(([k,l])=>
        <button key={k} onClick={()=>{
          const now=new Date(),p=n=>String(n).padStart(2,"0"),f=d=>`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
          const e=f(now);let s;
          if(k==="7d"){const d=new Date(now);d.setDate(d.getDate()-7);s=f(d);}
          else if(k==="30d"){const d=new Date(now);d.setDate(d.getDate()-30);s=f(d);}
          else if(k==="60d"){const d=new Date(now);d.setDate(d.getDate()-60);s=f(d);}
          else if(k==="mes")s=`${now.getFullYear()}-${p(now.getMonth()+1)}-01`;
          else if(k==="trim"){const d=new Date(now);d.setMonth(d.getMonth()-3);s=f(d);}
          else s=`${now.getFullYear()}-01-01`;
          onChange(s,e);
        }} style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.w,color:C.tx2,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F}}>{l}</button>
      )}
      <button onClick={onApply} style={{padding:"5px 14px",borderRadius:5,border:"none",background:C.acc,color:C.w,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:F}}>Aplicar</button>
    </div>
  );
}

/* ─── Sidebar ─── */
const NAV=[{id:"dash",lb:"Painel",ic:"📊"},{id:"prod",lb:"Produtos",ic:"📦"},{id:"comp",lb:"Compras",ic:"🛒"},{id:"forn",lb:"Fornecedores",ic:"🤝"},{id:"fin",lb:"Financeiro",ic:"💰"},{id:"ofer",lb:"Ofertas",ic:"🏷️"},{id:"cfg",lb:"Config",ic:"⚙️"}];
function Side({a,set,conn,sync}){
  return(
    <nav style={{width:200,background:C.w,borderRight:`1px solid ${C.brd}`,display:"flex",flexDirection:"column",flexShrink:0,boxShadow:"2px 0 8px rgba(0,0,0,.03)"}}>
      <div style={{padding:"18px 18px 14px",borderBottom:`1px solid ${C.brd}`}}>
        <div style={{fontSize:18,fontWeight:800,color:C.acc,fontFamily:F}}>MarketSUP</div>
        <div style={{fontSize:10,color:C.tx3,marginTop:1}}>Retail Intelligence</div>
      </div>
      <div style={{padding:"10px 12px",borderBottom:`1px solid ${C.brd}`,display:"flex",alignItems:"center",gap:6}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:conn?C.g:sync?"#f59e0b":C.r,boxShadow:conn?`0 0 6px ${C.g}40`:"none",...(sync?{animation:"pulse 1s infinite"}:{})}}/>
        <span style={{fontSize:10,color:conn?C.g:sync?C.a:C.tx3,fontWeight:600}}>{conn?"Conectado":sync?"Sincronizando...":"Desconectado"}</span>
      </div>
      <div style={{flex:1,padding:"8px",display:"flex",flexDirection:"column",gap:2}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>set(n.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,border:"none",cursor:"pointer",background:a===n.id?C.accBg:C.w,color:a===n.id?C.acc:C.tx2,fontSize:12,fontWeight:a===n.id?600:500,fontFamily:F,textAlign:"left",width:"100%"}}>
            <span style={{fontSize:14}}>{n.ic}</span>{n.lb}
          </button>
        ))}
      </div>
      <div style={{padding:"12px",borderTop:`1px solid ${C.brd}`,fontSize:9,color:C.tx3}}>v6.0 · SG Sistemas</div>
    </nav>
  );
}

/* ════════════ PAINEL ════════════ */
function DashPage(){
  const k=D.kpis||{};const s=D.setores;const p=D.produtos;
  const topV=useMemo(()=>[...p].sort((a,b)=>(b.vd||0)-(a.vd||0)).slice(0,10),[p]);
  const negMg=useMemo(()=>p.filter(x=>x.mg<0&&x.pr>0).sort((a,b)=>a.mg-b.mg).slice(0,10),[p]);
  return(
    <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:16}}>
      {/* ROW1: Revenue & Margin */}
      <div style={{fontSize:13,fontWeight:700,color:C.tx}}>Receita & Margem</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10}}>
        <Kpi icon="💰" label="Receita Bruta" value={fR(k.receitaBruta||0)} color="green" sub={k.cupons?`${fmt(k.cupons)} cupons`:null}/>
        <Kpi icon="📊" label="Vendas Hoje" value={fR(k.vendasHoje||0)} color="cyan" sub={k.vendasHojeCupons?`${k.vendasHojeCupons} cupons`:null}/>
        <Kpi icon="📈" label="Lucro Bruto" value={fR(k.lucroBruto||0)} color={(k.lucroBruto||0)>=0?"green":"red"}/>
        <Kpi icon="⚖️" label="Margem Média" value={fP(k.margemMedia||0)} color={(k.margemMedia||0)>=20?"green":(k.margemMedia||0)>=10?"amber":"red"}/>
        <Kpi icon="🎫" label="Ticket Médio" value={fR(k.ticketMedio||0)} color="purple"/>
        <Kpi icon="🧮" label="Qtd. Vendida" value={fmt(k.totalQtd||0)} color="blue"/>
      </div>
      {/* ROW2: Compras & RCV */}
      <div style={{fontSize:13,fontWeight:700,color:C.tx,marginTop:4}}>Compras & RCV</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10}}>
        <Kpi icon="🛒" label="Compras" value={fR(k.totalCompra||0)} color="red" sub={k.totalEntradas?`${k.totalEntradas} notas`:null}/>
        <Kpi icon="🔄" label="RCV" value={fP(k.rcv||0)} color={(k.rcv||0)>85?"red":(k.rcv||0)>75?"amber":"green"} sub="Compra/Venda"/>
        <Kpi icon="📦" label="Produtos" value={fmt(k.totalProdutos||0)} color="blue" sub={`${k.produtosEnriched||0} com vendas`}/>
        <Kpi icon="🤝" label="Fornecedores" value={fmt(k.totalFornecedores||0)} color="gray"/>
        <Kpi icon="👥" label="Clientes" value={fmt(k.totalClientes||0)} color="gray"/>
        <Kpi icon="🏷️" label="Ofertas Ativas" value={fmt(k.ofertasAtivas||0)} color="cyan"/>
      </div>
      {/* ROW3: Alerts */}
      <div style={{fontSize:13,fontWeight:700,color:C.tx,marginTop:4}}>Alertas & Estoque</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10}}>
        <Kpi icon="🚨" label="Ruptura" value={fmt(k.ruptura||0)} color="red" sub="sem estoque (A/B/C)"/>
        <Kpi icon="⚠️" label="Estoque Baixo" value={fmt(k.estBaixo||0)} color="amber" sub="< 10 unidades"/>
        <Kpi icon="📉" label="Mg. Negativa" value={fmt(k.mgNegativa||0)} color="red" sub="abaixo do custo"/>
        <Kpi icon="📋" label="Perdas" value={fR(k.totalPerdas||0)} color={(k.totalPerdas||0)>0?"amber":"gray"}/>
        <Kpi icon="📅" label="Vencimentos" value={fmt(k.vencProximos||0)} color="amber" sub="no período"/>
      </div>
      {/* ROW4: Financial */}
      <div style={{fontSize:13,fontWeight:700,color:C.tx,marginTop:4}}>Financeiro</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
        <Kpi icon="💵" label="Contas a Receber" value={fR(k.contasReceber||0)} color="green" sub={k.contasReceberVencido>0?`Vencido: ${fR(k.contasReceberVencido)}`:null}/>
        <Kpi icon="💳" label="Contas a Pagar" value={fR(k.contasPagar||0)} color="red" sub={k.contasPagarVencido>0?`Vencido: ${fR(k.contasPagarVencido)}`:null}/>
        <Kpi icon="📊" label="Saldo" value={fR(k.saldo||0)} color={(k.saldo||0)>=0?"green":"red"}/>
        <Kpi icon="📉" label="Despesas" value={fR(k.despesas||0)} color="gray"/>
      </div>
      {/* ROW5: Chart + Setores */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:4}}>
        <div style={{background:C.w,borderRadius:10,padding:16,border:`1px solid ${C.brd}`,boxShadow:C.shadow}}>
          <div style={{fontSize:11,fontWeight:700,color:C.tx2,marginBottom:10}}>VENDAS DIÁRIAS</div>
          {D.vd.length>0?<Chart data={D.vd} h={120}/>:<div style={{height:120,display:"flex",alignItems:"center",justifyContent:"center",color:C.tx3,fontSize:11}}>Sem dados diários</div>}
        </div>
        <div style={{background:C.w,borderRadius:10,padding:16,border:`1px solid ${C.brd}`,boxShadow:C.shadow}}>
          <div style={{fontSize:11,fontWeight:700,color:C.tx2,marginBottom:10}}>TOP 10 VENDAS</div>
          {topV.length>0?topV.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:`1px solid ${C.bg2}`,fontSize:11}}>
            <span style={{fontFamily:M,color:C.tx3,width:18,fontSize:10}}>{i+1}.</span>
            <span style={{flex:1,fontWeight:500,color:C.tx}}>{(p.nome||p.n||"").substring(0,30)}</span>
            <Bg t={p.curva||p.c}/>
            <span style={{fontFamily:M,fontWeight:600,color:C.g}}>{fR(p.vd)}</span>
          </div>):<div style={{color:C.tx3,fontSize:11}}>Sem dados</div>}
        </div>
      </div>
      {/* ROW6: Setores */}
      {s.length>0&&<div>
        <div style={{fontSize:13,fontWeight:700,color:C.tx,marginBottom:8}}>Departamentos</div>
        <Tbl cols={[
          {l:"Departamento",r:r=>r.n,b:1},{l:"Venda",r:r=>fR(r.vd),a:"right",m:1},
          {l:"Compra",r:r=>fR(r.cp),a:"right",m:1},{l:"Margem",r:r=>fP(r.mg),a:"right",m:1,cl:r=>r.mg>=20?C.g:r.mg>=10?C.a:C.r},
          {l:"RCV",r:r=>fP(r.rcv),a:"right",m:1,cl:r=>r.rcv>85?C.r:C.g},
          {l:"Part%",r:r=>fP(r.pt),a:"right",m:1},{l:"SKUs",r:r=>fmt(r.sk),a:"right",m:1},
          {l:"Rupt.",r:r=>r.rupt||0,a:"right",m:1,cl:r=>r.rupt>0?C.r:C.tx3}
        ]} data={s} max={50}/>
      </div>}
      {p.length===0&&<div style={{padding:"40px",textAlign:"center",color:C.tx3}}>Conecte a API em Config para carregar dados reais</div>}
    </div>
  );
}

/* ════════════ PRODUTOS — Full filters ════════════ */
function ProdPage({openD}){
  const[q,setQ]=useState("");const[dept,setDept]=useState("Todos");const[sub,setSub]=useState("Todos");const[cv,setCv]=useState("Todos");const[marca,setMarca]=useState("Todos");const[forn,setForn]=useState("Todos");const[mgF,setMgF]=useState("Todos");const[estF,setEstF]=useState("Todos");const[sb,setSb]=useState("vd");const[maxR,setMaxR]=useState(200);
  const depts=useMemo(()=>["Todos",...[...new Set(D.produtos.map(p=>p.grupo||p.g).filter(Boolean))].sort()],[]);
  const subs=useMemo(()=>["Todos",...[...new Set(D.produtos.filter(p=>dept==="Todos"||(p.grupo||p.g)===dept).map(p=>p.sg).filter(Boolean))].sort()],[dept]);
  const marcas=useMemo(()=>["Todos",...[...new Set(D.produtos.map(p=>p.marca).filter(Boolean))].sort()],[]);
  const forns=useMemo(()=>["Todos",...[...new Set(D.produtos.map(p=>p.forn||p.f).filter(Boolean))].sort()],[]);
  const filt=useMemo(()=>{
    let l=[...D.produtos];
    if(q){const s=q.toLowerCase();l=l.filter(p=>(p.nome||p.n||"").toLowerCase().includes(s)||(p.grupo||p.g||"").toLowerCase().includes(s)||(p.forn||p.f||"").toLowerCase().includes(s)||String(p.id).includes(s));}
    if(dept!=="Todos")l=l.filter(p=>(p.grupo||p.g)===dept);
    if(sub!=="Todos")l=l.filter(p=>p.sg===sub);
    if(cv!=="Todos")l=l.filter(p=>(p.curva||p.c)===cv);
    if(marca!=="Todos")l=l.filter(p=>p.marca===marca);
    if(forn!=="Todos")l=l.filter(p=>(p.forn||p.f)===forn);
    if(mgF==="Negativa")l=l.filter(p=>p.mg<0);else if(mgF==="0-20%")l=l.filter(p=>p.mg>=0&&p.mg<20);else if(mgF===">20%")l=l.filter(p=>p.mg>=20);
    if(estF==="Zero")l=l.filter(p=>(p.est||p.e)<=0);else if(estF==="Baixo")l=l.filter(p=>{const e=p.est||p.e;return e>0&&e<10;});else if(estF===">10")l=l.filter(p=>(p.est||p.e)>=10);
    l.sort((a,b)=>{if(sb==="vd")return(b.vd||0)-(a.vd||0);if(sb==="mg")return(b.mg||0)-(a.mg||0);if(sb==="est")return(a.est||a.e||0)-(b.est||b.e||0);if(sb==="nome")return(a.nome||a.n||"").localeCompare(b.nome||b.n||"");if(sb==="preco")return(b.pr||b.preco||0)-(a.pr||a.preco||0);return 0;});
    return l;
  },[q,dept,sub,cv,marca,forn,mgF,estF,sb]);
  const stats=useMemo(()=>{const vd=filt.reduce((a,p)=>a+(p.vd||0),0);const mg=filt.length?filt.reduce((a,p)=>a+p.mg,0)/filt.length:0;const rupt=filt.filter(p=>(p.est||p.e)<=0).length;return{vd,mg,rupt,total:filt.length};},[filt]);
  return(
    <div style={{padding:"16px 24px",display:"flex",flexDirection:"column",gap:10}}>
      {/* Filters bar */}
      <div style={{background:C.w,borderRadius:10,padding:"12px 16px",border:`1px solid ${C.brd}`,display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end",boxShadow:C.shadow}}>
        <div style={{display:"flex",flexDirection:"column",gap:2}}>
          <span style={{fontSize:8,color:C.tx3,fontWeight:700,textTransform:"uppercase"}}>Buscar</span>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Produto, grupo, ID..." style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.bg,color:C.tx,fontSize:11,fontFamily:F,outline:"none",width:180}}/>
        </div>
        <Sel label="Departamento" value={dept} options={depts} onChange={v=>{setDept(v);setSub("Todos");}} width={170}/>
        <Sel label="Subgrupo" value={sub} options={subs} onChange={setSub} width={150}/>
        <Sel label="Curva" value={cv} options={["Todos","A","B","C","D"]} onChange={setCv} width={80}/>
        <Sel label="Marca" value={marca} options={marcas} onChange={setMarca} width={140}/>
        <Sel label="Fornecedor" value={forn} options={forns} onChange={setForn} width={160}/>
        <Sel label="Margem" value={mgF} options={["Todos","Negativa","0-20%",">20%"]} onChange={setMgF} width={100}/>
        <Sel label="Estoque" value={estF} options={["Todos","Zero","Baixo",">10"]} onChange={setEstF} width={90}/>
        <Sel label="Ordenar" value={sb} options={[{v:"vd",l:"Venda"},{v:"mg",l:"Margem"},{v:"est",l:"Estoque"},{v:"nome",l:"A-Z"},{v:"preco",l:"Preço"}]} onChange={setSb} width={90}/>
      </div>
      {/* Stats bar */}
      <div style={{display:"flex",gap:10}}>
        <Kpi small label="Filtrados" value={fmt(stats.total)} color="blue"/>
        <Kpi small label="Venda Total" value={fR(stats.vd)} color="green"/>
        <Kpi small label="Margem Média" value={fP(stats.mg)} color={stats.mg>=20?"green":stats.mg>=10?"amber":"red"}/>
        <Kpi small label="Ruptura" value={fmt(stats.rupt)} color={stats.rupt>0?"red":"gray"}/>
      </div>
      <Tbl cols={[
        {l:"ID",r:r=>r.id,m:1,a:"right"},{l:"Produto",r:r=>(r.nome||r.n||"").substring(0,40),b:1},
        {l:"Depto",r:r=>(r.grupo||r.g||"").substring(0,15),cl:()=>C.tx2},
        {l:"SubGr",r:r=>(r.sg||"").substring(0,15),cl:()=>C.tx3},
        {l:"Marca",r:r=>(r.marca||"").substring(0,12),cl:()=>C.tx3},
        {l:"Cv",r:r=><Bg t={r.curva||r.c}/>,a:"center"},
        {l:"Custo",r:r=>fR(r.custo||r.cu),a:"right",m:1},
        {l:"Preço",r:r=>fR(r.pr||r.preco),a:"right",m:1},
        {l:"Mg%",r:r=>fP(r.mg),a:"right",m:1,cl:r=>r.mg<0?C.r:r.mg<15?C.a:C.g},
        {l:"Est",r:r=>fmt(r.est||r.e),a:"right",m:1,cl:r=>(r.est||r.e)<=0?C.r:(r.est||r.e)<10?C.a:C.tx},
        {l:"Venda",r:r=>(r.vd||0)>0?fR(r.vd):"—",a:"right",m:1},
        {l:"Forn",r:r=>(r.forn||r.f||"").substring(0,15),cl:()=>C.tx3}
      ]} data={filt} max={maxR} onClick={r=>openD?.(r,"produto")}/>
      {filt.length>maxR&&<button onClick={()=>setMaxR(m=>m+200)} style={{padding:"8px 20px",borderRadius:6,border:`1px solid ${C.brd}`,background:C.w,color:C.acc,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F,alignSelf:"center"}}>Carregar mais</button>}
    </div>
  );
}

/* ════════════ COMPRAS ════════════ */
function CompPage(){
  const k=D.kpis||{};
  return(<div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
      <Kpi icon="🛒" label="Total Compras" value={fR(k.totalCompra||0)} color="red"/>
      <Kpi icon="📋" label="Notas Entrada" value={fmt(k.totalEntradas||0)} color="blue"/>
      <Kpi icon="🔄" label="RCV" value={fP(k.rcv||0)} color={(k.rcv||0)>85?"red":"green"}/>
    </div>
    {D.pedidos.length>0&&<><div style={{fontSize:13,fontWeight:700,color:C.tx}}>Pedidos de Compra</div>
    <Tbl cols={[{l:"ID",r:r=>r.id,m:1},{l:"Fornecedor",r:r=>(r.forn||"").substring(0,30),b:1},{l:"Valor",r:r=>fR(r.valor),a:"right",m:1},{l:"Data",r:r=>(r.data||"").substring(0,10),m:1},{l:"Status",r:r=>r.status||"—"}]} data={D.pedidos} max={100}/></>}
  </div>);
}

/* ════════════ FORNECEDORES ════════════ */
function FornPage({openD}){
  const[q,setQ]=useState("");
  const filt=useMemo(()=>{let l=[...D.fornecedores];if(q){const s=q.toLowerCase();l=l.filter(f=>(f.n||"").toLowerCase().includes(s));}return l;},[q]);
  return(<div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",gap:8,alignItems:"center"}}><div style={{display:"flex",flexDirection:"column",gap:2}}><span style={{fontSize:8,color:C.tx3,fontWeight:700,textTransform:"uppercase"}}>Buscar</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Fornecedor..." style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.w,color:C.tx,fontSize:11,outline:"none",width:240}}/></div><div style={{flex:1}}/><span style={{fontSize:10,color:C.tx3}}>{filt.length} fornecedores</span></div>
    <Tbl cols={[{l:"Fornecedor",r:r=>r.n,b:1},{l:"CNPJ",r:r=>r.cn||"—",m:1,cl:()=>C.tx3},{l:"Vol. Compras",r:r=>r.cp>0?fR(r.cp):"—",a:"right",m:1},{l:"Notas",r:r=>r.cnt||"—",a:"right",m:1},{l:"Produtos",r:r=>r.pr||"—",a:"right",m:1},{l:"Lead",r:r=>r.dias?r.dias+"d":"—",a:"right",m:1},{l:"Últ.Compra",r:r=>r.uc||"—",a:"right",m:1,cl:()=>C.tx2}]} data={filt} max={300} onClick={r=>openD?.(r,"fornecedor")}/>
  </div>);
}

/* ════════════ FINANCEIRO ════════════ */
function FinPage(){
  const k=D.kpis||{};const[tab,setTab]=useState("resumo");
  return(<div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
      <Kpi icon="💵" label="A Receber" value={fR(k.contasReceber||0)} color="green" sub={k.contasReceberVencido>0?`Vencido: ${fR(k.contasReceberVencido)}`:null}/>
      <Kpi icon="💳" label="A Pagar" value={fR(k.contasPagar||0)} color="red" sub={k.contasPagarVencido>0?`Vencido: ${fR(k.contasPagarVencido)}`:null}/>
      <Kpi icon="📊" label="Saldo" value={fR(k.saldo||0)} color={(k.saldo||0)>=0?"green":"red"}/>
      <Kpi icon="📉" label="Despesas" value={fR(k.despesas||0)} color="gray"/>
    </div>
    <div style={{display:"flex",gap:2,background:C.bg2,borderRadius:6,padding:2,alignSelf:"flex-start"}}>
      {[["resumo","Resumo"],["receber","A Receber"],["pagar","A Pagar"],["despesas","Despesas"]].map(([k2,l])=><button key={k2} onClick={()=>setTab(k2)} style={{padding:"6px 16px",borderRadius:5,border:"none",cursor:"pointer",background:tab===k2?C.w:C.bg2,color:tab===k2?C.acc:C.tx3,fontSize:11,fontWeight:600,fontFamily:F,boxShadow:tab===k2?C.shadow:"none"}}>{l}</button>)}
    </div>
    {tab==="receber"&&<Tbl cols={[{l:"Cliente",r:r=>(r.cliente||"").substring(0,30),b:1},{l:"Valor",r:r=>fR(r.valor),a:"right",m:1},{l:"Venc.",r:r=>(r.venc||"").substring(0,10),m:1,cl:r=>{const t=new Date().toISOString().substring(0,10);return r.venc&&r.venc<t?C.r:C.tx}},{l:"Doc",r:r=>r.doc||"—",m:1},{l:"Status",r:r=>r.status||"—"}]} data={D.contasReceber} max={200}/>}
    {tab==="pagar"&&<Tbl cols={[{l:"Forn.",r:r=>(r.forn||"").substring(0,30),b:1},{l:"Valor",r:r=>fR(r.valor),a:"right",m:1},{l:"Venc.",r:r=>(r.venc||"").substring(0,10),m:1,cl:r=>{const t=new Date().toISOString().substring(0,10);return r.venc&&r.venc<t?C.r:C.tx}},{l:"Doc",r:r=>r.doc||"—",m:1},{l:"Status",r:r=>r.status||"—"}]} data={D.contasPagar} max={200}/>}
    {tab==="despesas"&&<Tbl cols={[{l:"Descrição",r:r=>(r.desc||"").substring(0,40),b:1},{l:"Valor",r:r=>fR(r.valor),a:"right",m:1},{l:"Data",r:r=>(r.data||"").substring(0,10),m:1}]} data={D.despesas} max={200}/>}
    {tab==="resumo"&&<div style={{color:C.tx3,fontSize:12,padding:20,textAlign:"center"}}>{(k.contasReceber||0)>0?"Selecione uma aba para ver detalhes":"Dados carregados após sincronização"}</div>}
  </div>);
}

/* ════════════ OFERTAS ════════════ */
function OferPage(){
  const of=D.extras?.ofertas||[];
  return(<div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:14}}>
    <Kpi label="Ofertas Ativas" value={fmt(D.kpis?.ofertasAtivas||0)} color="cyan" icon="🏷️"/>
    {of.length>0?<Tbl cols={[{l:"ID",r:r=>r.id,m:1},{l:"Descrição",r:r=>(r.descricao||r.nome||"Oferta").substring(0,40),b:1},{l:"Início",r:r=>(r.dataInicial||r.dataInicio||"").substring(0,10),m:1},{l:"Fim",r:r=>(r.dataFinal||r.dataFim||"").substring(0,10),m:1}]} data={of} max={100}/>:<div style={{padding:40,textAlign:"center",color:C.tx3,fontSize:12}}>Dados disponíveis após sincronização</div>}
  </div>);
}

/* ════════════ CONFIG ════════════ */
function CfgPage({apiState:as,setApiState:sas,doSync,syncLog}){
  const conn=as.connected,sync=as.syncing;
  return(<div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:14,maxWidth:700}}>
    <div style={{background:C.w,borderRadius:10,padding:20,border:`1px solid ${C.brd}`,boxShadow:C.shadow}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:conn?C.g:sync?C.a:C.r}}/>
        <span style={{fontSize:12,fontWeight:600,color:conn?C.g:C.tx2}}>{conn?"Conectado":sync?"Sincronizando...":"Desconectado"}</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div><label style={{fontSize:9,color:C.tx3,fontWeight:700,display:"block",marginBottom:3}}>URL BASE</label>
        <input value={as.url} onChange={e=>sas(p=>({...p,url:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:6,border:`1px solid ${C.brd}`,background:C.bg,color:C.acc,fontSize:11,fontFamily:M,outline:"none",boxSizing:"border-box"}}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div><label style={{fontSize:9,color:C.tx3,fontWeight:700,display:"block",marginBottom:3}}>USUÁRIO</label>
          <input value={as.user||""} onChange={e=>sas(p=>({...p,user:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:6,border:`1px solid ${C.brd}`,background:C.bg,color:C.tx,fontSize:11,outline:"none",boxSizing:"border-box"}}/></div>
          <div><label style={{fontSize:9,color:C.tx3,fontWeight:700,display:"block",marginBottom:3}}>SENHA</label>
          <input value={as.pass||""} onChange={e=>sas(p=>({...p,pass:e.target.value}))} type="password" style={{width:"100%",padding:"8px 12px",borderRadius:6,border:`1px solid ${C.brd}`,background:C.bg,color:C.tx,fontSize:11,outline:"none",boxSizing:"border-box"}}/></div>
        </div>
        {as.token&&<div style={{padding:"6px 10px",borderRadius:5,fontFamily:M,fontSize:8,wordBreak:"break-all",background:conn?C.gBg:C.bg,color:conn?C.g:C.tx3,border:`1px solid ${conn?C.gBd:C.brd}`}}>{as.token.substring(0,80)}...</div>}
        {as.error&&<div style={{padding:"8px 10px",borderRadius:5,background:C.rBg,border:`1px solid ${C.rBd}`}}><span style={{fontSize:11,color:C.r,fontWeight:600}}>{as.error}</span></div>}
        <button onClick={doSync} disabled={sync||!as.user||!as.pass} style={{padding:"10px 24px",borderRadius:6,border:"none",cursor:sync?"wait":"pointer",background:sync?C.bg2:C.acc,color:sync?C.tx3:C.w,fontWeight:700,fontSize:13,fontFamily:F,opacity:(!as.user||!as.pass)?.4:1}}>{sync?"Sincronizando...":conn?"Re-sincronizar":"Conectar"}</button>
      </div>
    </div>
    {syncLog.length>0&&<div style={{background:C.w,borderRadius:10,padding:14,border:`1px solid ${C.brd}`,maxHeight:300,overflowY:"auto",boxShadow:C.shadow}}>
      <div style={{fontSize:10,fontWeight:700,color:C.tx3,marginBottom:6}}>LOG DE SINCRONIZAÇÃO</div>
      {syncLog.slice(-40).map((l,i)=><div key={i} style={{fontSize:10,fontFamily:M,padding:"2px 0",color:l.s==="ok"?C.g:l.s==="error"?C.r:C.tx3,borderBottom:`1px solid ${C.bg2}`}}><span style={{color:C.tx3,marginRight:4}}>{l.t}</span>{l.m}</div>)}
    </div>}
    {as.stats&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
      <Kpi small label="Endpoints OK" value={as.stats.success} color="green"/>
      <Kpi small label="Falhou" value={as.stats.failed} color={as.stats.failed>0?"red":"gray"}/>
      <Kpi small label="Total" value={as.stats.total} color="blue"/>
    </div>}
  </div>);
}

/* ════════════ DETAIL PANEL ════════════ */
function Detail({item:it,type:ty,onClose}){
  if(!it)return null;
  return(<div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",justifyContent:"flex-end"}} onClick={onClose}>
    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.3)",backdropFilter:"blur(3px)"}}/>
    <div onClick={e=>e.stopPropagation()} style={{position:"relative",width:420,maxWidth:"90vw",height:"100vh",background:C.w,borderLeft:`1px solid ${C.brd}`,overflowY:"auto",padding:20,boxShadow:"-4px 0 20px rgba(0,0,0,.1)"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
        <div><div style={{fontSize:9,color:C.tx3,fontWeight:700,textTransform:"uppercase",marginBottom:3}}>{ty}</div>
        <div style={{fontSize:15,fontWeight:700,color:C.tx}}>{it.nome||it.n}</div>
        {ty==="produto"&&<div style={{fontSize:10,color:C.tx3,marginTop:2}}>{it.grupo||it.g} › {it.sg||"—"} · {it.marca||"—"} · Forn: {it.forn||it.f||"—"}</div>}</div>
        <button onClick={onClose} style={{background:C.bg2,border:`1px solid ${C.brd}`,color:C.tx2,width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
      </div>
      {ty==="produto"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Kpi small label="Preço" value={fR(it.pr||it.preco)} color="blue"/>
        <Kpi small label="Custo" value={fR(it.custo||it.cu)} color="gray"/>
        <Kpi small label="Margem" value={fP(it.mg)} color={it.mg<0?"red":"green"}/>
        <Kpi small label="Estoque" value={fmt(it.est||it.e)} color={(it.est||it.e)<=0?"red":"blue"}/>
        <Kpi small label="Venda" value={(it.vd||0)>0?fR(it.vd):"—"} color="green"/>
        <Kpi small label="Curva" value={it.curva||it.c} color="blue"/>
        <Kpi small label="Unidade" value={it.unidade||it.u||"UN"} color="gray"/>
        <Kpi small label="ID" value={it.id} color="gray"/>
      </div>}
      {ty==="fornecedor"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Kpi small label="Compras" value={fR(it.cp)} color="red"/><Kpi small label="Produtos" value={it.pr||"—"} color="blue"/>
        <Kpi small label="CNPJ" value={it.cn||it.cnpj||"—"} color="gray"/><Kpi small label="Últ.Compra" value={it.uc||"—"} color="gray"/>
      </div>}
    </div>
  </div>);
}

/* ════════════ MAIN ════════════ */
const pages={dash:DashPage,prod:ProdPage,comp:CompPage,forn:FornPage,fin:FinPage,ofer:OferPage};
export default function App(){
  const[pg,setPg]=useState("dash");const[det,setDet]=useState(null);const[detT,setDetT]=useState(null);
  const[realData,setRealData]=useState(null);const[syncLog,setSyncLog]=useState([]);
  const[dateRange,setDateRange]=useState(()=>{const now=new Date(),p=n=>String(n).padStart(2,"0"),f=d=>`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;const d30=new Date(now);d30.setDate(d30.getDate()-30);return{start:f(d30),end:f(now)};});
  const[apiState,setApiState]=useState({url:"http://177.73.209.174:8059/integracao/sgsistemas/v1",connected:false,syncing:false,user:"",pass:"",token:"",error:null,syncedAt:null,stats:null});
  const log=(m,s="info")=>setSyncLog(p=>[...p,{t:new Date().toLocaleTimeString(),m,s}]);

  const doSyncWithConfig=useCallback(async(cfg,di,df)=>{
    const{url,user,pass,token:tk}=cfg;
    setApiState(p=>({...p,syncing:true,connected:false,error:null}));log("Iniciando...");
    let token=tk;
    if(!token&&user&&pass){log("Autenticando...");try{const a=await authenticate(url,user,pass);if(!a.success){setApiState(p=>({...p,syncing:false,error:a.error}));log("FALHA: "+a.error,"error");return;}token=a.token;log("Token obtido!","ok");}catch(e){setApiState(p=>({...p,syncing:false,error:e.message}));log("ERRO: "+e.message,"error");return;}}
    if(!token){setApiState(p=>({...p,syncing:false,error:"Sem token"}));return;}
    setApiState(p=>({...p,token}));
    const ds=di||dateRange.start,de=df||dateRange.end;log(`Sincronizando ${ds} a ${de}...`);
    try{const s=await syncAll(url,token,"1",ds,de);
      if(!s.success){setApiState(p=>({...p,syncing:false,error:s.error}));log("FALHA: "+s.error,"error");return;}
      log(`OK: ${s.stats?.success||0}/${s.stats?.total||0} endpoints em ${((s.elapsed||0)/1000).toFixed(1)}s`,"ok");
      if(s.report)Object.entries(s.report).forEach(([k,v])=>{log(`  ${k}: ${v.success?v.count+" reg":"FALHOU"+(v.error?" — "+v.error:"")}`,v.success?"ok":"error");});
      const d=s.dashboard;
      if(d){
        const mp=(d.produtos||[]).map(p=>({id:p.id,nome:p.n,grupo:p.g,sg:p.sg||"",marca:p.marca||"",curva:p.c,custo:p.cu,pr:p.pr,preco:p.pr,mg:p.mg,est:p.e,forn:p.f,unidade:p.u,vd:p.vd||0,qtd:p.qt||0,lucro:p.lu||0}));
        const mf=(d.fornecedores||[]).map(f=>({id:f.id,n:f.n,cp:f.cp,cnt:f.cnt,uc:f.uc,pr:f.pr,cn:f.cn||"",dias:f.dias||0}));
        setRealData({produtos:mp,setores:d.setores||[],fornecedores:mf,vd:d.vendasDiarias||[],kpis:d.kpis||{},contasReceber:d.contasReceber||[],contasPagar:d.contasPagar||[],despesas:d.despesas||[],pedidos:d.pedidosCompra||[],extras:d.extras||{},loaded:true});
        log(`Dashboard: ${mp.length} prod, ${mf.length} forn, ${(d.setores||[]).length} setores`,"ok");
      }
      setApiState(p=>({...p,url,user:cfg.user||p.user,pass:cfg.pass||p.pass,token,connected:true,syncing:false,error:null,syncedAt:s.syncedAt,stats:s.stats}));
      saveConfig({url,user:cfg.user||apiState.user,pass:cfg.pass||apiState.pass,token});
    }catch(e){setApiState(p=>({...p,syncing:false,error:e.message}));log("ERRO: "+e.message,"error");}
  },[apiState.user,apiState.pass,dateRange]);

  const doSync=useCallback(()=>doSyncWithConfig(apiState),[apiState,doSyncWithConfig]);
  const doSyncRange=useCallback((s,e)=>{setDateRange({start:s,end:e});if(apiState.token)doSyncWithConfig({...apiState},s,e);},[apiState,doSyncWithConfig]);
  useEffect(()=>{const sv=loadConfig();if(sv?.token&&sv?.url){setApiState(p=>({...p,...sv}));setTimeout(()=>doSyncWithConfig(sv),300);}},[]);
  const openD=(item,type)=>{setDet(item);setDetT(type);};
  if(realData)D={...D,...realData};
  const Page=pages[pg]||DashPage;
  return(
    <div style={{display:"flex",height:"100vh",background:C.bg,color:C.tx,fontFamily:F,overflow:"hidden"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');*{margin:0;padding:0;box-sizing:border-box}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.brd2};border-radius:3px}input::placeholder{color:${C.tx3}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}select{font-family:${F}}`}</style>
      <Side a={pg} set={setPg} conn={apiState.connected} sync={apiState.syncing}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"10px 24px",borderBottom:`1px solid ${C.brd}`,background:C.w,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",boxShadow:"0 1px 3px rgba(0,0,0,.03)"}}>
          <h1 style={{fontSize:16,fontWeight:700,color:C.tx,margin:0}}>{{dash:"Painel de Performance",prod:"Produtos",comp:"Compras",forn:"Fornecedores",fin:"Financeiro",ofer:"Ofertas",cfg:"Configurações"}[pg]}</h1>
          {pg!=="cfg"&&<DatePick start={dateRange.start} end={dateRange.end} onChange={(s,e)=>setDateRange({start:s,end:e})} onApply={()=>{if(apiState.token)doSyncWithConfig(apiState,dateRange.start,dateRange.end);}}/>}
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {apiState.syncing&&<span style={{fontSize:10,color:C.a,fontWeight:600}}>⏳ Sincronizando...</span>}
            {apiState.syncedAt&&<span style={{fontSize:9,color:C.tx3,fontFamily:M}}>{new Date(apiState.syncedAt).toLocaleTimeString("pt-BR")}</span>}
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto"}}>{pg==="cfg"?<CfgPage apiState={apiState} setApiState={setApiState} doSync={doSync} syncLog={syncLog}/>:<Page openD={openD}/>}</div>
      </div>
      {det&&<Detail item={det} type={detT} onClose={()=>setDet(null)}/>}
    </div>
  );
}

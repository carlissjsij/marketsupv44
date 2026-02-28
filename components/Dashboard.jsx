"use client";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { authenticate, syncAll, saveConfig, loadConfig } from "../lib/api-client";

// ── THEME ──
const C={bg:"#08080d",bg1:"#0e0e15",bg2:"#13131c",bg3:"#1a1a26",
brd:"#1f1f30",brd2:"#2a2a40",
acc:"#6366f1",accL:"#818cf8",accD:"rgba(99,102,241,.1)",accB:"rgba(99,102,241,.2)",
g:"#22c55e",gD:"rgba(34,197,94,.08)",gB:"rgba(34,197,94,.2)",
r:"#ef4444",rD:"rgba(239,68,68,.08)",rB:"rgba(239,68,68,.2)",
a:"#f59e0b",aD:"rgba(245,158,11,.08)",
cy:"#06b6d4",cyD:"rgba(6,182,212,.08)",
tx:"#e2e2ef",tx2:"#8888a0",tx3:"#55556a",w:"#fff"};
const F="'DM Sans',system-ui,sans-serif",M="'JetBrains Mono',monospace";

let DATA={produtos:[],setores:[],fornecedores:[],vd:[],kpis:{},contasReceber:[],contasPagar:[],despesas:[],pedidos:[],extras:{}};

const n=v=>{if(v==null||v==="")return 0;const x=typeof v==="string"?parseFloat(v.replace(",",".")):Number(v);return isNaN(x)?0:x};
const fmt=v=>{if(v==null||isNaN(v))return"—";if(Math.abs(v)>=1e6)return(v/1e6).toFixed(1)+"M";if(Math.abs(v)>=1e3)return v.toLocaleString("pt-BR",{maximumFractionDigits:0});return v.toLocaleString("pt-BR",{maximumFractionDigits:2})};
const fR=v=>"R$ "+fmt(v);
const fP=v=>v==null?"—":v.toFixed(1).replace(".",",")+"%";

// ── 3D CARD ──
function Card3D({children,glow,style={}}){
  const [rot,setRot]=useState({x:0,y:0});
  const ref=useRef(null);
  const onMove=useCallback(e=>{
    if(!ref.current)return;
    const r=ref.current.getBoundingClientRect();
    const x=((e.clientX-r.left)/r.width-.5)*8;
    const y=((e.clientY-r.top)/r.height-.5)*-8;
    setRot({x:y,y:x});
  },[]);
  const onLeave=useCallback(()=>setRot({x:0,y:0}),[]);
  const gc=glow==="green"?C.g:glow==="red"?C.r:glow==="amber"?C.a:C.acc;
  return(
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} style={{
      background:C.bg2,border:`1px solid ${C.brd}`,borderRadius:10,
      transform:`perspective(800px) rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
      transition:"transform .15s ease-out",willChange:"transform",
      boxShadow:glow?`0 4px 20px ${gc}15, inset 0 1px 0 ${gc}10`:`0 2px 8px rgba(0,0,0,.3)`,
      ...style,
    }}>{children}</div>
  );
}

// ── METRIC ──
function Kpi({label,value,sub,accent,icon}){
  const cl=accent==="r"?C.r:accent==="g"?C.g:accent==="a"?C.a:accent==="cy"?C.cy:C.tx;
  const glow=accent==="r"?"red":accent==="g"?"green":accent==="a"?"amber":null;
  return(
    <Card3D glow={glow} style={{padding:"14px 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        {icon&&<span style={{fontSize:14,opacity:.7}}>{icon}</span>}
        <span style={{fontSize:9,color:C.tx3,fontWeight:700,letterSpacing:".6px",textTransform:"uppercase"}}>{label}</span>
      </div>
      <div style={{fontSize:22,fontWeight:700,fontFamily:M,color:cl,letterSpacing:"-.5px",lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:9,color:C.tx3,marginTop:5}}>{sub}</div>}
    </Card3D>
  );
}

// ── TABLE ──
function Tbl({cols,data,max=100,onClick}){
  const vis=useMemo(()=>data.slice(0,max),[data,max]);
  return(
    <div style={{overflow:"auto",borderRadius:8,border:`1px solid ${C.brd}`,background:C.bg1}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:F}}>
        <thead><tr style={{background:C.bg2}}>
          {cols.map((c,i)=><th key={i} style={{padding:"7px 10px",textAlign:c.a||"left",fontWeight:700,color:C.tx3,fontSize:9,letterSpacing:".4px",textTransform:"uppercase",borderBottom:`1px solid ${C.brd}`,whiteSpace:"nowrap",position:"sticky",top:0,background:C.bg2}}>{c.l}</th>)}
        </tr></thead>
        <tbody>{vis.map((row,ri)=>(
          <tr key={ri} onClick={()=>onClick?.(row)} style={{cursor:onClick?"pointer":"default",borderBottom:`1px solid ${C.brd}08`}}
            onMouseEnter={e=>e.currentTarget.style.background=C.bg3}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            {cols.map((c,ci)=><td key={ci} style={{padding:"6px 10px",textAlign:c.a||"left",color:typeof c.cl==="function"?c.cl(row):(c.cl||C.tx),fontFamily:c.m?M:F,fontWeight:c.b?600:400,fontSize:11,whiteSpace:"nowrap"}}>{typeof c.r==="function"?c.r(row):""}</td>)}
          </tr>
        ))}</tbody>
      </table>
      {data.length>max&&<div style={{padding:"6px",fontSize:9,color:C.tx3,textAlign:"center",background:C.bg2}}>Mostrando {max} de {data.length}</div>}
    </div>
  );
}

// ── BADGE ──
function Bg({t,v}){
  const s={A:{bg:C.gD,c:C.g,bd:C.gB},B:{bg:C.accD,c:C.accL,bd:C.accB},C:{bg:C.aD,c:C.a,bd:"rgba(245,158,11,.2)"},D:{bg:"rgba(80,80,100,.1)",c:C.tx3,bd:"rgba(80,80,100,.2)"},green:{bg:C.gD,c:C.g,bd:C.gB},red:{bg:C.rD,c:C.r,bd:C.rB}};
  const st=s[t]||s[v]||s.D;
  return <span style={{display:"inline-block",padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:700,fontFamily:M,background:st.bg,color:st.c,border:`1px solid ${st.bd}`}}>{t}</span>;
}

// ── BAR CHART 3D ──
function Chart3D({data,h=120}){
  const mx=Math.max(...data.map(d=>d.v),1);
  return(
    <div style={{display:"flex",alignItems:"flex-end",gap:2,height:h,padding:"0 4px"}}>
      {data.map((d,i)=>{
        const pct=Math.max((d.v/mx)*100,3);
        return(
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <div style={{width:"100%",borderRadius:"4px 4px 1px 1px",height:`${pct}%`,
              background:`linear-gradient(180deg,${C.accL}cc,${C.acc}88)`,
              boxShadow:`0 0 8px ${C.acc}30`,transition:"height .5s ease",
              transform:"perspective(200px) rotateX(2deg)",
            }}/>
            <span style={{fontSize:7,color:C.tx3,fontFamily:M,whiteSpace:"nowrap"}}>{d.d}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── DONUT ──
function Donut({segments,size=100,label}){
  const total=segments.reduce((a,s)=>a+s.v,0)||1;
  let cum=0;
  const colors=[C.acc,C.g,C.a,C.cy,C.r,"#a855f7","#ec4899","#8b5cf6"];
  return(
    <div style={{display:"flex",alignItems:"center",gap:16}}>
      <svg width={size} height={size} viewBox="0 0 42 42" style={{filter:"drop-shadow(0 2px 6px rgba(0,0,0,.3))"}}>
        <circle cx="21" cy="21" r="15.9" fill="none" stroke={C.bg3} strokeWidth="4"/>
        {segments.slice(0,8).map((s,i)=>{const p=(s.v/total)*100;const o=100-cum+25;cum+=p;
          return <circle key={i} cx="21" cy="21" r="15.9" fill="none" stroke={colors[i%colors.length]} strokeWidth="4" strokeDasharray={`${p} ${100-p}`} strokeDashoffset={o}/>;
        })}
        <text x="21" y="22" textAnchor="middle" fontSize="6" fill={C.tx} fontFamily={M} fontWeight="700">{label||fmt(total)}</text>
      </svg>
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        {segments.slice(0,6).map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:10}}>
            <div style={{width:8,height:8,borderRadius:2,background:colors[i%colors.length],flexShrink:0}}/>
            <span style={{color:C.tx2,flex:1}}>{s.n}</span>
            <span style={{color:C.tx,fontFamily:M,fontWeight:600}}>{fR(s.v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PERIOD PICKER ──
function DatePicker({start,end,onChange}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
      <span style={{fontSize:9,color:C.tx3,fontWeight:700}}>PERÍODO:</span>
      <input type="date" value={start} onChange={e=>onChange(e.target.value,end)} style={{padding:"4px 8px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.bg3,color:C.tx,fontSize:11,fontFamily:M,outline:"none"}}/>
      <span style={{color:C.tx3,fontSize:10}}>até</span>
      <input type="date" value={end} onChange={e=>onChange(start,e.target.value)} style={{padding:"4px 8px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.bg3,color:C.tx,fontSize:11,fontFamily:M,outline:"none"}}/>
      {[["7d","7 dias"],["30d","30 dias"],["90d","90 dias"],["mes","Mês"],["ano","Ano"]].map(([k,l])=>(
        <button key={k} onClick={()=>{
          const now=new Date(),p=(n)=>String(n).padStart(2,"0"),f=(d)=>`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
          const e=f(now);let s;
          if(k==="7d"){const d=new Date(now);d.setDate(d.getDate()-7);s=f(d);}
          else if(k==="30d"){const d=new Date(now);d.setDate(d.getDate()-30);s=f(d);}
          else if(k==="90d"){const d=new Date(now);d.setDate(d.getDate()-90);s=f(d);}
          else if(k==="mes")s=`${now.getFullYear()}-${p(now.getMonth()+1)}-01`;
          else s=`${now.getFullYear()}-01-01`;
          onChange(s,e);
        }} style={{padding:"4px 10px",borderRadius:4,border:`1px solid ${C.brd}`,background:C.bg3,color:C.tx2,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F}}>
          {l}
        </button>
      ))}
    </div>
  );
}

// ── SEARCH ──
function Search({value,onChange,ph}){
  return <input value={value} onChange={e=>onChange(e.target.value)} placeholder={ph||"Buscar..."} style={{padding:"6px 12px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.bg2,color:C.tx,fontSize:11,fontFamily:F,outline:"none",width:240,boxSizing:"border-box"}}/>;
}

// ── SIDEBAR ──
const NAV=[{id:"dash",lb:"Painel",ic:"◈"},{id:"prod",lb:"Produtos",ic:"▤"},{id:"comp",lb:"Compras",ic:"▥"},{id:"forn",lb:"Fornecedores",ic:"◆"},{id:"fin",lb:"Financeiro",ic:"◇"},{id:"ofer",lb:"Ofertas",ic:"◎"},{id:"cfg",lb:"Config",ic:"⚙"}];
function Side({a,set,conn,sync}){
  return(
    <nav style={{width:190,background:C.bg,borderRight:`1px solid ${C.brd}`,display:"flex",flexDirection:"column",flexShrink:0}}>
      <div style={{padding:"16px 16px 14px",borderBottom:`1px solid ${C.brd}`}}>
        <div style={{fontSize:16,fontWeight:800,color:C.w,fontFamily:F,letterSpacing:"-.3px"}}>MarketSUP</div>
        <div style={{fontSize:9,color:C.tx3,marginTop:2,fontFamily:M}}>retail intelligence</div>
      </div>
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.brd}`,display:"flex",alignItems:"center",gap:6}}>
        <div style={{width:7,height:7,borderRadius:"50%",background:conn?C.g:sync?C.a:C.r,boxShadow:conn?`0 0 6px ${C.g}`:"none",...(sync?{animation:"pulse 1s infinite"}:{})}}/>
        <span style={{fontSize:10,color:conn?C.g:sync?C.a:C.tx3,fontWeight:600}}>{conn?"Online":sync?"Syncing...":"Offline"}</span>
      </div>
      <div style={{flex:1,padding:"6px 8px",display:"flex",flexDirection:"column",gap:1}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>set(n.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:6,border:"none",cursor:"pointer",background:a===n.id?C.accD:"transparent",color:a===n.id?C.accL:C.tx2,fontSize:12,fontWeight:a===n.id?600:400,fontFamily:F,textAlign:"left",width:"100%",borderLeft:a===n.id?`2px solid ${C.acc}`:"2px solid transparent"}}>
            <span style={{fontFamily:M,fontSize:12,width:16,textAlign:"center"}}>{n.ic}</span>{n.lb}
          </button>
        ))}
      </div>
    </nav>
  );
}

// ════════════ DASH PAGE ════════════
function DashPage(){
  const k=DATA.kpis||{};
  const s=DATA.setores;
  const p=DATA.produtos;
  const topV=useMemo(()=>[...p].sort((a,b)=>(b.vd||0)-(a.vd||0)).slice(0,10),[p]);
  const negMg=useMemo(()=>p.filter(x=>x.mg<0&&x.pr>0).sort((a,b)=>a.mg-b.mg).slice(0,10),[p]);
  const curvas=useMemo(()=>{const c={A:0,B:0,C:0,D:0};p.forEach(x=>{const cv=x.curva||x.c||"D";c[cv]=(c[cv]||0)+1;});return Object.entries(c).map(([k,v])=>({n:"Curva "+k,v}));},[p]);
  return(
    <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:18}}>
      {/* ROW 1: Main KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:10}}>
        <Kpi icon="💰" label="Receita Bruta" value={fR(k.receitaBruta||0)} accent={(k.receitaBruta||0)>0?"g":undefined} sub={k.cupons?`${fmt(k.cupons)} cupons`:null}/>
        <Kpi icon="📊" label="Vendas Hoje" value={fR(k.vendasHoje||0)} accent="cy" sub={k.vendasHojeCupons?`${k.vendasHojeCupons} cupons`:null}/>
        <Kpi icon="🛒" label="Compras" value={fR(k.totalCompra||0)} sub={k.totalEntradas?`${k.totalEntradas} notas`:null}/>
        <Kpi icon="📈" label="Lucro Bruto" value={fR(k.lucroBruto||0)} accent={(k.lucroBruto||0)>0?"g":"r"}/>
        <Kpi icon="⚖️" label="Margem Média" value={fP(k.margemMedia||0)} accent={(k.margemMedia||0)>=20?"g":(k.margemMedia||0)>=10?"a":"r"}/>
        <Kpi icon="🔄" label="RCV" value={fP(k.rcv||0)} accent={(k.rcv||0)>85?"r":(k.rcv||0)>75?"a":"g"} sub="Compra/Venda"/>
      </div>
      {/* ROW 2: Secondary KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
        <Kpi label="Ticket Médio" value={fR(k.ticketMedio||0)}/>
        <Kpi label="Produtos" value={fmt(k.totalProdutos||0)} sub={`${k.produtosEnriched||0} com vendas`}/>
        <Kpi label="Fornecedores" value={fmt(k.totalFornecedores||0)}/>
        <Kpi label="Clientes" value={fmt(k.totalClientes||0)}/>
        <Kpi label="Ruptura" value={fmt(k.ruptura||0)} accent={(k.ruptura||0)>50?"r":"a"} sub="sem estoque"/>
        <Kpi label="Estoque Baixo" value={fmt(k.estBaixo||0)} accent="a" sub="< 10 un"/>
        <Kpi label="Mg. Negativa" value={fmt(k.mgNegativa||0)} accent="r" sub="abaixo custo"/>
        <Kpi label="Ofertas Ativas" value={fmt(k.ofertasAtivas||0)} accent="cy"/>
      </div>
      {/* ROW 3: Financial KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:10}}>
        <Kpi icon="💵" label="Contas Receber" value={fR(k.contasReceber||0)} accent="g" sub={k.contasReceberVencido?`Vencido: ${fR(k.contasReceberVencido)}`:null}/>
        <Kpi icon="💳" label="Contas Pagar" value={fR(k.contasPagar||0)} accent="r" sub={k.contasPagarVencido?`Vencido: ${fR(k.contasPagarVencido)}`:null}/>
        <Kpi icon="📊" label="Saldo" value={fR(k.saldo||0)} accent={(k.saldo||0)>=0?"g":"r"}/>
        <Kpi icon="📉" label="Despesas" value={fR(k.despesas||0)}/>
        <Kpi label="Perdas" value={fR(k.totalPerdas||0)} accent={(k.totalPerdas||0)>0?"r":undefined}/>
        <Kpi label="Vencimentos" value={fmt(k.vencProximos||0)} sub="no período"/>
      </div>
      {/* ROW 4: Charts */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14}}>
        <Card3D style={{padding:16}}>
          <div style={{fontSize:10,fontWeight:700,color:C.tx3,marginBottom:10,textTransform:"uppercase",letterSpacing:".5px"}}>Vendas Diárias</div>
          {DATA.vd.length>0?<Chart3D data={DATA.vd} h={130}/>:<div style={{height:130,display:"flex",alignItems:"center",justifyContent:"center",color:C.tx3,fontSize:11}}>Sem dados diários</div>}
        </Card3D>
        <Card3D style={{padding:16}}>
          <div style={{fontSize:10,fontWeight:700,color:C.tx3,marginBottom:10,textTransform:"uppercase",letterSpacing:".5px"}}>Curva ABC</div>
          <Donut segments={curvas} size={90} label={fmt(p.length)}/>
        </Card3D>
      </div>
      {/* ROW 5: Finalizadoras + Cartoes */}
      {(DATA.extras?.finalizadoras?.length>0||DATA.extras?.cartoesTipos?.length>0)&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {DATA.extras?.finalizadoras?.length>0&&<Card3D style={{padding:16}}>
            <div style={{fontSize:10,fontWeight:700,color:C.tx3,marginBottom:10,textTransform:"uppercase",letterSpacing:".5px"}}>Finalizadoras de Venda</div>
            <Donut segments={DATA.extras.finalizadoras.slice(0,8)} size={80}/>
          </Card3D>}
          {DATA.extras?.cartoesTipos?.length>0&&<Card3D style={{padding:16}}>
            <div style={{fontSize:10,fontWeight:700,color:C.tx3,marginBottom:10,textTransform:"uppercase",letterSpacing:".5px"}}>Vendas por Cartão</div>
            <Donut segments={DATA.extras.cartoesTipos.slice(0,8)} size={80}/>
          </Card3D>}
        </div>
      )}
      {/* ROW 6: Setores table */}
      {s.length>0&&<div>
        <div style={{fontSize:10,fontWeight:700,color:C.tx3,marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>Setores / Departamentos</div>
        <Tbl cols={[
          {l:"Setor",r:r=>r.n,b:1},{l:"Venda",r:r=>fR(r.vd),a:"right",m:1},
          {l:"Compra",r:r=>fR(r.cp),a:"right",m:1},{l:"Margem",r:r=>fP(r.mg),a:"right",m:1,cl:r=>r.mg>=20?C.g:r.mg>=10?C.a:C.r},
          {l:"RCV",r:r=>fP(r.rcv),a:"right",m:1,cl:r=>r.rcv>85?C.r:C.g},
          {l:"Part%",r:r=>fP(r.pt),a:"right",m:1},{l:"SKUs",r:r=>fmt(r.sk),a:"right",m:1},
          {l:"Ruptura",r:r=>r.rupt||0,a:"right",m:1,cl:r=>r.rupt>0?C.r:C.tx3}
        ]} data={s} max={50}/>
      </div>}
      {/* ROW 7: Top + Negative */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {topV.length>0&&<div>
          <div style={{fontSize:10,fontWeight:700,color:C.tx3,marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>Top 10 Vendas</div>
          <Tbl cols={[
            {l:"Produto",r:r=>(r.nome||r.n||"").substring(0,30),b:1},
            {l:"Cv",r:r=><Bg t={r.curva||r.c}/>,a:"center"},
            {l:"Venda",r:r=>fR(r.vd),a:"right",m:1},{l:"Mg",r:r=>fP(r.mg),a:"right",m:1,cl:r=>r.mg<0?C.r:C.g}
          ]} data={topV}/>
        </div>}
        {negMg.length>0&&<div>
          <div style={{fontSize:10,fontWeight:700,color:C.tx3,marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>Margem Negativa</div>
          <Tbl cols={[
            {l:"Produto",r:r=>(r.nome||r.n||"").substring(0,30),b:1},
            {l:"Mg",r:r=>fP(r.mg),a:"right",m:1,cl:()=>C.r},
            {l:"Preço",r:r=>fR(r.pr||r.preco),a:"right",m:1},
            {l:"Custo",r:r=>fR(r.custo||r.cu),a:"right",m:1}
          ]} data={negMg}/>
        </div>}
      </div>
      {p.length===0&&<div style={{padding:"50px 20px",textAlign:"center",color:C.tx3}}>Conecte a API em Config para ver dados reais</div>}
    </div>
  );
}

// ════════════ PRODUTOS ════════════
function ProdPage({openD}){
  const [q,setQ]=useState("");const [cv,setCv]=useState("all");const [sb,setSb]=useState("vd");
  const filt=useMemo(()=>{
    let l=[...DATA.produtos];
    if(q){const s=q.toLowerCase();l=l.filter(p=>(p.nome||p.n||"").toLowerCase().includes(s)||(p.grupo||p.g||"").toLowerCase().includes(s)||(p.forn||p.f||"").toLowerCase().includes(s));}
    if(cv!=="all")l=l.filter(p=>(p.curva||p.c)===cv);
    l.sort((a,b)=>{if(sb==="vd")return(b.vd||0)-(a.vd||0);if(sb==="mg")return(b.mg||0)-(a.mg||0);if(sb==="est")return(a.est||a.e||0)-(b.est||b.e||0);if(sb==="nome")return(a.nome||a.n||"").localeCompare(b.nome||b.n||"");return 0;});
    return l;
  },[q,cv,sb]);
  return(
    <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <Search value={q} onChange={setQ} ph="Buscar produto, grupo, fornecedor..."/>
        <div style={{display:"flex",gap:1,background:C.bg2,borderRadius:5,padding:2}}>
          {["all","A","B","C","D"].map(v=><button key={v} onClick={()=>setCv(v)} style={{padding:"4px 10px",borderRadius:4,border:"none",cursor:"pointer",background:cv===v?C.bg3:"transparent",color:cv===v?C.tx:C.tx3,fontSize:10,fontWeight:600,fontFamily:F}}>{v==="all"?"Todos":v}</button>)}
        </div>
        <div style={{flex:1}}/>
        <div style={{display:"flex",gap:1,background:C.bg2,borderRadius:5,padding:2}}>
          {[["vd","Venda"],["mg","Margem"],["est","Estoque"],["nome","A-Z"]].map(([k,l])=><button key={k} onClick={()=>setSb(k)} style={{padding:"4px 10px",borderRadius:4,border:"none",cursor:"pointer",background:sb===k?C.bg3:"transparent",color:sb===k?C.tx:C.tx3,fontSize:10,fontWeight:600,fontFamily:F}}>{l}</button>)}
        </div>
        <span style={{fontSize:9,color:C.tx3}}>{filt.length} itens</span>
      </div>
      <Tbl cols={[
        {l:"Produto",r:r=>(r.nome||r.n||"").substring(0,40),b:1},
        {l:"Grupo",r:r=>(r.grupo||r.g||"").substring(0,18),cl:()=>C.tx2},
        {l:"Cv",r:r=><Bg t={r.curva||r.c}/>,a:"center"},
        {l:"Custo",r:r=>fR(r.custo||r.cu),a:"right",m:1},
        {l:"Preço",r:r=>fR(r.pr||r.preco),a:"right",m:1},
        {l:"Mg%",r:r=>fP(r.mg),a:"right",m:1,cl:r=>r.mg<0?C.r:r.mg<15?C.a:C.g},
        {l:"Est",r:r=>fmt(r.est||r.e),a:"right",m:1,cl:r=>(r.est||r.e)<=0?C.r:(r.est||r.e)<10?C.a:C.tx},
        {l:"Venda",r:r=>(r.vd||0)>0?fR(r.vd):"—",a:"right",m:1},
        {l:"Forn",r:r=>(r.forn||r.f||"").substring(0,18),cl:()=>C.tx3}
      ]} data={filt} max={300} onClick={r=>openD?.(r,"produto")}/>
    </div>
  );
}

// ════════════ COMPRAS ════════════
function CompPage(){
  const k=DATA.kpis||{};
  return(
    <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
        <Kpi label="Total Compras" value={fR(k.totalCompra||0)} icon="🛒"/>
        <Kpi label="Notas Entrada" value={fmt(k.totalEntradas||0)}/>
        <Kpi label="RCV" value={fP(k.rcv||0)} accent={(k.rcv||0)>85?"r":"g"}/>
        <Kpi label="Fornecedores" value={fmt(k.totalFornecedores||0)}/>
      </div>
      {DATA.pedidos.length>0&&<div>
        <div style={{fontSize:10,fontWeight:700,color:C.tx3,marginBottom:8,textTransform:"uppercase"}}>Pedidos de Compra</div>
        <Tbl cols={[
          {l:"ID",r:r=>r.id,m:1},{l:"Fornecedor",r:r=>r.forn?.substring(0,30),b:1},
          {l:"Valor",r:r=>fR(r.valor),a:"right",m:1},{l:"Data",r:r=>r.data?.substring(0,10),m:1},
          {l:"Status",r:r=>r.status||"—",cl:()=>C.tx2}
        ]} data={DATA.pedidos} max={100}/>
      </div>}
    </div>
  );
}

// ════════════ FORNECEDORES ════════════
function FornPage({openD}){
  const [q,setQ]=useState("");
  const filt=useMemo(()=>{let l=[...DATA.fornecedores];if(q){const s=q.toLowerCase();l=l.filter(f=>(f.n||"").toLowerCase().includes(s));}return l;},[q]);
  return(
    <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:8,alignItems:"center"}}><Search value={q} onChange={setQ} ph="Buscar fornecedor..."/><span style={{fontSize:9,color:C.tx3}}>{filt.length} fornecedores</span></div>
      <Tbl cols={[
        {l:"Fornecedor",r:r=>r.n,b:1},{l:"CNPJ",r:r=>r.cn||"—",m:1,cl:()=>C.tx3},
        {l:"Vol. Compras",r:r=>r.cp>0?fR(r.cp):"—",a:"right",m:1},
        {l:"Notas",r:r=>r.cnt||"—",a:"right",m:1},
        {l:"Produtos",r:r=>r.pr||"—",a:"right",m:1},
        {l:"Lead Time",r:r=>r.dias?r.dias+"d":"—",a:"right",m:1},
        {l:"Últ.Compra",r:r=>r.uc||"—",a:"right",m:1,cl:()=>C.tx2}
      ]} data={filt} max={300} onClick={r=>openD?.(r,"fornecedor")}/>
    </div>
  );
}

// ════════════ FINANCEIRO ════════════
function FinPage(){
  const k=DATA.kpis||{};const [tab,setTab]=useState("resumo");
  return(
    <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
        <Kpi icon="💵" label="Contas Receber" value={fR(k.contasReceber||0)} accent="g" sub={k.contasReceberVencido?`Vencido: ${fR(k.contasReceberVencido)}`:null}/>
        <Kpi icon="💳" label="Contas Pagar" value={fR(k.contasPagar||0)} accent="r" sub={k.contasPagarVencido?`Vencido: ${fR(k.contasPagarVencido)}`:null}/>
        <Kpi icon="📊" label="Saldo" value={fR(k.saldo||0)} accent={(k.saldo||0)>=0?"g":"r"}/>
        <Kpi icon="📉" label="Despesas" value={fR(k.despesas||0)}/>
      </div>
      <div style={{display:"flex",gap:1,background:C.bg2,borderRadius:5,padding:2,alignSelf:"flex-start"}}>
        {[["resumo","Resumo"],["receber","A Receber"],["pagar","A Pagar"],["despesas","Despesas"]].map(([k,l])=>
          <button key={k} onClick={()=>setTab(k)} style={{padding:"5px 14px",borderRadius:4,border:"none",cursor:"pointer",background:tab===k?C.bg3:"transparent",color:tab===k?C.tx:C.tx3,fontSize:11,fontWeight:600,fontFamily:F}}>{l}</button>
        )}
      </div>
      {tab==="receber"&&DATA.contasReceber.length>0&&<Tbl cols={[
        {l:"Cliente",r:r=>r.cliente?.substring(0,30)||"—",b:1},
        {l:"Valor",r:r=>fR(r.valor),a:"right",m:1},
        {l:"Vencimento",r:r=>r.venc?.substring(0,10)||"—",m:1,cl:r=>r.venc&&r.venc<new Date().toISOString().substring(0,10)?C.r:C.tx},
        {l:"Doc",r:r=>r.doc||"—",m:1},{l:"Status",r:r=>r.status||"—"}
      ]} data={DATA.contasReceber} max={200}/>}
      {tab==="pagar"&&DATA.contasPagar.length>0&&<Tbl cols={[
        {l:"Fornecedor",r:r=>r.forn?.substring(0,30)||"—",b:1},
        {l:"Valor",r:r=>fR(r.valor),a:"right",m:1},
        {l:"Vencimento",r:r=>r.venc?.substring(0,10)||"—",m:1,cl:r=>r.venc&&r.venc<new Date().toISOString().substring(0,10)?C.r:C.tx},
        {l:"Doc",r:r=>r.doc||"—",m:1},{l:"Status",r:r=>r.status||"—"}
      ]} data={DATA.contasPagar} max={200}/>}
      {tab==="despesas"&&DATA.despesas.length>0&&<Tbl cols={[
        {l:"Descrição",r:r=>r.desc?.substring(0,40)||"—",b:1},
        {l:"Valor",r:r=>fR(r.valor),a:"right",m:1},
        {l:"Data",r:r=>r.data?.substring(0,10)||"—",m:1}
      ]} data={DATA.despesas} max={200}/>}
      {tab==="resumo"&&<div style={{color:C.tx3,fontSize:12,padding:20,textAlign:"center"}}>
        {(k.contasReceber||0)>0||DATA.contasReceber.length>0?"Selecione uma aba para ver detalhes":"Dados financeiros serão carregados após sincronização"}
      </div>}
    </div>
  );
}

// ════════════ OFERTAS ════════════
function OferPage(){
  const ofertas=DATA.extras?.ofertas||[];
  return(
    <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:14}}>
      <Kpi label="Ofertas Ativas" value={fmt(DATA.kpis?.ofertasAtivas||0)} accent="cy"/>
      {ofertas.length>0?<Tbl cols={[
        {l:"ID",r:r=>r.id,m:1},{l:"Descrição",r:r=>(r.descricao||r.nome||"Oferta").substring(0,40),b:1},
        {l:"Início",r:r=>(r.dataInicial||r.dataInicio||"").substring(0,10),m:1},
        {l:"Fim",r:r=>(r.dataFinal||r.dataFim||"").substring(0,10),m:1}
      ]} data={ofertas} max={100}/>:
      <div style={{padding:"40px",textAlign:"center",color:C.tx3,fontSize:12}}>Dados de ofertas disponíveis após sincronização</div>}
    </div>
  );
}

// ════════════ CONFIG ════════════
function CfgPage({apiState,setApiState,doSync,syncLog}){
  const conn=apiState.connected,sync=apiState.syncing;
  return(
    <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:14,maxWidth:700}}>
      <Card3D style={{padding:20}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:conn?C.g:sync?C.a:C.r}}/>
          <span style={{fontSize:12,fontWeight:600,color:conn?C.g:C.tx2}}>{conn?"Conectado":sync?"Sincronizando...":"Desconectado"}</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div><label style={{fontSize:9,color:C.tx3,fontWeight:700,display:"block",marginBottom:3}}>URL BASE</label>
          <input value={apiState.url} onChange={e=>setApiState(p=>({...p,url:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.bg3,color:C.accL,fontSize:11,fontFamily:M,outline:"none",boxSizing:"border-box"}}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><label style={{fontSize:9,color:C.tx3,fontWeight:700,display:"block",marginBottom:3}}>USUÁRIO</label>
            <input value={apiState.user||""} onChange={e=>setApiState(p=>({...p,user:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.bg3,color:C.tx,fontSize:11,outline:"none",boxSizing:"border-box"}}/></div>
            <div><label style={{fontSize:9,color:C.tx3,fontWeight:700,display:"block",marginBottom:3}}>SENHA</label>
            <input value={apiState.pass||""} onChange={e=>setApiState(p=>({...p,pass:e.target.value}))} type="password" style={{width:"100%",padding:"8px 12px",borderRadius:5,border:`1px solid ${C.brd}`,background:C.bg3,color:C.tx,fontSize:11,outline:"none",boxSizing:"border-box"}}/></div>
          </div>
          {apiState.token&&<div><label style={{fontSize:9,color:C.tx3,fontWeight:700,display:"block",marginBottom:3}}>TOKEN</label>
          <div style={{padding:"6px 10px",borderRadius:5,fontFamily:M,fontSize:8,wordBreak:"break-all",background:conn?C.gD:C.bg3,color:conn?C.g:C.tx3,border:`1px solid ${conn?C.gB:C.brd}`}}>{apiState.token.substring(0,80)}...</div></div>}
          {apiState.error&&<div style={{padding:"8px 10px",borderRadius:5,background:C.rD,border:`1px solid ${C.rB}`}}><span style={{fontSize:11,color:C.r,fontWeight:600}}>{apiState.error}</span></div>}
          <button onClick={doSync} disabled={sync||!apiState.user||!apiState.pass} style={{padding:"10px 24px",borderRadius:6,border:"none",cursor:sync?"wait":"pointer",background:sync?C.bg3:C.acc,color:sync?C.tx3:C.w,fontWeight:700,fontSize:13,fontFamily:F,opacity:(!apiState.user||!apiState.pass)?.4:1}}>{sync?"Sincronizando...":conn?"Re-sincronizar":"Conectar"}</button>
        </div>
      </Card3D>
      {syncLog.length>0&&<Card3D style={{padding:14,maxHeight:300,overflowY:"auto"}}>
        <div style={{fontSize:9,fontWeight:700,color:C.tx3,marginBottom:6,textTransform:"uppercase"}}>Log</div>
        {syncLog.slice(-40).map((l,i)=><div key={i} style={{fontSize:9,fontFamily:M,padding:"2px 0",color:l.s==="ok"?C.g:l.s==="error"?C.r:C.tx3}}><span style={{color:C.tx3,marginRight:4}}>{l.t}</span>{l.m}</div>)}
      </Card3D>}
      {apiState.stats&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <Kpi small label="OK" value={apiState.stats.success} accent="g"/>
        <Kpi small label="Falhou" value={apiState.stats.failed} accent={apiState.stats.failed>0?"r":undefined}/>
        <Kpi small label="Total" value={apiState.stats.total}/>
      </div>}
    </div>
  );
}

// ════════════ DETAIL ════════════
function Detail({item,type,onClose}){
  if(!item)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",justifyContent:"flex-end"}} onClick={onClose}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.65)",backdropFilter:"blur(4px)"}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:"relative",width:400,maxWidth:"90vw",height:"100vh",background:C.bg1,borderLeft:`1px solid ${C.brd}`,overflowY:"auto",padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
          <div><div style={{fontSize:9,color:C.tx3,fontWeight:700,textTransform:"uppercase",marginBottom:3}}>{type}</div>
          <div style={{fontSize:15,fontWeight:700,color:C.tx}}>{item.nome||item.n}</div>
          {type==="produto"&&<div style={{fontSize:10,color:C.tx3,marginTop:2}}>{item.grupo||item.g} · {item.forn||item.f||"—"}</div>}</div>
          <button onClick={onClose} style={{background:C.bg3,border:`1px solid ${C.brd}`,color:C.tx2,width:26,height:26,borderRadius:5,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        {type==="produto"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Kpi small label="Preço" value={fR(item.pr||item.preco)}/>
          <Kpi small label="Custo" value={fR(item.custo||item.cu)}/>
          <Kpi small label="Margem" value={fP(item.mg)} accent={item.mg<0?"r":"g"}/>
          <Kpi small label="Estoque" value={fmt(item.est||item.e)} accent={(item.est||item.e)<=0?"r":undefined}/>
          <Kpi small label="Venda" value={(item.vd||0)>0?fR(item.vd):"—"}/>
          <Kpi small label="Curva" value={item.curva||item.c}/>
        </div>}
        {type==="fornecedor"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Kpi small label="Compras" value={fR(item.cp)}/>
          <Kpi small label="Produtos" value={item.pr||"—"}/>
          <Kpi small label="CNPJ" value={item.cn||item.cnpj||"—"}/>
          <Kpi small label="Últ.Compra" value={item.uc||"—"}/>
        </div>}
      </div>
    </div>
  );
}

// ════════════ MAIN ════════════
const pages={dash:DashPage,prod:ProdPage,comp:CompPage,forn:FornPage,fin:FinPage,ofer:OferPage};
export default function App(){
  const [pg,setPg]=useState("dash");
  const [det,setDet]=useState(null);const [detT,setDetT]=useState(null);
  const [realData,setRealData]=useState(null);
  const [syncLog,setSyncLog]=useState([]);
  const [dateRange,setDateRange]=useState(()=>{
    const now=new Date(),p=n=>String(n).padStart(2,"0"),f=d=>`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
    const d30=new Date(now);d30.setDate(d30.getDate()-30);
    return{start:f(d30),end:f(now)};
  });
  const [apiState,setApiState]=useState({
    url:"http://177.73.209.174:8059/integracao/sgsistemas/v1",
    connected:false,syncing:false,syncProgress:{},
    user:"",pass:"",token:"",error:null,syncedAt:null,stats:null,
  });

  const log=(m,s="info")=>setSyncLog(p=>[...p,{t:new Date().toLocaleTimeString(),m,s}]);

  const doSyncWithConfig=useCallback(async(cfg,di,df)=>{
    const{url,user,pass,token:savedToken}=cfg;
    setApiState(p=>({...p,syncing:true,connected:false,error:null}));
    log("Iniciando...");
    let token=savedToken;
    if(!token&&user&&pass){
      log("Autenticando...");
      try{const auth=await authenticate(url,user,pass);
        if(!auth.success){setApiState(p=>({...p,syncing:false,error:auth.error}));log("FALHA: "+auth.error,"error");return;}
        token=auth.token;log("Token obtido!","ok");
      }catch(e){setApiState(p=>({...p,syncing:false,error:e.message}));log("ERRO: "+e.message,"error");return;}
    }
    if(!token){setApiState(p=>({...p,syncing:false,error:"Sem token"}));return;}
    setApiState(p=>({...p,token}));
    log(`Sincronizando ${di||dateRange.start} a ${df||dateRange.end}...`);
    try{const sync=await syncAll(url,token,"1",di||dateRange.start,df||dateRange.end);
      if(!sync.success){setApiState(p=>({...p,syncing:false,error:sync.error}));log("FALHA: "+sync.error,"error");return;}
      log(`OK: ${sync.stats?.success||0}/${sync.stats?.total||0} endpoints em ${sync.elapsed||"?"}ms`,"ok");
      if(sync.report)Object.entries(sync.report).forEach(([k,v])=>{log(`  ${k}: ${v.success?v.count+" reg":"FALHOU"+(v.error?" — "+v.error:"")}`,v.success?"ok":"error");});
      const d=sync.dashboard;
      if(d){
        const mp=(d.produtos||[]).map(p=>({id:p.id,nome:p.n,grupo:p.g,curva:p.c,custo:p.cu,pr:p.pr,preco:p.pr,mg:p.mg,est:p.e,forn:p.f,unidade:p.u,vd:p.vd||0,qtd:p.qt||0,lucro:p.lu||0,marca:p.marca||""}));
        const mf=(d.fornecedores||[]).map(f=>({id:f.id,n:f.n,cp:f.cp,cnt:f.cnt,uc:f.uc,pr:f.pr,cn:f.cn||"",dias:f.dias||0}));
        setRealData({produtos:mp,setores:d.setores||[],fornecedores:mf,vd:d.vendasDiarias||[],kpis:d.kpis||{},
          contasReceber:d.contasReceber||[],contasPagar:d.contasPagar||[],despesas:d.despesas||[],pedidos:d.pedidosCompra||[],extras:d.extras||{}});
      }
      setApiState(p=>({...p,url,user:cfg.user||p.user,pass:cfg.pass||p.pass,token,connected:true,syncing:false,error:null,syncedAt:sync.syncedAt,stats:sync.stats}));
      saveConfig({url,user:cfg.user||apiState.user,pass:cfg.pass||apiState.pass,token});
    }catch(e){setApiState(p=>({...p,syncing:false,error:e.message}));log("ERRO: "+e.message,"error");}
  },[apiState.user,apiState.pass,dateRange]);

  const doSync=useCallback(()=>doSyncWithConfig(apiState),[apiState,doSyncWithConfig]);
  const doSyncRange=useCallback((s,e)=>{setDateRange({start:s,end:e});if(apiState.connected||apiState.token)doSyncWithConfig(apiState,s,e);},[apiState,doSyncWithConfig]);

  useEffect(()=>{const saved=loadConfig();if(saved?.token&&saved?.url){setApiState(p=>({...p,...saved}));setTimeout(()=>doSyncWithConfig(saved),300);}},[]);

  const openD=(item,type)=>{setDet(item);setDetT(type);};

  if(realData){DATA={...DATA,...realData};}

  const Page=pages[pg]||DashPage;
  return(
    <div style={{display:"flex",height:"100vh",background:C.bg,color:C.tx,fontFamily:F,overflow:"hidden"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');*{margin:0;padding:0;box-sizing:border-box}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${C.brd};border-radius:2px}input::placeholder{color:${C.tx3}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      <Side a={pg} set={setPg} conn={apiState.connected} sync={apiState.syncing}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Header */}
        <div style={{padding:"10px 24px",borderBottom:`1px solid ${C.brd}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <h1 style={{fontSize:15,fontWeight:700,color:C.tx,margin:0}}>
            {{dash:"Painel",prod:"Produtos",comp:"Compras",forn:"Fornecedores",fin:"Financeiro",ofer:"Ofertas",cfg:"Configurações"}[pg]||"Painel"}
          </h1>
          {pg!=="cfg"&&<DatePicker start={dateRange.start} end={dateRange.end} onChange={(s,e)=>doSyncRange(s,e)}/>}
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {apiState.connected&&<button onClick={doSync} style={{padding:"4px 12px",borderRadius:4,border:`1px solid ${C.brd}`,background:"transparent",color:C.tx2,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F}}>Atualizar</button>}
            {apiState.syncing&&<span style={{fontSize:10,color:C.a,fontWeight:600}}>Sincronizando...</span>}
          </div>
        </div>
        {/* Content */}
        <div style={{flex:1,overflowY:"auto"}}>
          {pg==="cfg"?<CfgPage apiState={apiState} setApiState={setApiState} doSync={doSync} syncLog={syncLog}/>:<Page openD={openD}/>}
        </div>
      </div>
      {det&&<Detail item={det} type={detT} onClose={()=>setDet(null)}/>}
    </div>
  );
}

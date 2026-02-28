"use client";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { authenticate, syncAll, saveConfig, loadConfig, clearConfig } from "../lib/api-client";

/* ═══════════════════════════════════════════════════════════
   MarketSUP v5 — Clean Retail Intelligence
   Aesthetic: Utilitarian dark, sharp type, no gimmicks
   Fonts: DM Sans + JetBrains Mono
   ═══════════════════════════════════════════════════════════ */

// ── THEME ──
const C = {
  bg: "#0a0a0f", bg1: "#101018", bg2: "#16161f", bg3: "#1c1c28",
  brd: "#252535", brd2: "#2e2e42",
  acc: "#3b82f6", accHov: "#60a5fa", accDim: "rgba(59,130,246,.08)",
  grn: "#10b981", grnDim: "rgba(16,185,129,.08)", grnBrd: "rgba(16,185,129,.2)",
  red: "#ef4444", redDim: "rgba(239,68,68,.08)", redBrd: "rgba(239,68,68,.2)",
  amb: "#f59e0b", ambDim: "rgba(245,158,11,.08)",
  tx: "#e4e4eb", tx2: "#9898a8", tx3: "#5e5e72",
  wh: "#ffffff",
};
const FONT = "'DM Sans',system-ui,sans-serif";
const MONO = "'JetBrains Mono','SF Mono',monospace";

// ── DEMO DATA ──
let PRODUTOS = [];
let SETORES = [];
let FORN = [];
let VD7 = [];
let KPIS = null;

// ── FORMAT HELPERS ──
const fmt = (n) => {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  return typeof n === "number" ? n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : String(n);
};
const fR = (n) => "R$ " + fmt(n);
const fPct = (n) => (n == null ? "—" : n.toFixed(1).replace(".", ",") + "%");

// ── COMPONENTS ──

function Metric({ label, value, sub, accent, small }) {
  const clr = accent === "red" ? C.red : accent === "green" ? C.grn : accent === "amber" ? C.amb : C.tx;
  return (
    <div style={{ padding: small ? "10px 12px" : "14px 16px", background: C.bg2, border: `1px solid ${C.brd}`, borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: C.tx3, fontWeight: 600, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: small ? 18 : 24, fontWeight: 700, fontFamily: MONO, color: clr, letterSpacing: "-.5px", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.tx3, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function DataTable({ columns, data, onRowClick, maxRows = 50 }) {
  const visible = useMemo(() => data.slice(0, maxRows), [data, maxRows]);
  return (
    <div style={{ overflow: "auto", borderRadius: 8, border: `1px solid ${C.brd}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: FONT }}>
        <thead>
          <tr style={{ background: C.bg2 }}>
            {columns.map((col, i) => (
              <th key={i} style={{
                padding: "8px 12px", textAlign: col.align || "left", fontWeight: 600,
                color: C.tx3, fontSize: 10, letterSpacing: ".3px", textTransform: "uppercase",
                borderBottom: `1px solid ${C.brd}`, position: "sticky", top: 0, background: C.bg2,
                whiteSpace: "nowrap",
              }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, ri) => (
            <tr key={ri}
              onClick={() => onRowClick?.(row)}
              style={{ cursor: onRowClick ? "pointer" : "default", borderBottom: `1px solid ${C.brd}` }}
              onMouseEnter={e => e.currentTarget.style.background = C.bg3}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {columns.map((col, ci) => (
                <td key={ci} style={{
                  padding: "7px 12px", textAlign: col.align || "left",
                  color: typeof col.color === "function" ? col.color(row) : (col.color || C.tx),
                  fontFamily: col.mono ? MONO : FONT, fontWeight: col.bold ? 600 : 400,
                  fontSize: 12, whiteSpace: "nowrap",
                }}>{typeof col.render === "function" ? col.render(row) : (col.key ? row[col.key] : "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > maxRows && (
        <div style={{ padding: "8px 12px", fontSize: 10, color: C.tx3, textAlign: "center", borderTop: `1px solid ${C.brd}`, background: C.bg2 }}>
          Mostrando {maxRows} de {data.length}
        </div>
      )}
    </div>
  );
}

function MiniBar({ data, height = 80 }) {
  const mx = Math.max(...data.map(d => d.v), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height, padding: "0 2px" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{
            width: "100%", borderRadius: "3px 3px 0 0",
            height: `${Math.max((d.v / mx) * 100, 2)}%`,
            background: C.acc, opacity: 0.7,
          }} />
          <span style={{ fontSize: 8, color: C.tx3, fontFamily: MONO }}>{d.d}</span>
        </div>
      ))}
    </div>
  );
}

function Badge({ text, variant = "default" }) {
  const styles = {
    A: { bg: "rgba(16,185,129,.12)", color: C.grn, border: C.grnBrd },
    B: { bg: C.accDim, color: C.acc, border: "rgba(59,130,246,.2)" },
    C: { bg: C.ambDim, color: C.amb, border: "rgba(245,158,11,.2)" },
    D: { bg: "rgba(100,100,120,.1)", color: C.tx3, border: "rgba(100,100,120,.2)" },
    green: { bg: C.grnDim, color: C.grn, border: C.grnBrd },
    red: { bg: C.redDim, color: C.red, border: C.redBrd },
    default: { bg: "rgba(100,100,120,.1)", color: C.tx3, border: "rgba(100,100,120,.2)" },
  };
  const s = styles[text] || styles[variant] || styles.default;
  return (
    <span style={{
      display: "inline-block", padding: "2px 7px", borderRadius: 4,
      fontSize: 10, fontWeight: 700, fontFamily: MONO,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>{text}</span>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || "Buscar..."}
      style={{
        padding: "7px 12px", borderRadius: 6, border: `1px solid ${C.brd}`,
        background: C.bg2, color: C.tx, fontSize: 12, fontFamily: FONT,
        outline: "none", width: 220, boxSizing: "border-box",
      }}
    />
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 1, background: C.bg2, borderRadius: 6, padding: 2 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: "5px 14px", borderRadius: 5, border: "none", cursor: "pointer",
          background: active === t.id ? C.bg3 : "transparent",
          color: active === t.id ? C.tx : C.tx3,
          fontSize: 11, fontWeight: 600, fontFamily: FONT,
        }}>{t.label}</button>
      ))}
    </div>
  );
}

// ── SIDEBAR ──
const NAV = [
  { id: "dash", lb: "Painel" },
  { id: "prod", lb: "Produtos" },
  { id: "forn", lb: "Fornecedores" },
  { id: "fin", lb: "Financeiro" },
  { id: "cfg", lb: "Configurar" },
];

function Side({ active, set, connected, syncing }) {
  return (
    <nav style={{
      width: 180, background: C.bg, borderRight: `1px solid ${C.brd}`,
      display: "flex", flexDirection: "column", flexShrink: 0,
      padding: "16px 0",
    }}>
      {/* Brand */}
      <div style={{ padding: "0 16px 20px", borderBottom: `1px solid ${C.brd}` }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.tx, fontFamily: FONT, letterSpacing: "-.3px" }}>
          MarketSUP
        </div>
        <div style={{ fontSize: 10, color: C.tx3, marginTop: 2 }}>Retail Intelligence</div>
      </div>

      {/* Status */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.brd}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: connected ? C.grn : syncing ? C.amb : C.red,
            ...(syncing ? { animation: "pulse 1s infinite" } : {}),
          }} />
          <span style={{ fontSize: 10, color: connected ? C.grn : syncing ? C.amb : C.tx3, fontWeight: 600 }}>
            {connected ? "Conectado" : syncing ? "Sincronizando..." : "Desconectado"}
          </span>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, padding: "8px 8px", display: "flex", flexDirection: "column", gap: 1 }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => set(n.id)} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "9px 12px", borderRadius: 6, border: "none", cursor: "pointer",
            background: active === n.id ? C.accDim : "transparent",
            color: active === n.id ? C.acc : C.tx2,
            fontSize: 12, fontWeight: active === n.id ? 600 : 500,
            fontFamily: FONT, textAlign: "left", width: "100%",
            borderLeft: active === n.id ? `2px solid ${C.acc}` : "2px solid transparent",
          }}>
            {n.lb}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.brd}`, fontSize: 9, color: C.tx3 }}>
        v5.0 · SG Sistemas
      </div>
    </nav>
  );
}

// ── DASH PAGE ──
function DashPage() {
  const kpis = KPIS || {};
  const setores = SETORES;
  const prods = PRODUTOS;
  const hasSales = (kpis.receitaBruta || 0) > 0 || (kpis.vendasHoje || 0) > 0;

  const topSellers = useMemo(() => [...prods].sort((a, b) => (b.vd || 0) - (a.vd || 0)).slice(0, 10), [prods]);
  const negMargin = useMemo(() => prods.filter(p => p.mg < 0 && p.pr > 0).sort((a, b) => a.mg - b.mg).slice(0, 10), [prods]);
  const lowStock = useMemo(() => prods.filter(p => p.est <= 0 && p.curva !== "D" && p.pr > 0).length, [prods]);

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <Metric label="Receita Bruta" value={fR(kpis.receitaBruta || kpis.vendasHoje || 0)}
          sub={kpis.cupons ? `${fmt(kpis.cupons)} cupons` : kpis.vendasHojeCupons ? `${kpis.vendasHojeCupons} cupons hoje` : null}
          accent={hasSales ? "green" : undefined} />
        <Metric label="Total Compras" value={fR(kpis.totalCompra || 0)}
          sub={kpis.rcv ? `RCV: ${fPct(kpis.rcv)}` : null} />
        <Metric label="Lucro Bruto" value={fR(kpis.lucroBruto || 0)}
          accent={(kpis.lucroBruto || 0) > 0 ? "green" : "red"} />
        <Metric label="Margem Média" value={fPct(kpis.margemMedia || 0)}
          accent={(kpis.margemMedia || 0) >= 20 ? "green" : (kpis.margemMedia || 0) >= 10 ? "amber" : "red"} />
        <Metric label="Produtos Ativos" value={fmt(kpis.totalProdutos || prods.length)} />
        <Metric label="Fornecedores" value={fmt(kpis.totalFornecedores || FORN.length)} />
      </div>

      {/* Second row: alerts + chart */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Alerts */}
        <div style={{ background: C.bg2, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.tx2, marginBottom: 12, textTransform: "uppercase", letterSpacing: ".5px" }}>Alertas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(kpis.ruptura || lowStock) > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: C.redDim, borderRadius: 6, border: `1px solid ${C.redBrd}` }}>
                <span style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>Ruptura: {kpis.ruptura || lowStock} itens sem estoque (curva A/B/C)</span>
              </div>
            )}
            {(kpis.mgNegativa || negMargin.length) > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: C.ambDim, borderRadius: 6, border: `1px solid rgba(245,158,11,.2)` }}>
                <span style={{ fontSize: 11, color: C.amb, fontWeight: 600 }}>Margem negativa: {kpis.mgNegativa || negMargin.length} produtos vendendo abaixo do custo</span>
              </div>
            )}
            {(kpis.estBaixo || 0) > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: C.accDim, borderRadius: 6, border: `1px solid rgba(59,130,246,.2)` }}>
                <span style={{ fontSize: 11, color: C.acc, fontWeight: 600 }}>Estoque baixo: {kpis.estBaixo} itens com menos de 10 unidades</span>
              </div>
            )}
            {kpis.vendasHoje > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: C.grnDim, borderRadius: 6, border: `1px solid ${C.grnBrd}` }}>
                <span style={{ fontSize: 11, color: C.grn, fontWeight: 600 }}>Hoje: {fR(kpis.vendasHoje)} em {kpis.vendasHojeCupons} vendas</span>
              </div>
            )}
            {!hasSales && kpis.totalProdutos > 0 && (
              <div style={{ padding: "8px 10px", background: C.accDim, borderRadius: 6, border: `1px solid rgba(59,130,246,.2)` }}>
                <span style={{ fontSize: 11, color: C.acc, fontWeight: 600 }}>Dados de catálogo carregados. Vendas serão exibidas após sincronização com mais endpoints.</span>
              </div>
            )}
          </div>
        </div>

        {/* Chart */}
        <div style={{ background: C.bg2, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.tx2, marginBottom: 12, textTransform: "uppercase", letterSpacing: ".5px" }}>Vendas Diárias</div>
          {VD7.length > 0 ? <MiniBar data={VD7} height={100} /> : (
            <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", color: C.tx3, fontSize: 11 }}>
              Dados diários indisponíveis
            </div>
          )}
        </div>
      </div>

      {/* Setores */}
      {setores.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.tx2, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".5px" }}>Setores</div>
          <DataTable
            columns={[
              { label: "Setor", key: "n", bold: true },
              { label: "Venda", render: r => fR(r.vd), align: "right", mono: true },
              { label: "Compra", render: r => fR(r.cp), align: "right", mono: true },
              { label: "Margem", render: r => fPct(r.mg), align: "right", mono: true, color: r => r.mg >= 20 ? C.grn : r.mg >= 10 ? C.amb : C.red },
              { label: "RCV", render: r => fPct(r.rcv), align: "right", mono: true, color: r => r.rcv > 85 ? C.red : r.rcv > 75 ? C.amb : C.grn },
              { label: "Part %", render: r => fPct(r.pt), align: "right", mono: true },
              { label: "SKUs", render: r => fmt(r.sk), align: "right", mono: true },
            ]}
            data={setores}
            maxRows={30}
          />
        </div>
      )}

      {/* Two columns: Top sellers + Negative margin */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {topSellers.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.tx2, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".5px" }}>Top Vendas</div>
            <DataTable
              columns={[
                { label: "Produto", render: r => r.nome?.substring(0, 35) || "—", bold: true },
                { label: "Curva", render: r => <Badge text={r.curva} />, align: "center" },
                { label: "Venda", render: r => fR(r.vd), align: "right", mono: true },
              ]}
              data={topSellers}
            />
          </div>
        )}
        {negMargin.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.tx2, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".5px" }}>Margem Negativa</div>
            <DataTable
              columns={[
                { label: "Produto", render: r => r.nome?.substring(0, 35) || "—", bold: true },
                { label: "Margem", render: r => fPct(r.mg), align: "right", mono: true, color: () => C.red },
                { label: "Preço", render: r => fR(r.pr), align: "right", mono: true },
                { label: "Custo", render: r => fR(r.custo), align: "right", mono: true },
              ]}
              data={negMargin}
            />
          </div>
        )}
      </div>

      {/* Empty state */}
      {prods.length === 0 && (
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 14, color: C.tx3, marginBottom: 8 }}>Nenhum dado carregado</div>
          <div style={{ fontSize: 12, color: C.tx3 }}>Conecte a API em Configurar para ver os dados reais</div>
        </div>
      )}
    </div>
  );
}

// ── PRODUTOS PAGE ──
function ProdPage({ openDetail }) {
  const [search, setSearch] = useState("");
  const [curvaFilter, setCurvaFilter] = useState("all");
  const [sortBy, setSortBy] = useState("vd");

  const filtered = useMemo(() => {
    let list = [...PRODUTOS];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => (p.nome || "").toLowerCase().includes(q) || (p.grupo || "").toLowerCase().includes(q) || (p.forn || "").toLowerCase().includes(q));
    }
    if (curvaFilter !== "all") list = list.filter(p => p.curva === curvaFilter);
    list.sort((a, b) => {
      if (sortBy === "vd") return (b.vd || 0) - (a.vd || 0);
      if (sortBy === "mg") return (b.mg || 0) - (a.mg || 0);
      if (sortBy === "est") return (a.est || 0) - (b.est || 0);
      if (sortBy === "nome") return (a.nome || "").localeCompare(b.nome || "");
      return 0;
    });
    return list;
  }, [search, curvaFilter, sortBy]);

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar produto, grupo, fornecedor..." />
        <Tabs tabs={[
          { id: "all", label: `Todos (${PRODUTOS.length})` },
          { id: "A", label: "Curva A" }, { id: "B", label: "B" }, { id: "C", label: "C" }, { id: "D", label: "D" },
        ]} active={curvaFilter} onChange={setCurvaFilter} />
        <div style={{ flex: 1 }} />
        <Tabs tabs={[
          { id: "vd", label: "Venda" }, { id: "mg", label: "Margem" },
          { id: "est", label: "Estoque" }, { id: "nome", label: "A-Z" },
        ]} active={sortBy} onChange={setSortBy} />
      </div>

      <div style={{ fontSize: 10, color: C.tx3 }}>{filtered.length} produtos</div>

      <DataTable
        columns={[
          { label: "Produto", render: r => r.nome?.substring(0, 40) || "—", bold: true },
          { label: "Grupo", render: r => (r.grupo || "—").substring(0, 20), color: () => C.tx2 },
          { label: "Curva", render: r => <Badge text={r.curva} />, align: "center" },
          { label: "Custo", render: r => fR(r.custo), align: "right", mono: true },
          { label: "Preço", render: r => fR(r.pr), align: "right", mono: true },
          { label: "Margem", render: r => fPct(r.mg), align: "right", mono: true, color: r => r.mg < 0 ? C.red : r.mg < 15 ? C.amb : C.grn },
          { label: "Estoque", render: r => fmt(r.est), align: "right", mono: true, color: r => r.est <= 0 ? C.red : r.est < 10 ? C.amb : C.tx },
          { label: "Venda", render: r => r.vd > 0 ? fR(r.vd) : "—", align: "right", mono: true },
          { label: "Fornecedor", render: r => (r.forn || "—").substring(0, 20), color: () => C.tx3 },
        ]}
        data={filtered}
        maxRows={200}
        onRowClick={(row) => openDetail?.(row, "produto")}
      />
    </div>
  );
}

// ── FORNECEDORES PAGE ──
function FornPage({ openDetail }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = [...FORN];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(f => (f.n || "").toLowerCase().includes(q));
    }
    return list;
  }, [search]);

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar fornecedor..." />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: C.tx3 }}>{filtered.length} fornecedores</span>
      </div>
      <DataTable
        columns={[
          { label: "Fornecedor", key: "n", bold: true },
          { label: "CNPJ", render: r => r.cnpj || r.cn || "—", color: () => C.tx3, mono: true },
          { label: "Vol. Compras", render: r => r.cp > 0 ? fR(r.cp) : "—", align: "right", mono: true },
          { label: "Produtos", render: r => r.pr || "—", align: "right", mono: true },
          { label: "Últ. Compra", render: r => r.uc || "—", align: "right", mono: true, color: () => C.tx2 },
        ]}
        data={filtered}
        maxRows={200}
        onRowClick={(row) => openDetail?.(row, "fornecedor")}
      />
    </div>
  );
}

// ── FINANCEIRO PAGE ──
function FinPage() {
  const kpis = KPIS || {};
  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <Metric label="Contas a Receber" value={fR(kpis.contasReceber || 0)} accent="green" />
        <Metric label="Contas a Pagar" value={fR(kpis.contasPagar || 0)} accent="red" />
        <Metric label="Saldo" value={fR(kpis.saldo || 0)} accent={(kpis.saldo || 0) >= 0 ? "green" : "red"} />
        <Metric label="Despesas (30d)" value={fR(kpis.despesas || 0)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Metric label="Ticket Médio" value={fR(kpis.ticketMedio || 0)} sub={kpis.cupons ? `${fmt(kpis.cupons)} cupons` : null} />
        <Metric label="RCV" value={fPct(kpis.rcv || 0)} accent={(kpis.rcv || 0) > 85 ? "red" : "green"} sub="Relação Compra/Venda" />
      </div>
      {(!kpis.contasReceber && !kpis.contasPagar) && (
        <div style={{ padding: "40px 20px", textAlign: "center", color: C.tx3, fontSize: 12 }}>
          Dados financeiros serão exibidos após sincronização dos endpoints de contas a receber/pagar
        </div>
      )}
    </div>
  );
}

// ── CONFIG PAGE ──
function CfgPage({ apiState, setApiState, doSync, syncLog }) {
  const url = apiState.url;
  const conn = apiState.connected;
  const sync = apiState.syncing;

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 700 }}>
      {/* Connection panel */}
      <div style={{ background: C.bg2, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: conn ? C.grn : sync ? C.amb : C.red,
          }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: conn ? C.grn : C.tx2 }}>
            {conn ? "Conectado" : sync ? "Sincronizando..." : "Desconectado"}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 10, color: C.tx3, fontWeight: 600, display: "block", marginBottom: 4 }}>URL BASE</label>
            <input value={url} onChange={e => setApiState(p => ({ ...p, url: e.target.value }))}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 6, border: `1px solid ${C.brd}`,
                background: C.bg3, color: C.acc, fontSize: 12, fontFamily: MONO, outline: "none", boxSizing: "border-box",
              }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: C.tx3, fontWeight: 600, display: "block", marginBottom: 4 }}>USUÁRIO</label>
              <input value={apiState.user || ""} onChange={e => setApiState(p => ({ ...p, user: e.target.value }))}
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 6, border: `1px solid ${C.brd}`,
                  background: C.bg3, color: C.tx, fontSize: 12, outline: "none", boxSizing: "border-box",
                }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.tx3, fontWeight: 600, display: "block", marginBottom: 4 }}>SENHA</label>
              <input value={apiState.pass || ""} onChange={e => setApiState(p => ({ ...p, pass: e.target.value }))}
                type="password"
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 6, border: `1px solid ${C.brd}`,
                  background: C.bg3, color: C.tx, fontSize: 12, outline: "none", boxSizing: "border-box",
                }} />
            </div>
          </div>

          {apiState.token && (
            <div>
              <label style={{ fontSize: 10, color: C.tx3, fontWeight: 600, display: "block", marginBottom: 4 }}>TOKEN</label>
              <div style={{
                padding: "8px 12px", borderRadius: 6, fontFamily: MONO, fontSize: 9,
                wordBreak: "break-all", background: conn ? C.grnDim : C.bg3,
                color: conn ? C.grn : C.tx3, border: `1px solid ${conn ? C.grnBrd : C.brd}`,
              }}>{apiState.token.substring(0, 80)}...</div>
            </div>
          )}

          {apiState.error && (
            <div style={{ padding: "8px 12px", borderRadius: 6, background: C.redDim, border: `1px solid ${C.redBrd}` }}>
              <span style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>{apiState.error}</span>
            </div>
          )}

          <button onClick={doSync} disabled={sync || !apiState.user || !apiState.pass}
            style={{
              padding: "10px 24px", borderRadius: 6, border: "none",
              cursor: sync ? "wait" : "pointer",
              background: sync ? C.bg3 : C.acc, color: sync ? C.tx3 : C.wh,
              fontWeight: 700, fontSize: 13, fontFamily: FONT,
              opacity: (!apiState.user || !apiState.pass) ? 0.4 : 1,
            }}>
            {sync ? "Sincronizando..." : conn ? "Re-sincronizar" : "Conectar"}
          </button>
        </div>
      </div>

      {/* Sync log */}
      {syncLog.length > 0 && (
        <div style={{ background: C.bg2, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 14, maxHeight: 300, overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, marginBottom: 8, textTransform: "uppercase" }}>Log de Sincronização</div>
          {syncLog.slice(-30).map((l, i) => (
            <div key={i} style={{
              fontSize: 10, fontFamily: MONO, padding: "3px 0",
              color: l.s === "ok" ? C.grn : l.s === "error" ? C.red : C.tx3,
              borderBottom: `1px solid ${C.brd}40`,
            }}>
              <span style={{ color: C.tx3, marginRight: 6 }}>{l.t}</span>{l.m}
            </div>
          ))}
        </div>
      )}

      {/* Sync stats */}
      {apiState.stats && (
        <div style={{ background: C.bg2, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, marginBottom: 8, textTransform: "uppercase" }}>Último Sync</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <Metric small label="Endpoints OK" value={apiState.stats.success} accent="green" />
            <Metric small label="Falhou" value={apiState.stats.failed} accent={apiState.stats.failed > 0 ? "red" : undefined} />
            <Metric small label="Total" value={apiState.stats.total} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── DETAIL PANEL ──
function DetailPanel({ item, type, onClose }) {
  if (!item) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: "relative", width: 420, maxWidth: "90vw", height: "100vh",
        background: C.bg1, borderLeft: `1px solid ${C.brd}`, overflowY: "auto", padding: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: C.tx3, fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>
              {type === "produto" ? "Produto" : type === "fornecedor" ? "Fornecedor" : "Setor"}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.tx }}>{item.nome || item.n}</div>
            {type === "produto" && (
              <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>{item.grupo} · {item.forn || "—"}</div>
            )}
          </div>
          <button onClick={onClose} style={{
            background: C.bg3, border: `1px solid ${C.brd}`, color: C.tx2,
            width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {type === "produto" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Metric small label="Preço" value={fR(item.pr || item.preco)} />
              <Metric small label="Custo" value={fR(item.custo || item.cu)} />
              <Metric small label="Margem" value={fPct(item.mg)} accent={item.mg < 0 ? "red" : "green"} />
              <Metric small label="Estoque" value={fmt(item.est || item.e)} accent={(item.est || item.e) <= 0 ? "red" : undefined} />
              <Metric small label="Venda" value={item.vd > 0 ? fR(item.vd) : "—"} />
              <Metric small label="Curva" value={item.curva || item.c} />
            </div>
            {item.mg < 0 && item.pr > 0 && (
              <div style={{ background: C.redDim, border: `1px solid ${C.redBrd}`, borderRadius: 6, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.red, marginBottom: 4 }}>Margem Negativa</div>
                <div style={{ fontSize: 11, color: C.tx2, lineHeight: 1.6 }}>
                  Preço de venda abaixo do custo. Sugestão: R$ {((item.custo || item.cu) * 1.2).toFixed(2).replace(".", ",")} (margem 20%)
                </div>
              </div>
            )}
          </div>
        )}

        {type === "fornecedor" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Metric small label="Vol. Compras" value={fR(item.cp)} />
              <Metric small label="Produtos" value={item.pr || "—"} />
            </div>
            {item.cnpj && <Metric small label="CNPJ" value={item.cnpj || item.cn} />}
            {item.uc && <Metric small label="Última Compra" value={item.uc} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN APP ──
const pages = { dash: DashPage, prod: ProdPage, forn: FornPage, fin: FinPage };

export default function App() {
  const [pg, setPg] = useState("dash");
  const [detail, setDetail] = useState(null);
  const [detailType, setDetailType] = useState(null);
  const [realData, setRealData] = useState(null);
  const [syncLog, setSyncLog] = useState([]);
  const [apiState, setApiState] = useState({
    url: "http://177.73.209.174:8059/integracao/sgsistemas/v1",
    connected: false, syncing: false, syncProgress: {},
    user: "", pass: "", token: "", error: null, syncedAt: null, stats: null,
  });

  const log = (m, s = "info") => setSyncLog(p => [...p, { t: new Date().toLocaleTimeString(), m, s }]);

  const doSyncWithConfig = useCallback(async (cfg) => {
    const { url, user, pass, token: savedToken } = cfg;
    setApiState(p => ({ ...p, syncing: true, connected: false, error: null }));
    log("Iniciando...");
    let token = savedToken;
    if (!token && user && pass) {
      log("Autenticando...");
      try {
        const auth = await authenticate(url, user, pass);
        if (!auth.success) { setApiState(p => ({ ...p, syncing: false, error: auth.error })); log("FALHA: " + auth.error, "error"); return; }
        token = auth.token; log("Token obtido!", "ok");
      } catch (e) { setApiState(p => ({ ...p, syncing: false, error: e.message })); log("ERRO: " + e.message, "error"); return; }
    }
    if (!token) { setApiState(p => ({ ...p, syncing: false, error: "Sem token" })); return; }
    setApiState(p => ({ ...p, token }));
    log("Sincronizando endpoints...");
    try {
      const sync = await syncAll(url, token);
      if (!sync.success) { setApiState(p => ({ ...p, syncing: false, error: sync.error })); log("FALHA: " + sync.error, "error"); return; }
      log(`OK: ${sync.stats?.success || 0}/${sync.stats?.total || 0} endpoints em ${sync.elapsed || "?"}ms`, "ok");
      if (sync.report) {
        Object.entries(sync.report).forEach(([k, v]) => {
          log(`  ${k}: ${v.success ? v.count + " registros" : "FALHOU" + (v.error ? " — " + v.error : "")}`, v.success ? "ok" : "error");
        });
      }
      const dashboard = sync.dashboard;
      if (dashboard) {
        const mappedProd = (dashboard.produtos || []).map(p => ({
          id: p.id, nome: p.n, grupo: p.g, curva: p.c,
          custo: p.cu, pr: p.pr, preco: p.pr, mg: p.mg, est: p.e,
          forn: p.f, unidade: p.u, vd: p.vd || 0, qtd: p.qt || 0, lucro: p.lu || 0,
        }));
        const mappedForn = (dashboard.fornecedores || []).map(f => ({
          id: f.id, n: f.n, cp: f.cp, uc: f.uc, pr: f.pr, cnpj: f.cn || "",
        }));
        setRealData({
          produtos: mappedProd,
          setores: dashboard.setores || [],
          fornecedores: mappedForn,
          vendasDiarias: dashboard.vendasDiarias,
          kpis: dashboard.kpis,
          isReal: true,
        });
        log(`Dashboard: ${mappedProd.length} prod, ${mappedForn.length} forn`, "ok");
      }
      setApiState(p => ({
        ...p, url, user: cfg.user || p.user, pass: cfg.pass || p.pass,
        token, connected: true, syncing: false, error: null,
        syncedAt: sync.syncedAt, stats: sync.stats,
      }));
      saveConfig({ url, user: cfg.user || apiState.user, pass: cfg.pass || apiState.pass, token });
    } catch (e) { setApiState(p => ({ ...p, syncing: false, error: e.message })); log("ERRO: " + e.message, "error"); }
  }, [apiState.user, apiState.pass]);

  const doSync = useCallback(() => doSyncWithConfig(apiState), [apiState, doSyncWithConfig]);

  useEffect(() => {
    const saved = loadConfig();
    if (saved?.token && saved?.url) {
      setApiState(p => ({ ...p, ...saved }));
      setTimeout(() => doSyncWithConfig(saved), 300);
    }
  }, []);

  const openDetail = (item, type) => { setDetail(item); setDetailType(type); };

  // Override data
  if (realData?.produtos?.length > 0) PRODUTOS = realData.produtos;
  if (realData?.setores?.length > 0) SETORES = realData.setores;
  if (realData?.fornecedores?.length > 0) FORN = realData.fornecedores;
  if (realData?.vendasDiarias) VD7 = realData.vendasDiarias;
  if (realData?.kpis) KPIS = realData.kpis;

  const Page = pages[pg] || DashPage;

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.tx, fontFamily: FONT, overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.brd}; border-radius: 2px; }
        input::placeholder { color: ${C.tx3}; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
      `}</style>

      <Side active={pg} set={setPg} connected={apiState.connected} syncing={apiState.syncing} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{
          padding: "10px 24px", borderBottom: `1px solid ${C.brd}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: C.tx, margin: 0 }}>
              {pg === "dash" ? "Painel" : pg === "prod" ? "Produtos" : pg === "forn" ? "Fornecedores" : pg === "fin" ? "Financeiro" : "Configurações"}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {apiState.connected && (
              <button onClick={doSync} style={{
                padding: "5px 12px", borderRadius: 5, border: `1px solid ${C.brd}`,
                background: "transparent", color: C.tx2, fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: FONT,
              }}>Atualizar</button>
            )}
            {apiState.syncedAt && (
              <span style={{ fontSize: 10, color: C.tx3, fontFamily: MONO }}>
                {new Date(apiState.syncedAt).toLocaleTimeString("pt-BR")}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {pg === "cfg" ? (
            <CfgPage apiState={apiState} setApiState={setApiState} doSync={doSync} syncLog={syncLog} />
          ) : (
            <Page openDetail={openDetail} />
          )}
        </div>
      </div>

      {detail && <DetailPanel item={detail} type={detailType} onClose={() => setDetail(null)} />}
    </div>
  );
}

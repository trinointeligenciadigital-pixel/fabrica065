import { useQuery } from "convex/react";
import {
  AlertTriangle,
  Boxes,
  CircleCheck,
  ClipboardCheck,
  Clock3,
  PackageX,
  Search,
  Snowflake,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { AdminShell } from "../components/AdminShell";
import { formatBaseQuantity, type BaseUnit } from "../lib/quantity";

interface StockPageProps {
  integrationsReady: boolean;
}

interface StockRow {
  key: string;
  camera: string;
  product: string;
  variant: string;
  baseUnit: BaseUnit;
  quantityBase: number;
  minimumBase: number | null;
  isLow: boolean;
}

type Situation = "all" | "low" | "regular" | "zero";

const demoRows: StockRow[] = [
  { key: "1", camera: "Câmara 01", product: "Saborizado", variant: "Limão", baseUnit: "pacote", quantityBase: 184, minimumBase: 120, isLow: false },
  { key: "2", camera: "Câmara 01", product: "Gelo cubo", variant: "Todas as apresentações", baseUnit: "grama", quantityBase: 192000, minimumBase: 200000, isLow: true },
  { key: "3", camera: "Câmara 02", product: "Saborizado", variant: "Maracujá", baseUnit: "pacote", quantityBase: 0, minimumBase: 80, isLow: true },
  { key: "4", camera: "Câmara 02", product: "Gelo escamado", variant: "Todas as apresentações", baseUnit: "grama", quantityBase: 340000, minimumBase: 160000, isLow: false },
];

function stockStatus(row: StockRow) {
  if (row.quantityBase === 0) return "zero" as const;
  if (row.isLow) return "low" as const;
  return "regular" as const;
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function StockContent({ rows, integrationsReady }: { rows: StockRow[]; integrationsReady: boolean }) {
  const [search, setSearch] = useState("");
  const [chamber, setChamber] = useState("all");
  const [situation, setSituation] = useState<Situation>("all");
  const chambers = useMemo(() => [...new Set(rows.map((row) => row.camera))].sort((a, b) => a.localeCompare(b, "pt-BR")), [rows]);
  const normalizedSearch = normalizeSearch(search.trim());
  const filtered = useMemo(() => rows.filter((row) => {
    const matchesChamber = chamber === "all" || row.camera === chamber;
    const status = stockStatus(row);
    const matchesSituation = situation === "all" || status === situation;
    const haystack = normalizeSearch(`${row.camera} ${row.product} ${row.variant}`);
    return matchesChamber && matchesSituation && (!normalizedSearch || haystack.includes(normalizedSearch));
  }), [chamber, normalizedSearch, rows, situation]);
  const lowCount = rows.filter((row) => row.isLow && row.quantityBase > 0).length;
  const zeroCount = rows.filter((row) => row.quantityBase === 0).length;
  const regularCount = rows.filter((row) => stockStatus(row) === "regular").length;

  return (
    <AdminShell integrationsReady={integrationsReady}>
      <section className="page-heading stock-page-heading">
        <div><p className="eyebrow">Posição atual</p><h1>Estoque</h1><p>Consulte saldos por câmara, produto e sabor sem misturar unidades incompatíveis.</p></div>
        <div className="heading-actions"><Link className="button button-secondary" to="/contagens"><ClipboardCheck size={18} /> Iniciar contagem</Link><Link className="button button-primary" to="/movimentacoes"><Clock3 size={18} /> Nova movimentação</Link></div>
      </section>

      {!integrationsReady && <div className="setup-notice" role="status"><Snowflake size={20} /><div><strong>Visualização de homologação</strong><span>Conecte Clerk e Convex para consultar os saldos reais.</span></div></div>}

      <section className="stock-summary" aria-label="Resumo do estoque">
        <button className={situation === "all" ? "is-active" : ""} onClick={() => setSituation("all")}><span className="stock-summary-icon is-total"><Boxes size={19} /></span><span><strong>{rows.length}</strong><small>linhas de estoque</small></span></button>
        <button className={situation === "regular" ? "is-active" : ""} onClick={() => setSituation("regular")}><span className="stock-summary-icon is-regular"><CircleCheck size={19} /></span><span><strong>{regularCount}</strong><small>regulares</small></span></button>
        <button className={situation === "low" ? "is-active" : ""} onClick={() => setSituation("low")}><span className="stock-summary-icon is-low"><AlertTriangle size={19} /></span><span><strong>{lowCount}</strong><small>abaixo do mínimo</small></span></button>
        <button className={situation === "zero" ? "is-active" : ""} onClick={() => setSituation("zero")}><span className="stock-summary-icon is-zero"><PackageX size={19} /></span><span><strong>{zeroCount}</strong><small>zeradas</small></span></button>
      </section>

      <section className="content-section stock-section">
        <div className="stock-filter-bar">
          <label className="stock-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto, sabor ou câmara" aria-label="Buscar no estoque" /></label>
          <label className="stock-select"><span>Câmara</span><select value={chamber} onChange={(event) => setChamber(event.target.value)}><option value="all">Todas as câmaras</option>{chambers.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <label className="stock-select"><span>Situação</span><select value={situation} onChange={(event) => setSituation(event.target.value as Situation)}><option value="all">Todas</option><option value="regular">Regular</option><option value="low">Abaixo do mínimo</option><option value="zero">Zerado</option></select></label>
        </div>

        <div className="stock-result-line"><strong>{filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}</strong><span>Atualização em tempo real</span></div>
        {filtered.length === 0 ? <div className="empty-state stock-empty"><Search size={27} /><strong>Nenhum saldo encontrado</strong><p>Altere os filtros ou faça uma movimentação para criar uma nova posição de estoque.</p><button className="button button-secondary button-compact" onClick={() => { setSearch(""); setChamber("all"); setSituation("all"); }}>Limpar filtros</button></div> : <div className="stock-list">
          {filtered.map((row) => {
            const status = stockStatus(row);
            return <article className={`stock-row is-${status}`} key={row.key}>
              <div className="stock-chamber"><span><Snowflake size={15} /></span><strong>{row.camera}</strong></div>
              <div className="stock-product"><strong>{row.product}</strong><span>{row.variant}</span></div>
              <div className="stock-number"><small>Saldo atual</small><strong>{formatBaseQuantity(row.quantityBase, row.baseUnit)}</strong></div>
              <div className="stock-number"><small>Estoque mínimo</small><span>{row.minimumBase === null ? "Não definido" : formatBaseQuantity(row.minimumBase, row.baseUnit)}</span></div>
              <span className={`stock-state is-${status}`}>{status === "zero" ? "Zerado" : status === "low" ? "Abaixo do mínimo" : "Regular"}</span>
            </article>;
          })}
        </div>}
      </section>
    </AdminShell>
  );
}

function ConnectedStock() {
  const data = useQuery(api.stock.dashboard);
  if (data === undefined) return <AdminShell integrationsReady><div className="movement-entry-loading" role="status"><span className="loading-spinner" /><span>Carregando estoque…</span></div></AdminShell>;
  return <StockContent rows={data.balances} integrationsReady />;
}

export function StockPage({ integrationsReady }: StockPageProps) {
  return integrationsReady ? <ConnectedStock /> : <StockContent rows={demoRows} integrationsReady={false} />;
}

import { usePaginatedQuery, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  CircleCheck,
  Clock3,
  FileText,
  FilterX,
  History,
  Link2,
  PackageSearch,
  UserRound,
  Warehouse,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AdminShell } from "../components/AdminShell";
import { formatBaseQuantity } from "../lib/quantity";

interface HistoryPageProps {
  integrationsReady: boolean;
}

type MovementType = "producao" | "venda" | "patrocinio" | "retorno_patrocinio" | "perda" | "ajuste_contagem" | "ajuste_manual";

function startOfDay(value: string) {
  return value ? new Date(`${value}T00:00:00`).getTime() : undefined;
}

function endOfDay(value: string) {
  return value ? new Date(`${value}T23:59:59.999`).getTime() : undefined;
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Cuiaba",
  }).format(value);
}

function dateHeading(value: number) {
  const date = new Date(value);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date());
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(date);
  if (day === today) return "Hoje";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "America/Cuiaba" }).format(date);
}

function dayKey(value: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(value);
}

function authorKind(kind: "admin" | "colaborador" | "sistema") {
  if (kind === "admin") return "Administrador";
  if (kind === "colaborador") return "Colaborador";
  return "Sistema";
}

function ConnectedHistory() {
  const options = useQuery(api.history.options);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chamberId, setChamberId] = useState("");
  const [productId, setProductId] = useState("");
  const [flavorId, setFlavorId] = useState("");
  const [type, setType] = useState("");
  const [authorKey, setAuthorKey] = useState("");
  const [movementId, setMovementId] = useState("");
  const detail = useQuery(api.history.detail, movementId ? { movementId: movementId as Id<"movements"> } : "skip");
  const fromTimestamp = startOfDay(from);
  const toTimestamp = endOfDay(to);
  const invalidRange = fromTimestamp !== undefined && toTimestamp !== undefined && fromTimestamp > toTimestamp;
  const filters = useMemo(() => ({
    from: fromTimestamp,
    to: toTimestamp,
    chamberId: chamberId ? chamberId as Id<"chambers"> : undefined,
    productId: productId ? productId as Id<"products"> : undefined,
    flavorId: flavorId ? flavorId as Id<"flavors"> : undefined,
    type: type ? type as MovementType : undefined,
    authorKey: authorKey || undefined,
  }), [authorKey, chamberId, flavorId, fromTimestamp, productId, toTimestamp, type]);
  const { results, status, loadMore } = usePaginatedQuery(api.history.list, invalidRange ? "skip" : filters, { initialNumItems: 20 });
  const activeFilterCount = [from, to, chamberId, productId, flavorId, type, authorKey].filter(Boolean).length;

  function clearFilters() {
    setFrom(""); setTo(""); setChamberId(""); setProductId(""); setFlavorId(""); setType(""); setAuthorKey("");
  }

  if (options === undefined) {
    return <AdminShell integrationsReady><div className="movement-entry-loading" role="status"><span className="loading-spinner" /><span>Preparando histórico…</span></div></AdminShell>;
  }

  return (
    <AdminShell integrationsReady>
      <section className="page-heading history-page-heading">
        <div><p className="eyebrow">Trilha de auditoria</p><h1>Histórico</h1><p>Consulte cada entrada e saída do ledger, com autor, horário e origem do lançamento.</p></div>
        <div className="heading-actions"><Link className="button button-primary" to="/movimentacoes"><Clock3 size={18} /> Nova movimentação</Link></div>
      </section>

      <section className="content-section history-filter-section">
        <div className="history-filter-heading"><div><CalendarDays size={19} /><span><strong>Filtrar movimentações</strong><small>Combine período, estoque e autoria</small></span></div>{activeFilterCount > 0 && <button className="text-button" onClick={clearFilters}><FilterX size={16} /> Limpar {activeFilterCount} {activeFilterCount === 1 ? "filtro" : "filtros"}</button>}</div>
        <div className="history-filter-grid">
          <label className="field"><span>Data inicial</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="field"><span>Data final</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label className="field"><span>Câmara</span><select value={chamberId} onChange={(event) => setChamberId(event.target.value)}><option value="">Todas</option>{options.chambers.map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? "" : " · inativa"}</option>)}</select></label>
          <label className="field"><span>Produto</span><select value={productId} onChange={(event) => { setProductId(event.target.value); setFlavorId(""); }}><option value="">Todos</option>{options.products.map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? "" : " · inativo"}</option>)}</select></label>
          <label className="field"><span>Sabor</span><select value={flavorId} onChange={(event) => setFlavorId(event.target.value)}><option value="">Todos</option>{options.flavors.map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? "" : " · inativo"}</option>)}</select></label>
          <label className="field"><span>Tipo</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="">Todos</option>{options.types.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="field history-author-field"><span>Autor</span><select value={authorKey} onChange={(event) => setAuthorKey(event.target.value)}><option value="">Todos</option>{options.authors.map((item) => <option key={item.key} value={item.key}>{item.name} · {item.kind}</option>)}</select></label>
        </div>
        {invalidRange && <div className="inline-error"><AlertTriangle size={18} />A data inicial deve ser anterior ou igual à data final.</div>}
      </section>

      <section className="content-section history-ledger-section">
        <div className="history-ledger-heading"><div><span className="history-live-dot" /><strong>Ledger em tempo real</strong><span>{results.length} {results.length === 1 ? "registro carregado" : "registros carregados"}</span></div><small>Mais recentes primeiro</small></div>
        {status === "LoadingFirstPage" || invalidRange ? invalidRange ? null : <div className="history-loading" role="status"><span className="loading-spinner" />Carregando movimentações…</div> : results.length === 0 ? <div className="empty-state history-empty"><History size={28} /><strong>Nenhuma movimentação encontrada</strong><p>Ajuste os filtros ou registre uma nova movimentação para iniciar o histórico.</p>{activeFilterCount > 0 && <button className="button button-secondary button-compact" onClick={clearFilters}>Limpar filtros</button>}</div> : <div className="history-timeline">
          {results.map((movement, index) => {
            const previous = index > 0 ? results[index - 1] : undefined;
            const showHeading = !previous || dayKey(previous.occurredAt) !== dayKey(movement.occurredAt);
            const incoming = movement.direction === "entrada";
            return <div className="history-day-fragment" key={String(movement.id)}>
              {showHeading && <div className="history-day-heading"><span>{dateHeading(movement.occurredAt)}</span><i /></div>}
              <button className="history-ledger-row" onClick={() => setMovementId(String(movement.id))}>
                <span className={`history-direction is-${incoming ? "in" : "out"}`}>{incoming ? <ArrowDownToLine size={18} /> : <ArrowUpFromLine size={18} />}</span>
                <span className="history-time">{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Cuiaba" }).format(movement.occurredAt)}</span>
                <span className="history-main"><strong>{movement.typeLabel}</strong><small>{movement.productName} · {movement.variantName}</small></span>
                <span className="history-context"><strong>{movement.chamberName}</strong><small>{movement.authorName} · {authorKind(movement.authorKind)}</small></span>
                <span className={`history-quantity is-${incoming ? "in" : "out"}`}>{incoming ? "+" : "−"}{formatBaseQuantity(movement.quantityBase, movement.baseUnit)}</span>
                <span className="history-open"><FileText size={16} /></span>
              </button>
            </div>;
          })}
          {status !== "Exhausted" && <div className="history-load-more"><button className="button button-secondary" disabled={status === "LoadingMore"} onClick={() => loadMore(20)}>{status === "LoadingMore" ? "Carregando…" : "Carregar mais movimentações"}</button></div>}
        </div>}
      </section>

      {movementId && <div className="history-drawer-layer"><button className="history-drawer-backdrop" aria-label="Fechar detalhes" onClick={() => setMovementId("")} /><aside className="history-drawer" role="dialog" aria-modal="true" aria-label="Detalhes da movimentação">
        <div className="history-drawer-header"><div><p className="eyebrow">Registro imutável</p><h2>Detalhes da movimentação</h2></div><button className="icon-button" onClick={() => setMovementId("")} aria-label="Fechar"><X size={18} /></button></div>
        {detail === undefined ? <div className="history-detail-loading"><span className="loading-spinner" />Carregando detalhes…</div> : <div className="history-detail-content">
          <div className={`history-detail-hero is-${detail.direction === "entrada" ? "in" : "out"}`}><span>{detail.direction === "entrada" ? <ArrowDownToLine size={22} /> : <ArrowUpFromLine size={22} />}</span><div><small>{detail.typeLabel}</small><strong>{detail.direction === "entrada" ? "+" : "−"}{formatBaseQuantity(detail.quantityBase, detail.baseUnit)}</strong></div></div>
          <dl className="history-detail-list">
            <div><dt><Warehouse size={15} /> Câmara</dt><dd>{detail.chamberName}</dd></div>
            <div><dt><PackageSearch size={15} /> Produto</dt><dd>{detail.productName}<span>{detail.variantName}{detail.formatName && detail.formatName !== detail.variantName ? ` · ${detail.formatName}` : ""}</span></dd></div>
            <div><dt><UserRound size={15} /> Autor</dt><dd>{detail.authorName}<span>{authorKind(detail.authorKind)}</span></dd></div>
            <div><dt><Clock3 size={15} /> Ocorrência</dt><dd>{formatDate(detail.occurredAt)}<span>Gravado em {formatDate(detail.createdAt)}</span></dd></div>
          </dl>
          <section className="history-source-card"><div><Link2 size={17} /><span><small>Origem do lançamento</small><strong>{detail.source.label}</strong></span></div><p>{detail.source.description}</p><code>{detail.source.relatedId.slice(-12)}</code></section>
          {detail.note && <section className="history-note"><small>Observação</small><p>{detail.note}</p></section>}
          {(detail.source.kind === "load" || detail.source.kind === "return") && <Link className="button button-secondary history-related-link" to="/carregamentos">Abrir carregamentos</Link>}
          {detail.source.kind === "count" && <Link className="button button-secondary history-related-link" to="/contagens">Abrir contagens</Link>}
          <span className="history-record-id">Registro {String(detail.id)}</span>
        </div>}
      </aside></div>}
    </AdminShell>
  );
}

export function HistoryPage({ integrationsReady }: HistoryPageProps) {
  if (!integrationsReady) {
    return <AdminShell integrationsReady={false}><section className="page-heading"><div><p className="eyebrow">Trilha de auditoria</p><h1>Histórico</h1><p>Conecte Clerk e Convex para consultar o ledger completo.</p></div></section><div className="setup-notice"><History size={20} /><div><strong>Histórico aguardando conexão</strong><span>Os filtros e detalhes ficam disponíveis no ambiente conectado.</span></div></div><section className="content-section empty-state"><CircleCheck size={28} /><strong>Nenhum dado de demonstração altera o ledger</strong><p>Entre no ambiente conectado para consultar registros reais.</p></section></AdminShell>;
  }
  return <ConnectedHistory />;
}

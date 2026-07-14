import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CircleCheck,
  ClipboardCheck,
  LockKeyhole,
  RotateCcw,
  Save,
  Snowflake,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AdminShell } from "../components/AdminShell";
import { formatBaseQuantity, type BaseUnit } from "../lib/quantity";
import { useOnlineStatus } from "../lib/useOnlineStatus";

interface CountsPageProps {
  integrationsReady: boolean;
}

interface CountReceipt {
  countId: string;
  closedAt: number;
  itemCount: number;
  adjustmentCount: number;
  unchangedCount: number;
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

function countError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes("COUNT_ALREADY_OPEN")) return "Esta câmara já possui uma contagem aberta. Atualize a página para continuá-la.";
  if (text.includes("COUNT_INCOMPLETE")) return "Preencha todas as linhas antes de fechar a contagem.";
  if (text.includes("INVALID_COUNT_QUANTITY")) return "Revise as quantidades. Use pacotes inteiros ou quilogramas com até três casas decimais.";
  if (text.includes("COUNT_NOT_OPEN")) return "Esta contagem já foi encerrada e não aceita alterações.";
  if (text.includes("COUNT_SCOPE_CHANGED")) return "O escopo do estoque mudou durante a contagem. Cancele e abra uma nova conferência.";
  if (text.includes("NO_COUNT_ITEMS")) return "Não há produtos cadastrados para iniciar a contagem.";
  if (text.includes("INACTIVE_REFERENCE")) return "Esta câmara foi inativada e não pode iniciar uma contagem.";
  return "Não foi possível concluir a ação. Atualize os dados e tente novamente.";
}

function editableQuantity(value: number, unit: BaseUnit) {
  return unit === "grama" ? String(value / 1000).replace(".", ",") : String(value);
}

function parseCountQuantity(value: string, unit: BaseUnit) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return undefined;
  if (unit === "pacote") {
    if (!/^\d+$/.test(normalized)) return undefined;
    const packages = Number(normalized);
    return Number.isSafeInteger(packages) ? packages : undefined;
  }
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) return undefined;
  const grams = Number(normalized) * 1000;
  return Number.isSafeInteger(grams) ? grams : undefined;
}

function Difference({ value, unit }: { value: number; unit: BaseUnit }) {
  const className = value === 0 ? "is-even" : value > 0 ? "is-positive" : "is-negative";
  const prefix = value > 0 ? "+" : "";
  return <span className={`count-difference ${className}`}>{prefix}{formatBaseQuantity(Math.abs(value), unit)}{value < 0 ? " a menos" : value > 0 ? " a mais" : " · confere"}</span>;
}

function ConnectedCounts() {
  const online = useOnlineStatus();
  const overview = useQuery(api.counts.overview);
  const openCount = useMutation(api.counts.open);
  const saveEntries = useMutation(api.counts.saveEntries);
  const closeCount = useMutation(api.counts.close);
  const cancelCount = useMutation(api.counts.cancel);
  const [countId, setCountId] = useState("");
  const detail = useQuery(api.counts.detail, countId ? { countId: countId as Id<"physicalCounts"> } : "skip");
  const [values, setValues] = useState<Record<string, string>>({});
  const [openingId, setOpeningId] = useState("");
  const [openRequests, setOpenRequests] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [receipt, setReceipt] = useState<CountReceipt>();

  const parsedRows = useMemo(() => detail?.rows.map((row) => {
    const key = String(row.id);
    const input = Object.prototype.hasOwnProperty.call(values, key)
      ? values[key]
      : row.countedBase === undefined
        ? ""
        : editableQuantity(row.countedBase, row.baseUnit);
    return { ...row, input, parsed: parseCountQuantity(input, row.baseUnit) };
  }) ?? [], [detail?.rows, values]);
  const completedItems = parsedRows.filter((row) => row.parsed !== undefined).length;
  const hasInvalidValue = parsedRows.some((row) => row.input.trim() && row.parsed === undefined);
  const allComplete = parsedRows.length > 0 && completedItems === parsedRows.length && !hasInvalidValue;
  const adjustmentCount = parsedRows.filter((row) => row.parsed !== undefined && row.parsed !== row.systemBase).length;

  function enterCount(nextCountId: string) {
    setCountId(nextCountId);
    setValues({});
    setReviewing(false);
    setConfirmCancel(false);
    setReceipt(undefined);
    setError("");
    setFeedback("");
  }

  function leaveCount() {
    setCountId("");
    setValues({});
    setReviewing(false);
    setConfirmCancel(false);
    setReceipt(undefined);
    setError("");
    setFeedback("");
  }

  async function startCount(chamberId: string) {
    if (!online) return;
    const requestId = openRequests[chamberId] || crypto.randomUUID();
    setOpenRequests((current) => ({ ...current, [chamberId]: requestId }));
    setOpeningId(chamberId);
    setError("");
    try {
      const result = await openCount({ chamberId: chamberId as Id<"chambers">, requestId });
      enterCount(String(result.countId));
    } catch (startError) {
      setError(countError(startError));
    } finally {
      setOpeningId("");
    }
  }

  function entryPayload(onlyFilled = true) {
    if (!detail) return [];
    return parsedRows
      .filter((row) => !onlyFilled || row.input.trim())
      .filter((row): row is typeof row & { parsed: number } => row.parsed !== undefined)
      .map((row) => ({ itemId: row.id as Id<"physicalCountItems">, countedBase: row.parsed }));
  }

  async function saveDraft() {
    if (!detail || !online) return;
    if (hasInvalidValue) {
      setError(countError(new Error("INVALID_COUNT_QUANTITY")));
      return;
    }
    const entries = entryPayload();
    if (entries.length === 0) {
      setError("Informe ao menos uma quantidade para salvar o rascunho.");
      return;
    }
    setSaving(true); setError(""); setFeedback("");
    try {
      const result = await saveEntries({ countId: detail.id, entries });
      setFeedback(`Rascunho salvo · ${result.completedItems} de ${result.totalItems} linhas preenchidas.`);
    } catch (saveError) {
      setError(countError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function reviewDifferences() {
    if (!detail || !allComplete || !online) return;
    setSaving(true); setError(""); setFeedback("");
    try {
      await saveEntries({ countId: detail.id, entries: entryPayload(false) });
      setReviewing(true);
    } catch (saveError) {
      setError(countError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function finishCount() {
    if (!detail || !allComplete || !online) return;
    setSaving(true); setError("");
    try {
      await saveEntries({ countId: detail.id, entries: entryPayload(false) });
      const result = await closeCount({ countId: detail.id });
      setReceipt({ ...result, countId: String(result.countId) });
      setReviewing(false);
    } catch (closeError) {
      setError(countError(closeError));
    } finally {
      setSaving(false);
    }
  }

  async function cancelCurrentCount() {
    if (!detail || !online) return;
    setSaving(true); setError("");
    try {
      await cancelCount({ countId: detail.id });
      leaveCount();
    } catch (cancelError) {
      setError(countError(cancelError));
    } finally {
      setSaving(false);
    }
  }

  if (overview === undefined) {
    return <AdminShell integrationsReady><div className="movement-entry-loading" role="status"><span className="loading-spinner" /><span>Carregando contagens…</span></div></AdminShell>;
  }

  if (countId && detail === undefined) {
    return <AdminShell integrationsReady><div className="movement-entry-loading" role="status"><span className="loading-spinner" /><span>Abrindo livro de contagem…</span></div></AdminShell>;
  }

  if (countId && detail) {
    const progress = detail.rows.length ? Math.round((completedItems / detail.rows.length) * 100) : 0;
    return (
      <AdminShell integrationsReady>
        <button className="count-back" onClick={leaveCount}><ArrowLeft size={17} /> Voltar para contagens</button>
        <section className="count-work-header">
          <div>
            <div className="count-status-line"><span className="count-status-badge">Contagem aberta</span><span>Iniciada por {detail.openedBy} · {formatDate(detail.openedAt)}</span></div>
            <h1>{detail.chamberName}</h1>
            <p>Informe o estoque físico de cada linha. A câmara permanece bloqueada até fechar ou cancelar.</p>
          </div>
          <div className="count-freeze-mark"><LockKeyhole size={22} /><span><strong>Estoque congelado</strong><small>Movimentações pausadas</small></span></div>
        </section>

        {receipt ? (
          <section className="content-section count-receipt">
            <span className="success-symbol"><CircleCheck size={40} /></span>
            <p>Contagem fechada</p>
            <h2>Saldo reconciliado com sucesso</h2>
            <span>{detail.chamberName} · {formatDate(receipt.closedAt)}</span>
            <div className="count-receipt-stats">
              <div><strong>{receipt.itemCount}</strong><span>linhas conferidas</span></div>
              <div><strong>{receipt.adjustmentCount}</strong><span>ajustes gerados</span></div>
              <div><strong>{receipt.unchangedCount}</strong><span>saldos corretos</span></div>
            </div>
            <button className="button button-primary" onClick={leaveCount}><RotateCcw size={18} /> Voltar às contagens</button>
          </section>
        ) : reviewing ? (
          <section className="content-section count-review-section">
            <div className="count-section-heading"><div><p className="eyebrow">Prévia de reconciliação</p><h2>Confira as diferenças</h2><p>{adjustmentCount === 0 ? "Todos os saldos conferem. Nenhum ajuste será criado." : `${adjustmentCount} ${adjustmentCount === 1 ? "linha será ajustada" : "linhas serão ajustadas"} no fechamento.`}</p></div><span className={adjustmentCount ? "count-review-total has-difference" : "count-review-total"}>{adjustmentCount} ajustes</span></div>
            <div className="count-reconciliation-list">
              {parsedRows.map((row) => {
                const counted = row.parsed ?? 0;
                const difference = counted - row.systemBase;
                return <article className="count-reconciliation-row" key={String(row.id)}>
                  <div className="count-product"><strong>{row.productName}</strong><span>{row.variantName ?? "Unidade base"}</span></div>
                  <div className="count-compare"><span><small>Sistema</small><strong>{formatBaseQuantity(row.systemBase, row.baseUnit)}</strong></span><i>→</i><span><small>Contado</small><strong>{formatBaseQuantity(counted, row.baseUnit)}</strong></span></div>
                  <Difference value={difference} unit={row.baseUnit} />
                </article>;
              })}
            </div>
            {error && <div className="inline-error" role="alert"><AlertTriangle size={18} />{error}</div>}
            {!online && <div className="inline-error"><AlertTriangle size={18} />Sem conexão. O fechamento está bloqueado.</div>}
            <div className="count-review-actions"><button className="button button-secondary" onClick={() => { setReviewing(false); setError(""); }}>Voltar e corrigir</button><button className="button button-primary" disabled={!online || saving} onClick={() => void finishCount()}><Check size={18} />{saving ? "Fechando…" : adjustmentCount ? `Fechar e gerar ${adjustmentCount} ajustes` : "Fechar contagem"}</button></div>
          </section>
        ) : (
          <section className="content-section count-entry-section">
            <div className="count-progress-block"><div><strong>{completedItems} de {detail.rows.length} linhas</strong><span>{progress}% concluído</span></div><div className="count-progress-track" aria-label={`${progress}% da contagem concluída`}><i style={{ width: `${progress}%` }} /></div></div>
            <div className="count-entry-intro"><Snowflake size={21} /><div><strong>Conte o que está fisicamente na câmara</strong><span>O saldo do sistema será comparado somente na próxima etapa.</span></div></div>
            <div className="count-entry-list">
              {parsedRows.map((row) => {
                const invalid = Boolean(row.input.trim() && row.parsed === undefined);
                return <label className={`count-entry-row${invalid ? " has-error" : ""}`} key={String(row.id)}>
                  <span className="count-product"><strong>{row.productName}</strong><small>{row.variantName ?? "Unidade base"}</small></span>
                  <span className="count-input-wrap"><input type="text" inputMode={row.baseUnit === "grama" ? "decimal" : "numeric"} value={row.input} onChange={(event) => { setValues((current) => ({ ...current, [String(row.id)]: event.target.value })); setFeedback(""); }} placeholder="0" aria-label={`Quantidade contada de ${row.productName}${row.variantName ? `, ${row.variantName}` : ""}`} /><b>{row.baseUnit === "grama" ? "kg" : "pacotes"}</b></span>
                </label>;
              })}
            </div>
            {hasInvalidValue && <div className="inline-error"><AlertTriangle size={18} />Use pacotes inteiros ou quilogramas com até três casas decimais.</div>}
            {error && <div className="inline-error" role="alert"><AlertTriangle size={18} />{error}</div>}
            {feedback && <div className="count-feedback"><CircleCheck size={17} />{feedback}</div>}
            {!online && <div className="inline-error"><AlertTriangle size={18} />Sem conexão. Os dados permanecem na tela, mas ainda não foram salvos.</div>}
            {confirmCancel ? <div className="count-cancel-confirm"><div><AlertTriangle size={19} /><span><strong>Cancelar esta contagem?</strong><small>Nenhum ajuste será criado e a câmara voltará a aceitar movimentações.</small></span></div><div><button className="button button-secondary" onClick={() => setConfirmCancel(false)}>Continuar contando</button><button className="button count-danger-button" disabled={saving || !online} onClick={() => void cancelCurrentCount()}><X size={17} /> Confirmar cancelamento</button></div></div> : null}
            <div className="count-entry-actions"><button className="button count-cancel-link" onClick={() => setConfirmCancel(true)}>Cancelar contagem</button><span /><button className="button button-secondary" disabled={saving || !online || completedItems === 0 || hasInvalidValue} onClick={() => void saveDraft()}><Save size={17} />{saving ? "Salvando…" : "Salvar rascunho"}</button><button className="button button-primary" disabled={saving || !online || !allComplete} onClick={() => void reviewDifferences()}><ClipboardCheck size={18} /> Revisar diferenças</button></div>
          </section>
        )}
      </AdminShell>
    );
  }

  const openCounts = overview.chambers.filter((item) => item.openCount);
  return (
    <AdminShell integrationsReady>
      <section className="page-heading count-page-heading"><div><p className="eyebrow">Controle de estoque</p><h1>Contagens físicas</h1><p>Confira uma câmara por vez e reconcilie o ledger sem perder a trilha de auditoria.</p></div></section>
      <section className="count-policy-strip"><span><LockKeyhole size={22} /></span><div><strong>Uma câmara em contagem fica temporariamente bloqueada</strong><p>Produções, perdas, carregamentos e ajustes voltam a funcionar assim que a contagem for fechada ou cancelada.</p></div></section>
      {error && <div className="inline-error count-overview-error" role="alert"><AlertTriangle size={18} />{error}</div>}

      {openCounts.length > 0 && <section className="count-overview-group"><div className="section-heading"><div><h2>Em andamento</h2><p>Continue do ponto salvo em qualquer dispositivo.</p></div></div><div className="count-chamber-grid">{openCounts.map((chamber) => <article className="count-chamber-card is-open" key={String(chamber.id)}><div className="count-card-icon"><ClipboardCheck size={21} /></div><div><span className="count-open-label">Contagem aberta</span><h3>{chamber.name}</h3><p>{chamber.openCount?.completedItems} de {chamber.openCount?.totalItems} linhas · {chamber.openCount?.openedBy}</p></div><button className="button button-primary button-compact" onClick={() => enterCount(String(chamber.openCount?.id))}>Continuar</button></article>)}</div></section>}

      <section className="count-overview-group"><div className="section-heading"><div><h2>Iniciar nova contagem</h2><p>Escolha a câmara que será fechada para conferência.</p></div></div><div className="count-chamber-grid">{overview.chambers.filter((item) => !item.openCount).map((chamber) => <article className="count-chamber-card" key={String(chamber.id)}><div className="count-card-icon"><Snowflake size={21} /></div><div><h3>{chamber.name}</h3><p>Pronta para conferência física</p></div><button className="button button-secondary button-compact" disabled={!online || openingId === chamber.id || !chamber.active} onClick={() => void startCount(String(chamber.id))}>{openingId === chamber.id ? "Abrindo…" : "Iniciar contagem"}</button></article>)}</div></section>

      <section className="content-section count-history"><div className="section-heading"><div><h2>Histórico recente</h2><p>Fechamentos e cancelamentos permanecem auditáveis.</p></div></div>{overview.recent.length === 0 ? <div className="empty-state"><ClipboardCheck size={27} /><strong>Nenhuma contagem encerrada</strong><p>As primeiras reconciliações aparecerão aqui.</p></div> : <div className="count-history-list">{overview.recent.map((count) => <div key={String(count.id)}><span className={`count-history-status is-${count.status}`}>{count.status === "fechada" ? "Fechada" : "Cancelada"}</span><strong>{count.chamberName}</strong><span>{count.itemCount} linhas · {count.adjustmentCount} ajustes</span><span>{count.closedAt ? formatDate(count.closedAt) : formatDate(count.openedAt)} · {count.responsible}</span></div>)}</div>}</section>
    </AdminShell>
  );
}

export function CountsPage({ integrationsReady }: CountsPageProps) {
  if (!integrationsReady) {
    return <AdminShell integrationsReady={false}><section className="page-heading"><div><p className="eyebrow">Controle de estoque</p><h1>Contagens físicas</h1><p>Conecte Clerk e Convex para abrir uma contagem e reconciliar o estoque real.</p></div></section><section className="content-section empty-state"><ClipboardCheck size={30} /><strong>Contagens aguardando conexão</strong><p>No ambiente conectado, cada fechamento gera ajustes atômicos e auditáveis.</p></section></AdminShell>;
  }
  return <ConnectedCounts />;
}

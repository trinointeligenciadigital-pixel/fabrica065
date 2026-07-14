import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CircleCheck,
  PackagePlus,
  RotateCcw,
  Scale,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AdminShell } from "../components/AdminShell";
import { formatBaseQuantity } from "../lib/quantity";
import { useOnlineStatus } from "../lib/useOnlineStatus";

interface MovementsPageProps {
  integrationsReady: boolean;
}

type Mode = "production" | "loss" | "adjustment";
type Direction = "entrada" | "saida";

function movementError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes("INSUFFICIENT_STOCK")) return "Saldo insuficiente para concluir esta saída.";
  if (text.includes("CHAMBER_UNDER_COUNT")) return "A câmara está em contagem física e não aceita movimentações.";
  if (text.includes("LOSS_REASON_REQUIRED")) return "Selecione um motivo de perda ativo.";
  if (text.includes("NOTE_REQUIRED")) return "Informe uma justificativa com pelo menos 5 caracteres.";
  if (text.includes("INACTIVE_REFERENCE")) return "Um dos cadastros selecionados foi inativado.";
  if (text.includes("FORMAT_REQUIRED")) return "Selecione um formato válido para o produto.";
  if (text.includes("INVALID_QUANTITY")) return "Informe uma quantidade válida maior que zero.";
  return "Não foi possível registrar a movimentação. Tente novamente.";
}

function ConnectedMovements() {
  const online = useOnlineStatus();
  const options = useQuery(api.stock.adminMovementOptions);
  const registerProduction = useMutation(api.stock.registerAdminProduction);
  const registerLoss = useMutation(api.stock.registerAdminLoss);
  const registerAdjustment = useMutation(api.stock.registerAdminAdjustment);
  const [mode, setMode] = useState<Mode>("production");
  const [chamberId, setChamberId] = useState("");
  const [productId, setProductId] = useState("");
  const [flavorId, setFlavorId] = useState("");
  const [formatId, setFormatId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lossReasonId, setLossReasonId] = useState("");
  const [note, setNote] = useState("");
  const [direction, setDirection] = useState<Direction>("entrada");
  const [reviewing, setReviewing] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ movementId: string; occurredAt: number }>();

  const product = options?.products.find((item) => item._id === productId);
  const format = options?.formats.find((item) => item._id === formatId);
  const flavor = options?.flavors.find((item) => item._id === flavorId);
  const chamber = options?.chambers.find((item) => item._id === chamberId);
  const lossReason = options?.lossReasons.find((item) => item._id === lossReasonId);
  const formats = options?.formats.filter((item) => item.productId === productId) ?? [];

  const quantityBase = useMemo(() => {
    const numeric = Number(quantity.replace(",", "."));
    if (!Number.isFinite(numeric) || numeric <= 0 || !product) return 0;
    if (mode === "loss" || mode === "production") {
      return product.kind === "saborizado" ? numeric : numeric * (format?.gramsPerPackage ?? 0);
    }
    return product.baseUnit === "grama" ? Math.round(numeric * 1000) : numeric;
  }, [format, mode, product, quantity]);

  const balanceKey = chamberId && productId
    ? `${chamberId}:${productId}:${flavorId || "none"}`
    : "";
  const availableBase = options?.balances.find((item) => item.key === balanceKey)?.quantityBase ?? 0;
  const isEntry = mode === "production" || (mode === "adjustment" && direction === "entrada");
  const projectedBase = availableBase + (isEntry ? quantityBase : -quantityBase);
  const variantValid = product?.kind === "saborizado"
    ? Boolean(flavorId)
    : mode === "loss" || mode === "production"
      ? Boolean(formatId)
      : true;
  const quantityValid = Number.isSafeInteger(quantityBase) && quantityBase > 0;
  const formValid = Boolean(chamberId && productId && variantValid && quantityValid)
    && (mode === "loss" ? Boolean(lossReasonId) : mode === "adjustment" ? note.trim().length >= 5 : true);

  function resetForm(nextMode = mode) {
    setMode(nextMode);
    setChamberId("");
    setProductId("");
    setFlavorId("");
    setFormatId("");
    setQuantity("");
    setLossReasonId("");
    setNote("");
    setDirection(nextMode === "loss" ? "saida" : "entrada");
    setReviewing(false);
    setRequestId("");
    setError("");
    setReceipt(undefined);
  }

  function review(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!formValid) return;
    setReviewing(true);
  }

  async function submit() {
    if (!options || !product || !formValid || !online) return;
    const stableRequestId = requestId || crypto.randomUUID();
    setRequestId(stableRequestId);
    setSaving(true);
    setError("");
    try {
      const result = mode === "production"
        ? await registerProduction({
            chamberId: chamberId as Id<"chambers">,
            productId: productId as Id<"products">,
            flavorId: flavorId ? flavorId as Id<"flavors"> : undefined,
            packageFormatId: formatId ? formatId as Id<"packageFormats"> : undefined,
            quantityPackages: Number(quantity),
            requestId: stableRequestId,
          })
        : mode === "loss"
        ? await registerLoss({
            chamberId: chamberId as Id<"chambers">,
            productId: productId as Id<"products">,
            flavorId: flavorId ? flavorId as Id<"flavors"> : undefined,
            packageFormatId: formatId ? formatId as Id<"packageFormats"> : undefined,
            quantityPackages: Number(quantity),
            lossReasonId: lossReasonId as Id<"lossReasons">,
            note: note.trim() || undefined,
            requestId: stableRequestId,
          })
        : await registerAdjustment({
            chamberId: chamberId as Id<"chambers">,
            productId: productId as Id<"products">,
            flavorId: flavorId ? flavorId as Id<"flavors"> : undefined,
            direction,
            quantityBase,
            note: note.trim(),
            requestId: stableRequestId,
          });
      setReceipt({ movementId: String(result.movementId), occurredAt: result.occurredAt });
      setReviewing(false);
    } catch (submitError) {
      setError(movementError(submitError));
    } finally {
      setSaving(false);
    }
  }

  if (options === undefined) {
    return <AdminShell integrationsReady><div className="movement-entry-loading" role="status"><span className="loading-spinner" /><span>Carregando opções de movimentação…</span></div></AdminShell>;
  }

  return (
    <AdminShell integrationsReady>
      <section className="page-heading register-heading">
        <div><p className="eyebrow">Livro-razão</p><h1>Registrar movimentação</h1><p>Produções, perdas e ajustes são auditáveis e nunca alteram registros anteriores.</p></div>
      </section>

      <div className="movement-mode-tabs admin-movement-tabs" role="tablist" aria-label="Tipo de movimentação">
        <button className={mode === "production" ? "is-active" : ""} onClick={() => resetForm("production")}><PackagePlus size={18} /> Produção</button>
        <button className={mode === "loss" ? "is-active" : ""} onClick={() => resetForm("loss")}><Trash2 size={18} /> Perda</button>
        <button className={mode === "adjustment" ? "is-active" : ""} onClick={() => resetForm("adjustment")}><Scale size={18} /> Ajuste manual</button>
      </div>

      <section className="content-section movement-entry-section">
        {receipt ? (
          <div className="admin-receipt">
            <span className="success-symbol"><CircleCheck size={38} /></span>
            <p>Movimentação registrada</p>
            <h2>{mode === "production" ? "Produção confirmada" : mode === "loss" ? "Perda confirmada" : "Ajuste confirmado"}</h2>
            <span>{chamber?.name} · {product?.name}{flavor ? " · " + flavor.name : ""}</span>
            <div className="success-note"><strong>Ledger atualizado em tempo real.</strong><span>Registro {receipt.movementId.slice(-8)} · {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Cuiaba" }).format(receipt.occurredAt)}</span></div>
            <button className="button button-primary" onClick={() => resetForm()}><RotateCcw size={18} /> Registrar outra movimentação</button>
          </div>
        ) : reviewing ? (
          <div className="movement-review">
            <div className="section-heading"><div><h2>Confira antes de registrar</h2><p>O lançamento será permanente no livro-razão.</p></div></div>
            <dl className="confirmation-list">
              <div><dt>Movimentação</dt><dd>{mode === "production" ? "Entrada de produção" : mode === "loss" ? "Saída por perda" : direction === "entrada" ? "Ajuste positivo" : "Ajuste negativo"}</dd></div>
              <div><dt>Câmara</dt><dd>{chamber?.name}</dd></div>
              <div><dt>Produto</dt><dd>{product?.name}{flavor ? " · " + flavor.name : format ? " · " + format.name : ""}</dd></div>
              {mode === "loss" && <div><dt>Motivo</dt><dd>{lossReason?.name}</dd></div>}
              <div className="confirmation-total"><dt>Quantidade</dt><dd>{formatBaseQuantity(quantityBase, product?.baseUnit ?? "pacote")}</dd></div>
              <div><dt>Saldo atual</dt><dd>{formatBaseQuantity(availableBase, product?.baseUnit ?? "pacote")}</dd></div>
              <div><dt>Saldo após</dt><dd>{projectedBase >= 0 ? formatBaseQuantity(projectedBase, product?.baseUnit ?? "pacote") : "Saldo insuficiente"}</dd></div>
              {mode !== "production" && <div><dt>Observação</dt><dd>{note.trim() || "Não informada"}</dd></div>}
            </dl>
            {projectedBase < 0 && <div className="inline-error"><AlertTriangle size={18} />O saldo disponível é insuficiente para esta saída.</div>}
            {!online && <div className="inline-error"><AlertTriangle size={18} />Sem conexão. Aguarde para registrar.</div>}
            {error && <div className="inline-error" role="alert"><AlertTriangle size={18} />{error}</div>}
            <div className="movement-review-actions"><button className="button button-secondary" onClick={() => setReviewing(false)}>Voltar e corrigir</button><button className="button button-primary" disabled={!online || saving || projectedBase < 0} onClick={() => void submit()}><Check size={18} />{saving ? "Registrando…" : "Confirmar movimentação"}</button></div>
          </div>
        ) : (
          <form className="movement-entry-form" onSubmit={review}>
            <div className="movement-form-grid">
              <label className="field"><span>Câmara</span><select value={chamberId} onChange={(event) => setChamberId(event.target.value)} required><option value="">Selecione</option>{options.chambers.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
              <label className="field"><span>Produto</span><select value={productId} onChange={(event) => { setProductId(event.target.value); setFlavorId(""); setFormatId(""); setQuantity(""); }} required><option value="">Selecione</option>{options.products.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
              {product?.kind === "saborizado" && <label className="field"><span>Sabor</span><select value={flavorId} onChange={(event) => setFlavorId(event.target.value)} required><option value="">Selecione</option>{options.flavors.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>}
              {(mode === "loss" || mode === "production") && product && product.kind !== "saborizado" && <label className="field"><span>Formato</span><select value={formatId} onChange={(event) => setFormatId(event.target.value)} required><option value="">Selecione</option>{formats.map((item) => <option key={item._id} value={item._id}>{item.name} · {formatBaseQuantity(item.gramsPerPackage, "grama")}</option>)}</select></label>}
              {mode === "adjustment" && <label className="field"><span>Direção</span><select value={direction} onChange={(event) => setDirection(event.target.value as Direction)}><option value="entrada">Entrada — acrescentar</option><option value="saida">Saída — reduzir</option></select></label>}
              <label className="field"><span>{mode === "loss" || mode === "production" || product?.baseUnit === "pacote" ? "Quantidade (pacotes)" : "Quantidade (kg)"}</span><input type="number" min={product?.baseUnit === "grama" && mode === "adjustment" ? "0.001" : "1"} step={product?.baseUnit === "grama" && mode === "adjustment" ? "0.001" : "1"} inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
              {mode === "loss" && <label className="field"><span>Motivo da perda</span><select value={lossReasonId} onChange={(event) => setLossReasonId(event.target.value)} required><option value="">Selecione</option>{options.lossReasons.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>}
            </div>
            {mode !== "production" && <label className="field movement-note"><span>{mode === "adjustment" ? "Justificativa obrigatória" : "Observação (opcional)"}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder={mode === "adjustment" ? "Explique por que o saldo precisa ser ajustado" : "Detalhes úteis sobre a ocorrência"} required={mode === "adjustment"} /></label>}
            {chamberId && productId && <div className="available-balance"><span>Saldo disponível</span><strong>{formatBaseQuantity(availableBase, product?.baseUnit ?? "pacote")}</strong></div>}
            {options.lossReasons.length === 0 && mode === "loss" && <div className="inline-error"><AlertTriangle size={18} />Cadastre ao menos um motivo de perda ativo em Preparação.</div>}
            <button className="button button-primary movement-submit" disabled={!formValid || (mode === "loss" && options.lossReasons.length === 0)}>{mode === "production" ? <ArrowDownToLine size={18} /> : mode === "loss" ? <ArrowUpFromLine size={18} /> : direction === "entrada" ? <ArrowDownToLine size={18} /> : <ArrowUpFromLine size={18} />} Revisar lançamento</button>
          </form>
        )}
      </section>
    </AdminShell>
  );
}

export function MovementsPage({ integrationsReady }: MovementsPageProps) {
  if (!integrationsReady) {
    return <AdminShell integrationsReady={false}><section className="page-heading"><div><p className="eyebrow">Livro-razão</p><h1>Registrar movimentação</h1><p>Conecte Clerk e Convex para registrar produções, perdas e ajustes reais.</p></div></section></AdminShell>;
  }
  return <ConnectedMovements />;
}

import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleCheck,
  KeyRound,
  LockKeyhole,
  LogOut,
  PackagePlus,
  ShieldAlert,
  Snowflake,
  Trash2,
  UserRound,
  WifiOff,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OfflineBanner } from "../components/OfflineBanner";
import { formatBaseQuantity } from "../lib/quantity";
import { useOnlineStatus } from "../lib/useOnlineStatus";

type Step = "action" | "product" | "variant" | "quantity" | "confirm" | "success";
type ActionKind = "production" | "loss";

interface OperationPageProps {
  integrationsReady: boolean;
}

function LoadingOperation() {
  return (
    <div className="operation-shell">
      <OfflineBanner />
      <header className="operation-header"><span className="operation-brand"><span className="brand-mark"><Snowflake size={21} /></span><span><strong>Estoque</strong><b>065</b></span></span></header>
      <main className="operation-main"><section className="operation-panel operation-loading" role="status"><span className="loading-spinner" /><strong>Preparando acesso</strong><span>Validando a câmara e a sessão.</span></section></main>
    </div>
  );
}

function InvalidChamber() {
  return (
    <div className="operation-shell">
      <OfflineBanner />
      <header className="operation-header"><Link to="/" className="operation-brand"><span className="brand-mark"><Snowflake size={21} /></span><span><strong>Estoque</strong><b>065</b></span></Link></header>
      <main className="operation-main"><section className="operation-panel access-error-panel"><span className="access-symbol"><ShieldAlert size={26} /></span><h1>QR inválido ou inativo</h1><p>Solicite ao responsável um novo código de acesso para esta câmara.</p></section></main>
    </div>
  );
}

function errorMessage(error: unknown, action: ActionKind | undefined) {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes("SESSION_INVALID") || text.includes("SESSION_CHAMBER_MISMATCH")) return "Sua sessão expirou. Entre novamente.";
  if (text.includes("PERMISSION_DENIED")) return action === "loss" ? "Seu perfil não permite registrar perdas nesta câmara." : "Seu perfil não permite registrar produção nesta câmara.";
  if (text.includes("CHAMBER_UNDER_COUNT")) return "A câmara está em contagem física. Aguarde o encerramento.";
  if (text.includes("INSUFFICIENT_STOCK")) return "Saldo insuficiente para registrar esta perda.";
  if (text.includes("LOSS_REASON_REQUIRED")) return "O motivo de perda não está mais disponível.";
  if (text.includes("INACTIVE_REFERENCE")) return "Este produto foi inativado. Escolha outro item.";
  if (text.includes("FORMAT_REQUIRED")) return "O formato selecionado não está mais disponível.";
  if (text.includes("INVALID_QUANTITY")) return "Informe uma quantidade válida de pacotes.";
  return "Não foi possível registrar. Confira a conexão e tente novamente.";
}

function ConnectedOperation({ chamberToken }: { chamberToken: string }) {
  const online = useOnlineStatus();
  const access = useQuery(api.sessions.chamberAccess, { chamberToken });
  const login = useMutation(api.sessions.login);
  const logout = useMutation(api.sessions.logout);
  const registerProduction = useMutation(api.stock.registerOperatorProduction);
  const registerLoss = useMutation(api.stock.registerOperatorLoss);
  const storageKey = "estoque065:operator:" + chamberToken;
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem(storageKey) ?? "");
  const current = useQuery(api.sessions.current, sessionToken ? { chamberToken, sessionToken } : "skip");
  const [collaboratorId, setCollaboratorId] = useState("");
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [action, setAction] = useState<ActionKind>();
  const [step, setStep] = useState<Step>("action");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lossReasonId, setLossReasonId] = useState("");
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<{ movementId: string; quantityBase: number; occurredAt: number }>();

  const selectedProduct = useMemo(
    () => current?.valid ? current.products.find((item) => item.id === productId) : undefined,
    [current, productId],
  );
  const variants = useMemo(() => {
    if (!current?.valid || !selectedProduct) return [];
    return selectedProduct.kind === "saborizado"
      ? current.flavors.map((item) => ({ id: item.id, name: item.name, gramsPerPackage: undefined }))
      : current.formats
          .filter((item) => item.productId === selectedProduct.id)
          .map((item) => ({ id: item.id, name: item.name, gramsPerPackage: item.gramsPerPackage }));
  }, [current, selectedProduct]);
  const selectedVariant = variants.find((item) => item.id === variantId);
  const selectedLossReason = current?.valid ? current.lossReasons.find((item) => item.id === lossReasonId) : undefined;
  const displayedLoginError = loginError || (sessionToken && current && !current.valid ? "Sua sessão expirou. Informe o PIN novamente." : "");

  if (access === undefined || (sessionToken && current === undefined)) return <LoadingOperation />;
  if (!access.valid) return <InvalidChamber />;

  async function enter() {
    if (!collaboratorId || !pin || !online) return;
    setLoginBusy(true);
    setLoginError("");
    try {
      const result = await login({ chamberToken, collaboratorId: collaboratorId as Id<"collaborators">, pin });
      if (!result.ok) {
        if (result.reason === "BLOCKED") {
          const time = result.blockedUntil
            ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Cuiaba" }).format(result.blockedUntil)
            : "";
          setLoginError("Acesso temporariamente bloqueado" + (time ? " até " + time + "." : "."));
        } else {
          setLoginError(result.attemptsRemaining === undefined
            ? "Nome ou PIN inválido."
            : "PIN inválido. " + result.attemptsRemaining + (result.attemptsRemaining === 1 ? " tentativa restante." : " tentativas restantes."));
        }
        setPin("");
        return;
      }
      sessionStorage.setItem(storageKey, result.sessionToken);
      setSessionToken(result.sessionToken);
      setPin("");
      setStep("action");
    } catch {
      setLoginError("Não foi possível validar o acesso. Tente novamente.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function leave() {
    if (sessionToken) await logout({ chamberToken, sessionToken });
    sessionStorage.removeItem(storageKey);
    setSessionToken("");
    resetAll();
  }

  function resetAll(nextAction?: ActionKind) {
    setAction(nextAction);
    setStep(nextAction ? "product" : "action");
    setProductId("");
    setVariantId("");
    setQuantity("");
    setLossReasonId("");
    setNote("");
    setRequestId("");
    setSubmitError("");
    setReceipt(undefined);
  }

  function selectProduct(id: string) {
    setProductId(id);
    setVariantId("");
    setQuantity("");
    setRequestId("");
    setSubmitError("");
    setStep("variant");
  }

  function selectVariant(id: string) {
    setVariantId(id);
    setQuantity("");
    setRequestId("");
    setStep("quantity");
  }

  async function submit() {
    if (!current?.valid || !selectedProduct || !selectedVariant || !sessionToken || !online || !action) return;
    const quantityPackages = Number(quantity);
    const stableRequestId = requestId || crypto.randomUUID();
    setRequestId(stableRequestId);
    setSaving(true);
    setSubmitError("");
    try {
      const common = {
        chamberToken,
        sessionToken,
        productId: selectedProduct.id,
        flavorId: selectedProduct.kind === "saborizado" ? selectedVariant.id as Id<"flavors"> : undefined,
        packageFormatId: selectedProduct.kind === "saborizado" ? undefined : selectedVariant.id as Id<"packageFormats">,
        quantityPackages,
        requestId: stableRequestId,
      };
      const result = action === "production"
        ? await registerProduction(common)
        : await registerLoss({ ...common, lossReasonId: lossReasonId as Id<"lossReasons">, note: note.trim() || undefined });
      setReceipt({ movementId: String(result.movementId), quantityBase: result.quantityBase, occurredAt: result.occurredAt });
      setStep("success");
    } catch (error) {
      setSubmitError(errorMessage(error, action));
    } finally {
      setSaving(false);
    }
  }

  if (!sessionToken || !current?.valid) {
    return (
      <div className="operation-shell">
        <OfflineBanner />
        <header className="operation-header">
          <Link to="/" className="operation-brand"><span className="brand-mark"><Snowflake size={21} /></span><span><strong>Estoque</strong><b>065</b></span></Link>
          <span className="secure-chip"><LockKeyhole size={14} /> Acesso protegido</span>
        </header>
        <div className="camera-context"><div><span className="context-symbol"><Snowflake size={20} /></span><div><small>Câmara</small><strong>{access.chamberName}</strong></div></div></div>
        <main className="operation-main">
          <section className="operation-panel login-panel">
            <div className="operation-title"><span className="operation-title-icon"><KeyRound size={24} /></span><div><p>Identificação</p><h1>Entre com seu PIN</h1><span>Escolha seu nome e informe o PIN individual.</span></div></div>
            {access.collaborators.length === 0 ? (
              <div className="inline-error"><ShieldAlert size={18} />Nenhum colaborador está autorizado nesta câmara.</div>
            ) : (
              <>
                <label className="field operation-field"><span>Quem está operando?</span><select value={collaboratorId} onChange={(event) => setCollaboratorId(event.target.value)}><option value="">Selecione seu nome</option>{access.collaborators.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="quantity-field pin-field"><span>PIN individual</span><div><input type="password" inputMode="numeric" pattern="[0-9]*" minLength={4} maxLength={6} autoComplete="current-password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} placeholder="••••" onKeyDown={(event) => { if (event.key === "Enter") void enter(); }} /><b><LockKeyhole size={18} /></b></div><small>De 4 a 6 números.</small></label>
                {displayedLoginError && <div className="inline-error" role="alert"><ShieldAlert size={18} />{displayedLoginError}</div>}
                {!online && <div className="inline-error"><WifiOff size={18} />Sem conexão. O acesso precisa da internet.</div>}
                <button className="button button-primary operation-submit" disabled={!online || !collaboratorId || pin.length < 4 || loginBusy} onClick={() => void enter()}>{loginBusy ? "Validando…" : "Entrar nesta câmara"}<ChevronRight size={20} /></button>
              </>
            )}
          </section>
        </main>
        <footer className="operation-footer">O PIN é validado de forma segura e não fica salvo neste aparelho.</footer>
      </div>
    );
  }

  const totalBase = selectedProduct && selectedVariant
    ? selectedProduct.kind === "saborizado"
      ? Number(quantity || 0)
      : Number(quantity || 0) * (selectedVariant.gramsPerPackage ?? 0)
    : 0;
  const expiresAt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Cuiaba" }).format(current.expiresAt);
  const isLoss = action === "loss";
  const actionAllowed = action === "production" ? current.canProduce : action === "loss" ? current.canDispatch : true;

  return (
    <div className="operation-shell">
      <OfflineBanner />
      <header className="operation-header">
        <Link to="/" className="operation-brand"><span className="brand-mark"><Snowflake size={21} /></span><span><strong>Estoque</strong><b>065</b></span></Link>
        <button className="session-exit" onClick={() => void leave()}><LogOut size={16} /> Encerrar</button>
      </header>
      <div className="camera-context">
        <div><span className="context-symbol"><Snowflake size={20} /></span><div><small>Câmara atual</small><strong>{current.chamberName} — Operação</strong></div></div>
        <span className="session-state"><i /> Sessão ativa · {current.collaboratorName}</span>
      </div>

      <main className="operation-main">
        {step !== "success" && (
          <div className="step-progress" aria-label="Progresso do lançamento">
            <span className="is-complete"><Check size={14} /> Acesso</span><i />
            <span className={step !== "confirm" ? "is-current" : "is-complete"}>2. {action ? (isLoss ? "Perda" : "Produção") : "Operação"}</span><i />
            <span className={step === "confirm" ? "is-current" : ""}>3. Confirmar</span>
          </div>
        )}

        {step === "action" ? (
          <section className="operation-panel">
            <div className="operation-title"><span className="operation-title-icon"><UserRound size={24} /></span><div><p>Nova movimentação</p><h1>O que você precisa registrar?</h1><span>Seu perfil mostra apenas as operações autorizadas.</span></div></div>
            <div className="operation-action-options">
              {current.canProduce && <button onClick={() => resetAll("production")}><span className="operation-action-icon action-production"><PackagePlus size={25} /></span><span><strong>Produção</strong><small>Adicionar itens produzidos à câmara</small></span><ChevronRight size={21} /></button>}
              {current.canDispatch && <button onClick={() => resetAll("loss")}><span className="operation-action-icon action-loss"><Trash2 size={24} /></span><span><strong>Perda</strong><small>Retirar item danificado ou descartado</small></span><ChevronRight size={21} /></button>}
            </div>
          </section>
        ) : !actionAllowed ? (
          <section className="operation-panel access-error-panel"><span className="access-symbol"><UserRound size={25} /></span><h1>Operação não liberada</h1><p>Seu acesso não permite esta movimentação na câmara.</p><button className="button button-secondary" onClick={() => resetAll()}>Voltar</button></section>
        ) : step === "product" ? (
          <section className="operation-panel">
            <button className="back-button" onClick={() => resetAll()}><ArrowLeft size={18} />Trocar operação</button>
            <div className="operation-title"><span className="operation-title-icon">{isLoss ? <Trash2 size={23} /> : <PackagePlus size={24} />}</span><div><p>{isLoss ? "Perda" : "Produção"}</p><h1>{isLoss ? "O que saiu da câmara?" : "O que entrou na câmara?"}</h1><span>Escolha o produto movimentado.</span></div></div>
            {current.products.length === 0 ? <div className="empty-state compact-empty"><strong>Nenhum produto ativo</strong><p>Peça ao administrador para concluir os cadastros.</p></div> : (
              <div className="product-options">
                {current.products.map((product) => {
                  const hasVariant = product.kind === "saborizado" ? current.flavors.length > 0 : current.formats.some((item) => item.productId === product.id);
                  return <button key={product.id} disabled={!hasVariant} onClick={() => selectProduct(product.id)}><span><strong>{product.name}</strong><small>{product.kind === "saborizado" ? "Escolher sabor" : hasVariant ? "Escolher formato" : "Sem formato ativo"}</small></span><ChevronRight size={21} /></button>;
                })}
              </div>
            )}
          </section>
        ) : step === "variant" && selectedProduct ? (
          <section className="operation-panel">
            <button className="back-button" onClick={() => setStep("product")}><ArrowLeft size={18} />Trocar produto</button>
            <div className="operation-title compact"><div><p>{selectedProduct.kind === "saborizado" ? "Sabor" : "Formato"}</p><h1>{selectedProduct.kind === "saborizado" ? "Qual sabor?" : "Qual pacote?"}</h1><span>{selectedProduct.name}</span></div></div>
            <div className="product-options">{variants.map((variant) => <button key={variant.id} onClick={() => selectVariant(variant.id)}><span><strong>{variant.name}</strong><small>{variant.gramsPerPackage ? formatBaseQuantity(variant.gramsPerPackage, "grama") + " por pacote" : "Gelo saborizado"}</small></span><ChevronRight size={21} /></button>)}</div>
          </section>
        ) : step === "quantity" && selectedProduct && selectedVariant ? (
          <section className="operation-panel">
            <button className="back-button" onClick={() => setStep("variant")}><ArrowLeft size={18} />Trocar {selectedProduct.kind === "saborizado" ? "sabor" : "formato"}</button>
            <div className="selection-summary"><small>Produto selecionado</small><strong>{selectedProduct.name}</strong><span>{selectedVariant.name}</span></div>
            <label className="quantity-field"><span>Quantos pacotes {isLoss ? "saíram" : "entraram"}?</span><div><input inputMode="numeric" pattern="[0-9]*" autoFocus value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ""))} placeholder="0" /><b>pacotes</b></div><small>{selectedVariant.gramsPerPackage ? "Total calculado: " + formatBaseQuantity(totalBase, "grama") : "Informe apenas pacotes completos."}</small></label>
            {isLoss && <div className="loss-fields"><label className="field"><span>Motivo da perda</span><select value={lossReasonId} onChange={(event) => setLossReasonId(event.target.value)} required><option value="">Selecione</option>{current.lossReasons.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Observação (opcional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Detalhes sobre a ocorrência" /></label>{current.lossReasons.length === 0 && <div className="inline-error"><ShieldAlert size={18} />Peça ao administrador para cadastrar um motivo de perda.</div>}</div>}
            <button className="button button-primary operation-submit" disabled={!quantity || Number(quantity) <= 0 || (isLoss && !lossReasonId)} onClick={() => setStep("confirm")}>Revisar lançamento <ChevronRight size={20} /></button>
          </section>
        ) : step === "confirm" && selectedProduct && selectedVariant ? (
          <section className="operation-panel">
            <button className="back-button" onClick={() => setStep("quantity")}><ArrowLeft size={18} />Corrigir lançamento</button>
            <div className="operation-title compact"><div><p>Confirmação</p><h1>Confira antes de registrar</h1><span>{isLoss ? "A saída" : "A entrada"} será gravada no histórico imutável.</span></div></div>
            <dl className="confirmation-list"><div><dt>Câmara</dt><dd>{current.chamberName}</dd></div><div><dt>Movimentação</dt><dd>{isLoss ? "Saída por perda" : "Entrada de produção"}</dd></div><div><dt>Produto</dt><dd>{selectedProduct.name} · {selectedVariant.name}</dd></div>{isLoss && <div><dt>Motivo</dt><dd>{selectedLossReason?.name}</dd></div>}<div className="confirmation-total"><dt>Quantidade</dt><dd>{quantity} pacotes{selectedVariant.gramsPerPackage ? " · " + formatBaseQuantity(totalBase, "grama") : ""}</dd></div><div><dt>Responsável</dt><dd>{current.collaboratorName}</dd></div></dl>
            {!online && <div className="inline-error"><WifiOff size={18} />Sem conexão. Aguarde a internet voltar para registrar.</div>}
            {submitError && <div className="inline-error" role="alert"><ShieldAlert size={18} />{submitError}</div>}
            <button className="button button-primary operation-submit" disabled={!online || saving} onClick={() => void submit()}><Check size={20} />{saving ? "Registrando…" : isLoss ? "Confirmar perda" : "Confirmar entrada"}</button>
          </section>
        ) : step === "success" && selectedProduct && selectedVariant && receipt ? (
          <section className="operation-panel success-panel">
            <span className="success-symbol"><CircleCheck size={38} /></span><p>{isLoss ? "Perda registrada" : "Entrada registrada"}</p><h1>{quantity} pacotes {isLoss ? "retirados" : "adicionados"}</h1><span>{selectedProduct.name} · {selectedVariant.name}</span>
            <div className="success-note"><strong>Saldo atualizado em tempo real.</strong><span>Registro {receipt.movementId.slice(-8)} · {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Cuiaba" }).format(receipt.occurredAt)}</span></div>
            <button className="button button-primary operation-submit" onClick={() => resetAll(action)}>Registrar outra {isLoss ? "perda" : "produção"}</button>
            <button className="text-button operation-another-action" onClick={() => resetAll()}>Escolher outra operação</button>
          </section>
        ) : null}
      </main>
      <footer className="operation-footer">Sessão vinculada a {current.chamberName} · expira às {expiresAt}</footer>
    </div>
  );
}

function IntegrationRequired() {
  return <div className="operation-shell"><header className="operation-header"><Link to="/" className="operation-brand"><span className="brand-mark"><Snowflake size={21} /></span><span><strong>Estoque</strong><b>065</b></span></Link></header><main className="operation-main"><section className="operation-panel access-error-panel"><span className="access-symbol"><WifiOff size={25} /></span><h1>Ambiente não configurado</h1><p>Clerk e Convex precisam estar configurados para registrar operações reais.</p></section></main></div>;
}

export function OperationPage({ integrationsReady }: OperationPageProps) {
  const { cameraToken } = useParams();
  if (!integrationsReady || !cameraToken) return <IntegrationRequired />;
  return <ConnectedOperation chamberToken={cameraToken} />;
}
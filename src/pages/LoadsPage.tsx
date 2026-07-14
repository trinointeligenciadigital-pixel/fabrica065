import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Check,
  CircleCheck,
  PackagePlus,
  RotateCcw,
  Truck,
  Undo2,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AdminShell } from "../components/AdminShell";
import { formatBaseQuantity, type BaseUnit } from "../lib/quantity";
import { useOnlineStatus } from "../lib/useOnlineStatus";

interface LoadsPageProps {
  integrationsReady: boolean;
}

type LoadType = "venda" | "patrocinio";
type TransportType = "proprio" | "terceiro";
type View = "new" | "history";

interface ManifestItem {
  key: string;
  productId: string;
  flavorId?: string;
  packageFormatId?: string;
  productName: string;
  variantName: string;
  quantityPackages: number;
  quantityBase: number;
  baseUnit: BaseUnit;
}

function loadError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes("INSUFFICIENT_STOCK")) return "Um ou mais itens não possuem saldo suficiente. Nenhuma saída foi gravada.";
  if (text.includes("RETURN_EXCEEDS_ORIGINAL")) return "O retorno informado supera o saldo retornável deste item.";
  if (text.includes("CHAMBER_UNDER_COUNT")) return "A câmara está em contagem física e não aceita movimentações.";
  if (text.includes("EVENT_REQUIRED")) return "Informe o nome do evento patrocinado.";
  if (text.includes("INVALID_TRANSPORT")) return "Informe um veículo próprio ou todos os dados do veículo terceiro.";
  if (text.includes("INVALID_PLATE")) return "Informe uma placa brasileira válida.";
  if (text.includes("DUPLICATE_LOAD_ITEM")) return "O mesmo produto e formato aparece mais de uma vez no manifesto.";
  if (text.includes("SPONSORSHIP_REQUIRED")) return "Somente carregamentos de patrocínio aceitam retorno.";
  if (text.includes("INACTIVE_REFERENCE")) return "Um cadastro selecionado foi inativado. Atualize o formulário.";
  return "Não foi possível registrar. Revise os dados e tente novamente.";
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Cuiaba" }).format(value);
}

function ConnectedLoads() {
  const online = useOnlineStatus();
  const options = useQuery(api.loads.options);
  const loads = useQuery(api.loads.list);
  const registerLoad = useMutation(api.loads.register);
  const registerReturn = useMutation(api.loads.registerReturn);
  const [view, setView] = useState<View>("new");
  const [type, setType] = useState<LoadType>("venda");
  const [chamberId, setChamberId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [eventName, setEventName] = useState("");
  const [transportType, setTransportType] = useState<TransportType>("proprio");
  const [vehicleId, setVehicleId] = useState("");
  const [thirdPartyPlate, setThirdPartyPlate] = useState("");
  const [thirdPartyDescription, setThirdPartyDescription] = useState("");
  const [driver, setDriver] = useState("");
  const [responsible, setResponsible] = useState("");
  const [productId, setProductId] = useState("");
  const [flavorId, setFlavorId] = useState("");
  const [formatId, setFormatId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [manifest, setManifest] = useState<ManifestItem[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ id: string; occurredAt: number; itemCount: number }>();
  const [returnLoadId, setReturnLoadId] = useState("");
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
  const [returnRequestId, setReturnRequestId] = useState("");
  const [returnSaving, setReturnSaving] = useState(false);
  const [returnFeedback, setReturnFeedback] = useState("");

  const product = options?.products.find((item) => item.id === productId);
  const flavor = options?.flavors.find((item) => item.id === flavorId);
  const format = options?.formats.find((item) => item.id === formatId);
  const formats = options?.formats.filter((item) => item.productId === productId) ?? [];
  const selectedReturnLoad = loads?.find((item) => item.id === returnLoadId);
  const manifestTotalBase = useMemo(() => manifest.reduce((total, item) => total + item.quantityBase, 0), [manifest]);
  const transportValid = transportType === "proprio" ? Boolean(vehicleId) : Boolean(thirdPartyPlate.trim() && thirdPartyDescription.trim());
  const formValid = Boolean(chamberId && customerId && driver.trim().length >= 2 && responsible.trim().length >= 2 && transportValid && manifest.length > 0 && (type === "venda" || eventName.trim().length >= 3));

  function changeView(next: View) {
    setView(next);
    setError("");
    setReturnFeedback("");
  }

  function resetAll() {
    setType("venda"); setChamberId(""); setCustomerId(""); setEventName("");
    setTransportType("proprio"); setVehicleId(""); setThirdPartyPlate(""); setThirdPartyDescription("");
    setDriver(""); setResponsible(""); setProductId(""); setFlavorId(""); setFormatId(""); setQuantity("");
    setManifest([]); setReviewing(false); setRequestId(""); setError(""); setReceipt(undefined);
  }

  function addItem(event: FormEvent) {
    event.preventDefault();
    if (!product) return;
    const quantityPackages = Number(quantity);
    const variantValid = product.kind === "saborizado" ? Boolean(flavor) : Boolean(format);
    if (!Number.isSafeInteger(quantityPackages) || quantityPackages <= 0 || !variantValid) return;
    const key = `${product.id}:${flavor?.id ?? "none"}:${format?.id ?? "none"}`;
    if (manifest.some((item) => item.key === key)) {
      setError("Este produto e formato já está no manifesto. Remova a linha para alterar a quantidade.");
      return;
    }
    const quantityBase = product.kind === "saborizado" ? quantityPackages : quantityPackages * (format?.gramsPerPackage ?? 0);
    setManifest((items) => [...items, {
      key,
      productId: product.id,
      flavorId: flavor?.id,
      packageFormatId: format?.id,
      productName: product.name,
      variantName: flavor?.name ?? format?.name ?? "Unidade base",
      quantityPackages,
      quantityBase,
      baseUnit: product.baseUnit,
    }]);
    setProductId(""); setFlavorId(""); setFormatId(""); setQuantity(""); setError("");
  }

  async function submitLoad() {
    if (!formValid || !online) return;
    const stableRequestId = requestId || crypto.randomUUID();
    setRequestId(stableRequestId); setSaving(true); setError("");
    try {
      const result = await registerLoad({
        type,
        chamberId: chamberId as Id<"chambers">,
        customerId: customerId as Id<"customers">,
        ownVehicleId: transportType === "proprio" ? vehicleId as Id<"vehicles"> : undefined,
        thirdPartyPlate: transportType === "terceiro" ? thirdPartyPlate : undefined,
        thirdPartyDescription: transportType === "terceiro" ? thirdPartyDescription : undefined,
        driver,
        responsible,
        eventName: type === "patrocinio" ? eventName : undefined,
        items: manifest.map((item) => ({
          productId: item.productId as Id<"products">,
          flavorId: item.flavorId ? item.flavorId as Id<"flavors"> : undefined,
          packageFormatId: item.packageFormatId ? item.packageFormatId as Id<"packageFormats"> : undefined,
          quantityPackages: item.quantityPackages,
        })),
        requestId: stableRequestId,
      });
      setReceipt({ id: String(result.loadId), occurredAt: result.occurredAt, itemCount: result.itemCount });
      setReviewing(false);
    } catch (submitError) {
      setError(loadError(submitError));
    } finally {
      setSaving(false);
    }
  }

  function beginReturn(loadId: string) {
    setReturnLoadId(loadId); setReturnQuantities({}); setReturnRequestId(""); setReturnFeedback("");
  }

  async function submitReturn() {
    if (!selectedReturnLoad || !online) return;
    const items = selectedReturnLoad.items
      .map((item) => ({ loadItemId: item.id as Id<"loadItems">, quantityPackages: Number(returnQuantities[item.id] || 0), maximum: item.returnablePackages }))
      .filter((item) => item.quantityPackages > 0);
    if (items.length === 0 || items.some((item) => !Number.isSafeInteger(item.quantityPackages) || item.quantityPackages > item.maximum)) {
      setReturnFeedback("Informe ao menos uma quantidade válida dentro do limite retornável.");
      return;
    }
    const stableRequestId = returnRequestId || crypto.randomUUID();
    setReturnRequestId(stableRequestId); setReturnSaving(true); setReturnFeedback("");
    try {
      const result = await registerReturn({
        loadId: selectedReturnLoad.id as Id<"loads">,
        items: items.map(({ loadItemId, quantityPackages }) => ({ loadItemId, quantityPackages })),
        requestId: stableRequestId,
      });
      setReturnFeedback(`Retorno registrado · ${result.itemCount} ${result.itemCount === 1 ? "item" : "itens"}.`);
      setReturnLoadId(""); setReturnQuantities({}); setReturnRequestId("");
    } catch (submitError) {
      setReturnFeedback(loadError(submitError));
    } finally {
      setReturnSaving(false);
    }
  }

  if (options === undefined || loads === undefined) {
    return <AdminShell integrationsReady><div className="movement-entry-loading" role="status"><span className="loading-spinner" /><span>Carregando carregamentos…</span></div></AdminShell>;
  }

  const selectedChamber = options.chambers.find((item) => item.id === chamberId);
  const selectedCustomer = options.customers.find((item) => item.id === customerId);
  const selectedVehicle = options.vehicles.find((item) => item.id === vehicleId);

  return (
    <AdminShell integrationsReady>
      <section className="page-heading register-heading"><div><p className="eyebrow">Expedição</p><h1>Carregamentos</h1><p>Vendas e patrocínios saem como um manifesto único e auditável.</p></div></section>
      <div className="movement-mode-tabs load-tabs" role="tablist" aria-label="Carregamentos">
        <button className={view === "new" ? "is-active" : ""} onClick={() => changeView("new")}><Truck size={18} /> Nova saída</button>
        <button className={view === "history" ? "is-active" : ""} onClick={() => changeView("history")}><Undo2 size={18} /> Histórico e retornos</button>
      </div>

      {view === "new" ? (
        <section className="content-section load-workspace">
          {receipt ? (
            <div className="admin-receipt"><span className="success-symbol"><CircleCheck size={38} /></span><p>Carregamento registrado</p><h2>{type === "venda" ? "Venda liberada" : "Patrocínio liberado"}</h2><span>{receipt.itemCount} {receipt.itemCount === 1 ? "item" : "itens"} · {selectedChamber?.name}</span><div className="success-note"><strong>Todos os saldos foram atualizados juntos.</strong><span>Manifesto {receipt.id.slice(-8)} · {formatDate(receipt.occurredAt)}</span></div><button className="button button-primary" onClick={resetAll}><RotateCcw size={18} /> Novo carregamento</button></div>
          ) : reviewing ? (
            <div className="load-review">
              <div className="load-review-heading"><div><p className="eyebrow">Manifesto pronto</p><h2>Confira a saída completa</h2><span>Se um item falhar, nenhum será debitado.</span></div><span className={`load-type-stamp stamp-${type}`}>{type === "venda" ? "VENDA" : "PATROCÍNIO"}</span></div>
              <dl className="load-meta-review"><div><dt>Câmara</dt><dd>{selectedChamber?.name}</dd></div><div><dt>Cliente</dt><dd>{selectedCustomer?.name}</dd></div><div><dt>Transporte</dt><dd>{transportType === "proprio" ? `${selectedVehicle?.plate} · ${selectedVehicle?.description}` : `${thirdPartyPlate} · ${thirdPartyDescription}`}</dd></div><div><dt>Motorista</dt><dd>{driver}</dd></div><div><dt>Responsável</dt><dd>{responsible}</dd></div>{type === "patrocinio" && <div><dt>Evento</dt><dd>{eventName}</dd></div>}</dl>
              <div className="manifest-table"><div className="manifest-head"><span>Item</span><span>Pacotes</span><span>Unidade base</span></div>{manifest.map((item) => <div className="manifest-row" key={item.key}><span><strong>{item.productName}</strong><small>{item.variantName}</small></span><b>{item.quantityPackages}</b><b>{formatBaseQuantity(item.quantityBase, item.baseUnit)}</b></div>)}</div>
              {!online && <div className="inline-error"><AlertTriangle size={18} />Sem conexão. Aguarde para liberar a saída.</div>}{error && <div className="inline-error" role="alert"><AlertTriangle size={18} />{error}</div>}
              <div className="movement-review-actions"><button className="button button-secondary" onClick={() => setReviewing(false)}>Voltar e corrigir</button><button className="button button-primary" disabled={!online || saving} onClick={() => void submitLoad()}><Check size={18} />{saving ? "Registrando…" : "Confirmar saída"}</button></div>
            </div>
          ) : (
            <form className="load-form" onSubmit={(event) => { event.preventDefault(); if (formValid) setReviewing(true); }}>
              <div className="load-section"><div className="load-section-title"><span>1</span><div><h2>Destino da saída</h2><p>Defina a operação, a câmara e quem recebe.</p></div></div><div className="movement-form-grid"><label className="field"><span>Tipo</span><select value={type} onChange={(event) => { setType(event.target.value as LoadType); setEventName(""); }}><option value="venda">Venda</option><option value="patrocinio">Patrocínio</option></select></label><label className="field"><span>Câmara</span><select value={chamberId} onChange={(event) => setChamberId(event.target.value)} required><option value="">Selecione</option>{options.chambers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Cliente ou parceiro</span><select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required><option value="">Selecione</option>{options.customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{type === "patrocinio" && <label className="field"><span>Nome do evento</span><input value={eventName} onChange={(event) => setEventName(event.target.value)} placeholder="Ex.: Festival de Inverno" required /></label>}</div></div>

              <div className="load-section"><div className="load-section-title"><span>2</span><div><h2>Transporte e responsabilidade</h2><p>Registre quem leva e quem libera o carregamento.</p></div></div><div className="transport-toggle"><button type="button" className={transportType === "proprio" ? "is-active" : ""} onClick={() => setTransportType("proprio")}>Veículo próprio</button><button type="button" className={transportType === "terceiro" ? "is-active" : ""} onClick={() => setTransportType("terceiro")}>Veículo terceiro</button></div><div className="movement-form-grid">{transportType === "proprio" ? <label className="field"><span>Veículo</span><select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} required><option value="">Selecione</option>{options.vehicles.map((item) => <option key={item.id} value={item.id}>{item.plate} · {item.description}</option>)}</select></label> : <><label className="field"><span>Placa</span><input value={thirdPartyPlate} onChange={(event) => setThirdPartyPlate(event.target.value.toUpperCase())} placeholder="ABC1D23" maxLength={8} required /></label><label className="field"><span>Descrição</span><input value={thirdPartyDescription} onChange={(event) => setThirdPartyDescription(event.target.value)} placeholder="Ex.: Caminhão branco" required /></label></>}<label className="field"><span>Motorista</span><input value={driver} onChange={(event) => setDriver(event.target.value)} placeholder="Nome de quem dirige" required /></label><label className="field"><span>Responsável pela saída</span><input value={responsible} onChange={(event) => setResponsible(event.target.value)} placeholder="Nome de quem conferiu" required /></label></div></div>

              <div className="load-section"><div className="load-section-title"><span>3</span><div><h2>Manifesto de itens</h2><p>Monte a carga linha por linha antes de conferir.</p></div></div><div className="manifest-builder"><div className="manifest-builder-fields"><label className="field"><span>Produto</span><select value={productId} onChange={(event) => { setProductId(event.target.value); setFlavorId(""); setFormatId(""); }}><option value="">Selecione</option>{options.products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{product?.kind === "saborizado" ? <label className="field"><span>Sabor</span><select value={flavorId} onChange={(event) => setFlavorId(event.target.value)}><option value="">Selecione</option>{options.flavors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : product ? <label className="field"><span>Formato</span><select value={formatId} onChange={(event) => setFormatId(event.target.value)}><option value="">Selecione</option>{formats.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatBaseQuantity(item.gramsPerPackage, "grama")}</option>)}</select></label> : <label className="field"><span>Apresentação</span><select disabled><option>Escolha o produto</option></select></label>}<label className="field"><span>Pacotes</span><input type="number" min="1" step="1" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><button type="button" className="button button-secondary" onClick={addItem}><PackagePlus size={18} /> Adicionar</button></div>
                {manifest.length === 0 ? <div className="manifest-empty"><Truck size={24} /><strong>Manifesto vazio</strong><span>Adicione os produtos que sairão nesta viagem.</span></div> : <div className="manifest-table editable-manifest"><div className="manifest-head"><span>Item</span><span>Pacotes</span><span>Unidade base</span><span /></div>{manifest.map((item) => <div className="manifest-row" key={item.key}><span><strong>{item.productName}</strong><small>{item.variantName}</small></span><b>{item.quantityPackages}</b><b>{formatBaseQuantity(item.quantityBase, item.baseUnit)}</b><button type="button" aria-label={`Remover ${item.productName}`} onClick={() => setManifest((items) => items.filter((current) => current.key !== item.key))}><X size={16} /></button></div>)}</div>}
              </div></div>
              {error && <div className="inline-error" role="alert"><AlertTriangle size={18} />{error}</div>}
              <div className="load-form-footer"><span><b>{manifest.length}</b> {manifest.length === 1 ? "linha" : "linhas"} no manifesto · total bruto {new Intl.NumberFormat("pt-BR").format(manifestTotalBase)} em unidades-base</span><button className="button button-primary" disabled={!formValid}>Revisar manifesto <ArrowRight size={18} /></button></div>
            </form>
          )}
        </section>
      ) : (
        <section className="load-history">
          {returnFeedback && <div className={returnFeedback.startsWith("Retorno registrado") ? "load-feedback is-success" : "inline-error"}>{returnFeedback.startsWith("Retorno registrado") ? <CircleCheck size={18} /> : <AlertTriangle size={18} />}{returnFeedback}</div>}
          {loads.length === 0 ? <div className="content-section empty-state"><Truck size={27} /><strong>Nenhum carregamento registrado</strong><p>O primeiro manifesto aparecerá aqui após a confirmação.</p></div> : loads.map((load) => (
            <article className="content-section load-card" key={load.id}>
              <header><div><span className={`load-type-stamp stamp-${load.type}`}>{load.type === "venda" ? "VENDA" : "PATROCÍNIO"}</span><h2>{load.customerName}</h2><p>{load.chamberName} · {formatDate(load.occurredAt)}</p></div><div className="load-card-code"><span>Manifesto</span><b>{String(load.id).slice(-8)}</b></div></header>
              <div className="load-card-meta"><span><b>Transporte</b>{load.transport}</span><span><b>Motorista</b>{load.driver}</span><span><b>Responsável</b>{load.responsible}</span>{load.eventName && <span><b>Evento</b>{load.eventName}</span>}</div>
              <div className="manifest-table"><div className="manifest-head"><span>Item</span><span>Saída</span><span>{load.type === "patrocinio" ? "Retornável" : "Unidade base"}</span></div>{load.items.map((item) => <div className="manifest-row" key={item.id}><span><strong>{item.productName}</strong><small>{item.flavorName ?? item.formatName}</small></span><b>{item.quantityPackages} pct.</b><b>{load.type === "patrocinio" ? `${item.returnablePackages} pct.` : formatBaseQuantity(item.quantityBase, item.baseUnit)}</b></div>)}</div>
              {load.returns.length > 0 && <div className="return-chain"><p>Cadeia de retornos</p>{load.returns.map((returnRecord) => <div className="return-chain-row" key={returnRecord.id}><span className="return-chain-dot" /><div><strong>{formatDate(returnRecord.occurredAt)} · {returnRecord.author}</strong><span>{returnRecord.items.map((item) => `${item.productName}${item.variantName ? " · " + item.variantName : ""}: ${item.quantityPackages} pct.`).join(" | ")}</span></div></div>)}</div>}
              <footer><span>Registrado por {load.author}{load.returnCount > 0 ? ` · ${load.returnCount} ${load.returnCount === 1 ? "retorno" : "retornos"}` : ""}</span>{load.type === "patrocinio" && load.items.some((item) => item.returnablePackages > 0) && <button className="button button-secondary button-compact" onClick={() => beginReturn(load.id)}><Undo2 size={16} /> Registrar retorno</button>}</footer>
              {returnLoadId === load.id && <div className="return-editor"><div className="load-section-title"><span><Undo2 size={16} /></span><div><h3>Retorno do patrocínio</h3><p>Informe somente o que voltou em boas condições.</p></div></div>{load.items.map((item) => <label className="return-row" key={item.id}><span><strong>{item.productName}</strong><small>{item.flavorName ?? item.formatName} · máximo {item.returnablePackages} pacotes</small></span><input type="number" min="0" max={item.returnablePackages} step="1" inputMode="numeric" value={returnQuantities[item.id] ?? ""} onChange={(event) => setReturnQuantities((values) => ({ ...values, [item.id]: event.target.value }))} placeholder="0" /></label>)}<div className="movement-review-actions"><button className="button button-secondary" onClick={() => setReturnLoadId("")}>Cancelar</button><button className="button button-primary" disabled={!online || returnSaving} onClick={() => void submitReturn()}><ArrowDownToLine size={18} />{returnSaving ? "Registrando…" : "Confirmar retorno"}</button></div></div>}
            </article>
          ))}
        </section>
      )}
    </AdminShell>
  );
}

export function LoadsPage({ integrationsReady }: LoadsPageProps) {
  if (!integrationsReady) return <AdminShell integrationsReady={false}><section className="page-heading"><div><p className="eyebrow">Expedição</p><h1>Carregamentos</h1><p>Conecte Clerk e Convex para registrar saídas reais.</p></div></section></AdminShell>;
  return <ConnectedLoads />;
}
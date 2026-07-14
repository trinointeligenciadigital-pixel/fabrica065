import { useMutation, useQuery } from "convex/react";
import { ArchiveRestore, Building2, PackageOpen, Pencil, Plus, Save, Scale, Tag, Trash2, Truck, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AdminShell } from "../components/AdminShell";

export type SetupSection = "formats" | "vehicles" | "customers" | "losses" | "minimums";

interface SetupPageProps {
  section: SetupSection;
  integrationsReady: boolean;
}

const copy = {
  formats: ["Formatos de pacote", "Converta apresentações de gelo em cubo ou escamado para o peso-base em gramas."],
  vehicles: ["Veículos próprios", "Mantenha a frota disponível para carregamentos e entregas."],
  customers: ["Clientes", "Cadastre destinatários de vendas e patrocínios."],
  losses: ["Motivos de perda", "Padronize os motivos usados nos lançamentos de descarte."],
  minimums: ["Estoque mínimo", "Defina o limite visual por câmara, produto e sabor opcional."],
} as const;

function messageFor(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes("DUPLICATE_NAME")) return "Já existe um cadastro com esse nome.";
  if (text.includes("DUPLICATE_PLATE")) return "Esta placa já está cadastrada.";
  if (text.includes("INVALID_PLATE")) return "Informe uma placa brasileira válida.";
  if (text.includes("INVALID_WEIGHT")) return "Informe um peso maior que zero.";
  if (text.includes("INVALID_MINIMUM")) return "Informe um mínimo maior que zero.";
  if (text.includes("FORMAT_NOT_ALLOWED")) return "Formatos em kg são usados apenas em produtos de cubo ou escamado.";
  if (text.includes("FLAVOR_REQUIRED")) return "Selecione o sabor para este produto.";
  if (text.includes("INVALID_NAME")) return "Informe um nome entre 2 e 80 caracteres.";
  if (text.includes("INVALID_DOCUMENT")) return "O documento deve ter no máximo 30 caracteres.";
  if (text.includes("NOT_FOUND")) return "Este cadastro não existe mais. Atualize a página.";
  return "Não foi possível salvar. Tente novamente.";
}

function LoadingRows() {
  return <div className="table-loading" role="status"><span className="skeleton-line skeleton-wide" /><span className="skeleton-line" /><span className="sr-only">Carregando</span></div>;
}

function EmptyRows({ text }: { text: string }) {
  return <div className="empty-state"><span className="empty-symbol"><Plus size={21} /></span><strong>Nenhum registro</strong><p>{text}</p></div>;
}

function Status({ active }: { active: boolean }) {
  return <span className={"badge badge-" + (active ? "ok" : "inactive")}>{active ? "Ativo" : "Inativo"}</span>;
}

function SetupTabs() {
  return (
    <nav className="catalog-tabs setup-tabs" aria-label="Preparação operacional">
      <NavLink to="/configuracoes/formatos"><PackageOpen size={17} /> Formatos</NavLink>
      <NavLink to="/configuracoes/veiculos"><Truck size={17} /> Veículos</NavLink>
      <NavLink to="/configuracoes/clientes"><Building2 size={17} /> Clientes</NavLink>
      <NavLink to="/configuracoes/perdas"><Tag size={17} /> Perdas</NavLink>
      <NavLink to="/configuracoes/minimos"><Scale size={17} /> Mínimos</NavLink>
    </nav>
  );
}

function FormatsPanel() {
  const formats = useQuery(api.configuration.listPackageFormats);
  const options = useQuery(api.configuration.minimumOptions);
  const create = useMutation(api.configuration.createPackageFormat);
  const toggle = useMutation(api.configuration.setPackageFormatActive);
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const products = options?.products.filter((item) => item.baseUnit === "grama") ?? [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback("");
    try {
      const gramsPerPackage = Math.round(Number(weightKg.replace(",", ".")) * 1000);
      await create({ productId: productId as Id<"products">, name, gramsPerPackage });
      setName("");
      setWeightKg("");
      setFeedback("Formato cadastrado.");
    } catch (error) {
      setFeedback(messageFor(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form className="register-form setup-form" onSubmit={submit}>
        <label className="field"><span>Produto</span><select value={productId} onChange={(event) => setProductId(event.target.value)} required><option value="">Selecione</option>{products.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
        <label className="field"><span>Nome do formato</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Pacote 5 kg" required /></label>
        <label className="field"><span>Peso (kg)</span><input type="number" min="0.001" step="0.001" inputMode="decimal" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} placeholder="5" required /></label>
        <button className="button button-primary" disabled={saving || products.length === 0}><Plus size={18} />{saving ? "Salvando…" : "Cadastrar"}</button>
      </form>
      {products.length === 0 && options !== undefined && <p className="form-hint">Cadastre primeiro um produto do tipo cubo ou escamado.</p>}
      <p className="form-feedback" aria-live="polite">{feedback}</p>
      {formats === undefined ? <LoadingRows /> : formats.length === 0 ? <EmptyRows text="Cadastre a primeira apresentação e seu peso exato." /> : (
        <div className="table-wrap"><table><thead><tr><th>Produto</th><th>Formato</th><th className="numeric">Peso</th><th>Situação</th><th className="table-action">Ação</th></tr></thead><tbody>
          {formats.map((item) => <tr key={item._id}><td><strong>{item.productName}</strong></td><td>{item.name}</td><td className="numeric data-number">{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(item.gramsPerPackage / 1000)} kg</td><td><Status active={item.active} /></td><td className="table-action"><button className="row-action" onClick={() => void toggle({ id: item._id, active: !item.active })}><ArchiveRestore size={15} />{item.active ? "Inativar" : "Reativar"}</button></td></tr>)}
        </tbody></table></div>
      )}
    </>
  );
}

function VehiclesPanel() {
  const items = useQuery(api.configuration.listVehicles);
  const create = useMutation(api.configuration.createVehicle);
  const update = useMutation(api.configuration.updateVehicle);
  const toggle = useMutation(api.configuration.setVehicleActive);
  const [plate, setPlate] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<{ id: Id<"vehicles">; plate: string; description: string }>();
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setFeedback("");
    try { await create({ plate, description }); setPlate(""); setDescription(""); setFeedback("Veículo cadastrado."); }
    catch (error) { setFeedback(messageFor(error)); } finally { setSaving(false); }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault(); if (!editing) return; setSaving(true); setFeedback("");
    try { await update(editing); setEditing(undefined); setFeedback("Veículo atualizado com sucesso."); }
    catch (error) { setFeedback(messageFor(error)); } finally { setSaving(false); }
  }

  async function toggleItem(id: Id<"vehicles">, active: boolean) {
    setFeedback("");
    try { await toggle({ id, active }); setFeedback(active ? "Veículo reativado." : "Veículo inativado."); }
    catch (error) { setFeedback(messageFor(error)); }
  }

  return (
    <>
      <form className="register-form register-form-simple entity-form" onSubmit={submit}>
        <label className="field"><span>Placa</span><input value={plate} onChange={(event) => setPlate(event.target.value.toUpperCase())} placeholder="ABC1D23" maxLength={8} required /></label>
        <label className="field"><span>Descrição</span><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Caminhão baú" minLength={2} maxLength={80} required /></label>
        <button className="button button-primary" disabled={saving}><Plus size={18} />{saving ? "Salvando…" : "Cadastrar"}</button>
      </form>
      <p className="form-feedback" aria-live="polite">{feedback}</p>
      {editing && (
        <form className="register-editor" onSubmit={saveEdit}>
          <div className="register-editor-heading"><div><span>Editando veículo</span><strong>{editing.plate}</strong></div><button className="icon-button" type="button" onClick={() => setEditing(undefined)} aria-label="Cancelar edição"><X size={17} /></button></div>
          <label className="field"><span>Placa</span><input autoFocus value={editing.plate} onChange={(event) => setEditing({ ...editing, plate: event.target.value.toUpperCase() })} maxLength={8} required /></label>
          <label className="field"><span>Descrição</span><input value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} minLength={2} maxLength={80} required /></label>
          <div className="register-editor-actions"><button className="button button-secondary" type="button" onClick={() => setEditing(undefined)}>Cancelar</button><button className="button button-primary" disabled={saving}><Save size={17} />{saving ? "Salvando…" : "Salvar alterações"}</button></div>
        </form>
      )}
      {items === undefined ? <LoadingRows /> : items.length === 0 ? <EmptyRows text="Cadastre o primeiro veículo próprio." /> : (
        <div className="table-wrap"><table><thead><tr><th>Placa</th><th>Descrição</th><th>Situação</th><th className="table-action">Ações</th></tr></thead><tbody>
          {items.map((item) => <tr key={item._id}><td className="data-number"><strong>{item.plate}</strong></td><td>{item.description}</td><td><Status active={item.active} /></td><td className="table-action"><div className="row-actions"><button className="row-action" onClick={() => { setEditing({ id: item._id, plate: item.plate, description: item.description }); setFeedback(""); }}><Pencil size={15} />Editar</button><button className="row-action" onClick={() => void toggleItem(item._id, !item.active)}><ArchiveRestore size={15} />{item.active ? "Inativar" : "Reativar"}</button></div></td></tr>)}
        </tbody></table></div>
      )}
    </>
  );
}

function CustomersPanel() {
  const items = useQuery(api.configuration.listCustomers);
  const create = useMutation(api.configuration.createCustomer);
  const update = useMutation(api.configuration.updateCustomer);
  const toggle = useMutation(api.configuration.setCustomerActive);
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [editing, setEditing] = useState<{ id: Id<"customers">; name: string; document: string }>();
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setFeedback("");
    try { await create({ name, document: document || undefined }); setName(""); setDocument(""); setFeedback("Cliente cadastrado."); }
    catch (error) { setFeedback(messageFor(error)); } finally { setSaving(false); }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault(); if (!editing) return; setSaving(true); setFeedback("");
    try { await update({ ...editing, document: editing.document || undefined }); setEditing(undefined); setFeedback("Cliente atualizado com sucesso."); }
    catch (error) { setFeedback(messageFor(error)); } finally { setSaving(false); }
  }

  async function toggleItem(id: Id<"customers">, active: boolean) {
    setFeedback("");
    try { await toggle({ id, active }); setFeedback(active ? "Cliente reativado." : "Cliente inativado."); }
    catch (error) { setFeedback(messageFor(error)); }
  }

  return (
    <>
      <form className="register-form register-form-simple entity-form" onSubmit={submit}>
        <label className="field"><span>Nome</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome ou razão social" minLength={2} maxLength={80} required /></label>
        <label className="field"><span>Documento (opcional)</span><input value={document} onChange={(event) => setDocument(event.target.value)} placeholder="CPF ou CNPJ" maxLength={30} /></label>
        <button className="button button-primary" disabled={saving}><Plus size={18} />{saving ? "Salvando…" : "Cadastrar"}</button>
      </form>
      <p className="form-feedback" aria-live="polite">{feedback}</p>
      {editing && (
        <form className="register-editor" onSubmit={saveEdit}>
          <div className="register-editor-heading"><div><span>Editando cliente</span><strong>{editing.name}</strong></div><button className="icon-button" type="button" onClick={() => setEditing(undefined)} aria-label="Cancelar edição"><X size={17} /></button></div>
          <label className="field"><span>Nome ou razão social</span><input autoFocus value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} minLength={2} maxLength={80} required /></label>
          <label className="field"><span>Documento (opcional)</span><input value={editing.document} onChange={(event) => setEditing({ ...editing, document: event.target.value })} maxLength={30} /></label>
          <div className="register-editor-actions"><button className="button button-secondary" type="button" onClick={() => setEditing(undefined)}>Cancelar</button><button className="button button-primary" disabled={saving}><Save size={17} />{saving ? "Salvando…" : "Salvar alterações"}</button></div>
        </form>
      )}
      {items === undefined ? <LoadingRows /> : items.length === 0 ? <EmptyRows text="Cadastre o primeiro cliente ou parceiro." /> : (
        <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Documento</th><th>Situação</th><th className="table-action">Ações</th></tr></thead><tbody>
          {items.map((item) => <tr key={item._id}><td><strong>{item.name}</strong></td><td className="muted-cell">{item.document ?? "Não informado"}</td><td><Status active={item.active} /></td><td className="table-action"><div className="row-actions"><button className="row-action" onClick={() => { setEditing({ id: item._id, name: item.name, document: item.document ?? "" }); setFeedback(""); }}><Pencil size={15} />Editar</button><button className="row-action" onClick={() => void toggleItem(item._id, !item.active)}><ArchiveRestore size={15} />{item.active ? "Inativar" : "Reativar"}</button></div></td></tr>)}
        </tbody></table></div>
      )}
    </>
  );
}

function LossesPanel() {
  const items = useQuery(api.configuration.listLossReasons);
  const create = useMutation(api.configuration.createLossReason);
  const toggle = useMutation(api.configuration.setLossReasonActive);
  const [name, setName] = useState("");
  const [feedback, setFeedback] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setFeedback("");
    try { await create({ name }); setName(""); setFeedback("Motivo cadastrado."); }
    catch (error) { setFeedback(messageFor(error)); }
  }

  return (
    <>
      <form className="register-form register-form-simple" onSubmit={submit}>
        <label className="field"><span>Motivo</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Embalagem danificada" required /></label>
        <button className="button button-primary"><Plus size={18} />Cadastrar motivo</button>
      </form>
      <p className="form-feedback" aria-live="polite">{feedback}</p>
      {items === undefined ? <LoadingRows /> : items.length === 0 ? <EmptyRows text="Cadastre os motivos aceitos para perdas." /> : (
        <div className="table-wrap"><table><thead><tr><th>Motivo</th><th>Situação</th><th className="table-action">Ação</th></tr></thead><tbody>
          {items.map((item) => <tr key={item._id}><td><strong>{item.name}</strong></td><td><Status active={item.active} /></td><td className="table-action"><button className="row-action" onClick={() => void toggle({ id: item._id, active: !item.active })}><ArchiveRestore size={15} />{item.active ? "Inativar" : "Reativar"}</button></td></tr>)}
        </tbody></table></div>
      )}
    </>
  );
}

function formatMinimum(value: number, unit: "pacote" | "grama") {
  if (unit === "pacote") return new Intl.NumberFormat("pt-BR").format(value) + (value === 1 ? " pacote" : " pacotes");
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value / 1000) + " kg";
}

function MinimumsPanel() {
  const options = useQuery(api.configuration.minimumOptions);
  const items = useQuery(api.configuration.listMinimums);
  const save = useMutation(api.configuration.setMinimum);
  const remove = useMutation(api.configuration.removeMinimum);
  const [chamberId, setChamberId] = useState("");
  const [productId, setProductId] = useState("");
  const [flavorId, setFlavorId] = useState("");
  const [amount, setAmount] = useState("");
  const [feedback, setFeedback] = useState("");
  const product = options?.products.find((item) => item._id === productId);

  async function submit(event: FormEvent) {
    event.preventDefault(); setFeedback("");
    try {
      const numeric = Number(amount.replace(",", "."));
      const minimumBase = product?.baseUnit === "grama" ? Math.round(numeric * 1000) : Math.round(numeric);
      await save({
        chamberId: chamberId as Id<"chambers">,
        productId: productId as Id<"products">,
        flavorId: flavorId ? flavorId as Id<"flavors"> : undefined,
        minimumBase,
      });
      setAmount("");
      setFeedback("Estoque mínimo atualizado.");
    } catch (error) { setFeedback(messageFor(error)); }
  }

  return (
    <>
      <form className="register-form minimum-form" onSubmit={submit}>
        <label className="field"><span>Câmara</span><select value={chamberId} onChange={(event) => setChamberId(event.target.value)} required><option value="">Selecione</option>{options?.chambers.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
        <label className="field"><span>Produto</span><select value={productId} onChange={(event) => { setProductId(event.target.value); setFlavorId(""); }} required><option value="">Selecione</option>{options?.products.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
        {product?.kind === "saborizado" && <label className="field"><span>Sabor</span><select value={flavorId} onChange={(event) => setFlavorId(event.target.value)} required><option value="">Selecione</option>{options?.flavors.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>}
        <label className="field"><span>Mínimo ({product?.baseUnit === "grama" ? "kg" : "pacotes"})</span><input type="number" min={product?.baseUnit === "grama" ? "0.001" : "1"} step={product?.baseUnit === "grama" ? "0.001" : "1"} value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
        <button className="button button-primary"><Scale size={18} />Salvar mínimo</button>
      </form>
      <p className="form-feedback" aria-live="polite">{feedback}</p>
      {items === undefined ? <LoadingRows /> : items.length === 0 ? <EmptyRows text="Defina limites para ativar os alertas do dashboard." /> : (
        <div className="table-wrap"><table><thead><tr><th>Câmara</th><th>Produto</th><th>Sabor</th><th className="numeric">Mínimo</th><th className="table-action">Ação</th></tr></thead><tbody>
          {items.map((item) => <tr key={item._id}><td><strong>{item.chamberName}</strong></td><td>{item.productName}</td><td className="muted-cell">{item.flavorName ?? "Não se aplica"}</td><td className="numeric data-number">{formatMinimum(item.minimumBase, item.baseUnit)}</td><td className="table-action"><button className="row-action row-action-danger" onClick={() => void remove({ id: item._id })}><Trash2 size={15} />Remover</button></td></tr>)}
        </tbody></table></div>
      )}
    </>
  );
}

function ConnectedSetup({ section }: { section: SetupSection }) {
  return <div className="content-section register-section">{section === "formats" ? <FormatsPanel /> : section === "vehicles" ? <VehiclesPanel /> : section === "customers" ? <CustomersPanel /> : section === "losses" ? <LossesPanel /> : <MinimumsPanel />}</div>;
}

export function SetupPage({ section, integrationsReady }: SetupPageProps) {
  return (
    <AdminShell integrationsReady={integrationsReady}>
      <section className="page-heading register-heading"><div><p className="eyebrow">Preparação operacional</p><h1>{copy[section][0]}</h1><p>{copy[section][1]}</p></div></section>
      <SetupTabs />
      {integrationsReady ? <ConnectedSetup section={section} /> : <div className="setup-notice"><div><strong>Configuração indisponível no modo demonstração</strong></div></div>}
    </AdminShell>
  );
}
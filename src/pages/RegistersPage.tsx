import { useMutation, useQuery } from "convex/react";
import { ArchiveRestore, Box, Candy, Plus, QrCode, Snowflake, Warehouse } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { AdminShell } from "../components/AdminShell";

type CatalogSection = "products" | "flavors" | "chambers";

interface RegistersPageProps {
  section: CatalogSection;
  integrationsReady: boolean;
}

const sectionCopy = {
  products: {
    eyebrow: "Cadastros essenciais",
    title: "Produtos",
    description: "Defina o tipo de gelo e a unidade-base usada em todos os saldos.",
  },
  flavors: {
    eyebrow: "Cadastros essenciais",
    title: "Sabores",
    description: "Cadastre as variações disponíveis para os produtos saborizados.",
  },
  chambers: {
    eyebrow: "Cadastros essenciais",
    title: "Câmaras",
    description: "Organize os locais físicos que recebem produção e expedição.",
  },
};

function errorMessage(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes("DUPLICATE_NAME")) return "Já existe um cadastro com esse nome.";
  if (text.includes("INVALID_NAME")) return "Informe um nome entre 2 e 80 caracteres.";
  if (text.includes("UNAUTHORIZED")) return "Sua conta ainda não possui acesso administrativo.";
  return "Não foi possível salvar. Tente novamente.";
}

function CatalogTabs() {
  return (
    <nav className="catalog-tabs" aria-label="Tipos de cadastro">
      <NavLink to="/cadastros/produtos"><Box size={17} /> Produtos</NavLink>
      <NavLink to="/cadastros/sabores"><Candy size={17} /> Sabores</NavLink>
      <NavLink to="/cadastros/camaras"><Warehouse size={17} /> Câmaras</NavLink>
    </nav>
  );
}

function TableLoading() {
  return (
    <div className="table-loading" role="status" aria-live="polite">
      <span className="skeleton-line skeleton-wide" />
      <span className="skeleton-line" />
      <span className="skeleton-line skeleton-medium" />
      <span className="sr-only">Carregando cadastros</span>
    </div>
  );
}

function EmptyRegister({ label }: { label: string }) {
  return (
    <div className="empty-state">
      <span className="empty-symbol"><Plus size={22} /></span>
      <strong>Nenhum {label} cadastrado</strong>
      <p>Use o formulário acima para criar o primeiro registro.</p>
    </div>
  );
}

function ProductsPanel() {
  const products = useQuery(api.catalog.listProducts);
  const createProduct = useMutation(api.catalog.createProduct);
  const setActive = useMutation(api.catalog.setProductActive);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"saborizado" | "cubo" | "escamado">("saborizado");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback("");
    try {
      await createProduct({ name, kind });
      setName("");
      setFeedback("Produto cadastrado com sucesso.");
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: Parameters<typeof setActive>[0]["id"], active: boolean) {
    setBusyId(id);
    setFeedback("");
    try {
      await setActive({ id, active });
      setFeedback(active ? "Produto reativado." : "Produto inativado.");
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <>
      <form className="register-form" onSubmit={submit}>
        <label className="field">
          <span>Nome do produto</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Gelo saborizado" minLength={2} maxLength={80} required />
        </label>
        <label className="field">
          <span>Tipo</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
            <option value="saborizado">Saborizado</option>
            <option value="cubo">Cubo</option>
            <option value="escamado">Escamado</option>
          </select>
        </label>
        <button className="button button-primary" disabled={saving}><Plus size={18} />{saving ? "Salvando…" : "Cadastrar produto"}</button>
      </form>
      <p className="form-feedback" aria-live="polite">{feedback}</p>
      {products === undefined ? <TableLoading /> : products.length === 0 ? <EmptyRegister label="produto" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Produto</th><th>Tipo</th><th>Unidade-base</th><th>Situação</th><th className="table-action">Ação</th></tr></thead>
            <tbody>{products.map((product) => (
              <tr key={product._id}>
                <td><strong>{product.name}</strong></td>
                <td>{product.kind === "saborizado" ? "Saborizado" : product.kind === "cubo" ? "Cubo" : "Escamado"}</td>
                <td className="muted-cell">{product.baseUnit === "pacote" ? "Pacote" : "Grama"}</td>
                <td><span className={`badge badge-${product.active ? "ok" : "inactive"}`}>{product.active ? "Ativo" : "Inativo"}</span></td>
                <td className="table-action"><button className="row-action" disabled={busyId === product._id} onClick={() => void toggle(product._id, !product.active)}><ArchiveRestore size={15} />{product.active ? "Inativar" : "Reativar"}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

function FlavorsPanel() {
  const flavors = useQuery(api.catalog.listFlavors);
  const createFlavor = useMutation(api.catalog.createFlavor);
  const setActive = useMutation(api.catalog.setFlavorActive);
  const [name, setName] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback("");
    try {
      await createFlavor({ name });
      setName("");
      setFeedback("Sabor cadastrado com sucesso.");
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: Parameters<typeof setActive>[0]["id"], active: boolean) {
    setBusyId(id);
    setFeedback("");
    try {
      await setActive({ id, active });
      setFeedback(active ? "Sabor reativado." : "Sabor inativado.");
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <>
      <form className="register-form register-form-simple" onSubmit={submit}>
        <label className="field">
          <span>Nome do sabor</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Limão" minLength={2} maxLength={80} required />
        </label>
        <button className="button button-primary" disabled={saving}><Plus size={18} />{saving ? "Salvando…" : "Cadastrar sabor"}</button>
      </form>
      <p className="form-feedback" aria-live="polite">{feedback}</p>
      {flavors === undefined ? <TableLoading /> : flavors.length === 0 ? <EmptyRegister label="sabor" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Sabor</th><th>Situação</th><th className="table-action">Ação</th></tr></thead>
            <tbody>{flavors.map((flavor) => (
              <tr key={flavor._id}>
                <td><strong>{flavor.name}</strong></td>
                <td><span className={`badge badge-${flavor.active ? "ok" : "inactive"}`}>{flavor.active ? "Ativo" : "Inativo"}</span></td>
                <td className="table-action"><button className="row-action" disabled={busyId === flavor._id} onClick={() => void toggle(flavor._id, !flavor.active)}><ArchiveRestore size={15} />{flavor.active ? "Inativar" : "Reativar"}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ChambersPanel() {
  const chambers = useQuery(api.catalog.listChambers);
  const createChamber = useMutation(api.catalog.createChamber);
  const setActive = useMutation(api.catalog.setChamberActive);
  const [name, setName] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback("");
    try {
      await createChamber({ name });
      setName("");
      setFeedback("Câmara cadastrada com sucesso.");
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: Parameters<typeof setActive>[0]["id"], active: boolean) {
    setBusyId(id);
    setFeedback("");
    try {
      await setActive({ id, active });
      setFeedback(active ? "Câmara reativada." : "Câmara inativada.");
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <>
      <form className="register-form register-form-simple" onSubmit={submit}>
        <label className="field">
          <span>Nome da câmara</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Câmara 01" minLength={2} maxLength={80} required />
        </label>
        <button className="button button-primary" disabled={saving}><Plus size={18} />{saving ? "Salvando…" : "Cadastrar câmara"}</button>
      </form>
      <p className="form-feedback" aria-live="polite">{feedback}</p>
      {chambers === undefined ? <TableLoading /> : chambers.length === 0 ? <EmptyRegister label="câmara" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Câmara</th><th>Acesso operacional</th><th>Situação</th><th className="table-action">Ação</th></tr></thead>
            <tbody>{chambers.map((chamber) => (
              <tr key={chamber._id}>
                <td><strong className="camera-cell"><Snowflake size={15} />{chamber.name}</strong></td>
                <td className="muted-cell">Token gerado</td>
                <td><span className={`badge badge-${chamber.active ? "ok" : "inactive"}`}>{chamber.active ? "Ativa" : "Inativa"}</span></td>
                <td className="table-action"><div className="row-actions"><Link className="row-action" to={"/cadastros/camaras/" + chamber._id + "/qr"}><QrCode size={15} />QR</Link><button className="row-action" disabled={busyId === chamber._id} onClick={() => void toggle(chamber._id, !chamber.active)}><ArchiveRestore size={15} />{chamber.active ? "Inativar" : "Reativar"}</button></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ConnectedRegisters({ section }: { section: CatalogSection }) {
  return (
    <div className="content-section register-section">
      {section === "products" ? <ProductsPanel /> : section === "flavors" ? <FlavorsPanel /> : <ChambersPanel />}
    </div>
  );
}

export function RegistersPage({ section, integrationsReady }: RegistersPageProps) {
  const copy = sectionCopy[section];

  return (
    <AdminShell integrationsReady={integrationsReady}>
      <section className="page-heading register-heading">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
      </section>
      <CatalogTabs />
      {!integrationsReady ? (
        <div className="setup-notice" role="status">
          <Snowflake size={20} />
          <div><strong>Cadastros indisponíveis no modo demonstração</strong><span>Configure Clerk e Convex para persistir os dados.</span></div>
        </div>
      ) : (
        <ConnectedRegisters section={section} />
      )}
    </AdminShell>
  );
}
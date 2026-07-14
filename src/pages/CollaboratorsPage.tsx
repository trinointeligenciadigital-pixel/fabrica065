import { useMutation, useQuery } from "convex/react";
import { ArchiveRestore, KeyRound, Pencil, Save, UserPlus, UsersRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AdminShell } from "../components/AdminShell";

interface CollaboratorsPageProps {
  integrationsReady: boolean;
}

type PermissionDraft = Record<string, { canProduce: boolean; canDispatch: boolean }>;

function collaboratorMessage(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes("DUPLICATE_NAME")) return "Já existe um colaborador com esse nome.";
  if (text.includes("INVALID_NAME")) return "Informe um nome entre 2 e 80 caracteres.";
  if (text.includes("NOT_FOUND")) return "Este colaborador não existe mais. Atualize a página.";
  if (text.includes("INVALID_PIN")) return "O PIN deve ter de 4 a 6 números.";
  if (text.includes("PERMISSION_REQUIRED")) return "Marque ao menos uma permissão em uma câmara.";
  if (text.includes("INACTIVE_REFERENCE")) return "Uma das câmaras selecionadas foi inativada.";
  return "Não foi possível salvar. Tente novamente.";
}

function toPermissions(draft: PermissionDraft) {
  return Object.entries(draft)
    .filter(([, permission]) => permission.canProduce || permission.canDispatch)
    .map(([chamberId, permission]) => ({ chamberId: chamberId as Id<"chambers">, ...permission }));
}

function PermissionGrid({
  chambers,
  draft,
  onChange,
  prefix,
}: {
  chambers: Array<{ _id: Id<"chambers">; name: string }>;
  draft: PermissionDraft;
  onChange: (next: PermissionDraft) => void;
  prefix: string;
}) {
  function setPermission(chamberId: string, field: "canProduce" | "canDispatch", value: boolean) {
    onChange({
      ...draft,
      [chamberId]: {
        canProduce: draft[chamberId]?.canProduce ?? false,
        canDispatch: draft[chamberId]?.canDispatch ?? false,
        [field]: value,
      },
    });
  }

  return (
    <fieldset className="permission-fieldset">
      <legend>Permissões por câmara</legend>
      <div className="permission-head"><span>Câmara</span><span>Produção</span><span>Saídas</span></div>
      {chambers.map((chamber) => (
        <div className="permission-row" key={chamber._id}>
          <strong>{chamber.name}</strong>
          <label><input id={prefix + "-produce-" + chamber._id} type="checkbox" checked={draft[chamber._id]?.canProduce ?? false} onChange={(event) => setPermission(chamber._id, "canProduce", event.target.checked)} /><span>Produção</span></label>
          <label><input id={prefix + "-dispatch-" + chamber._id} type="checkbox" checked={draft[chamber._id]?.canDispatch ?? false} onChange={(event) => setPermission(chamber._id, "canDispatch", event.target.checked)} /><span>Saídas</span></label>
        </div>
      ))}
    </fieldset>
  );
}

function ConnectedCollaborators() {
  const collaborators = useQuery(api.collaborators.listCollaborators);
  const chambers = useQuery(api.collaborators.permissionOptions);
  const create = useMutation(api.collaborators.createCollaborator);
  const updateCollaborator = useMutation(api.collaborators.updateCollaborator);
  const setActive = useMutation(api.collaborators.setCollaboratorActive);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [draft, setDraft] = useState<PermissionDraft>({});
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<Id<"collaborators">>();
  const [editName, setEditName] = useState("");
  const [editDraft, setEditDraft] = useState<PermissionDraft>({});
  const [newPin, setNewPin] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback("");
    try {
      await create({ name, pin, permissions: toPermissions(draft) });
      setName("");
      setPin("");
      setDraft({});
      setFeedback("Colaborador cadastrado e permissões aplicadas.");
    } catch (error) {
      setFeedback(collaboratorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function startEditing(collaborator: NonNullable<typeof collaborators>[number]) {
    const next: PermissionDraft = {};
    for (const permission of collaborator.permissions) {
      next[permission.chamberId] = { canProduce: permission.canProduce, canDispatch: permission.canDispatch };
    }
    setEditingId(collaborator._id);
    setEditName(collaborator.name);
    setEditDraft(next);
    setNewPin("");
    setFeedback("");
  }

  async function saveEditing() {
    if (!editingId) return;
    setSaving(true);
    setFeedback("");
    try {
      await updateCollaborator({ collaboratorId: editingId, name: editName, pin: newPin || undefined, permissions: toPermissions(editDraft) });
      setEditingId(undefined);
      setNewPin("");
      setFeedback("Colaborador atualizado. Sessões foram revogadas se o PIN mudou.");
    } catch (error) {
      setFeedback(collaboratorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (chambers === undefined || collaborators === undefined) {
    return <div className="content-section table-loading" role="status"><span className="skeleton-line skeleton-wide" /><span className="skeleton-line" /><span className="sr-only">Carregando equipe</span></div>;
  }

  if (chambers.length === 0) {
    return <div className="content-section empty-state"><span className="empty-symbol"><UsersRound size={22} /></span><strong>Cadastre uma câmara antes da equipe</strong><p>As permissões sempre pertencem a uma câmara específica.</p></div>;
  }

  const editing = collaborators.find((item) => item._id === editingId);

  return (
    <div className="team-layout">
      <section className="content-section team-create">
        <div className="section-heading"><div><h2>Novo colaborador</h2><p>O PIN é protegido e nunca fica visível após o cadastro.</p></div></div>
        <form onSubmit={submit}>
          <div className="team-fields">
            <label className="field"><span>Nome</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome completo" required /></label>
            <label className="field"><span>PIN individual</span><input type="password" inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} autoComplete="new-password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} placeholder="4 a 6 números" required /></label>
          </div>
          <PermissionGrid chambers={chambers} draft={draft} onChange={setDraft} prefix="create" />
          <button className="button button-primary team-submit" disabled={saving}><UserPlus size={18} />{saving ? "Salvando…" : "Cadastrar colaborador"}</button>
        </form>
      </section>

      <section className="content-section team-list">
        <div className="section-heading"><div><h2>Equipe cadastrada</h2><p>{collaborators.length} {collaborators.length === 1 ? "pessoa" : "pessoas"}</p></div></div>
        <p className="form-feedback team-feedback" aria-live="polite">{feedback}</p>
        {collaborators.length === 0 ? (
          <div className="empty-state compact-empty"><strong>Nenhum colaborador cadastrado</strong><p>Use o formulário ao lado para criar o primeiro acesso operacional.</p></div>
        ) : (
          <div className="team-members">
            {collaborators.map((collaborator) => (
              <article className={"team-member" + (editingId === collaborator._id ? " is-editing" : "")} key={collaborator._id}>
                <div className="member-summary">
                  <span className="member-avatar">{collaborator.name.slice(0, 1).toUpperCase()}</span>
                  <div><strong>{collaborator.name}</strong><span>{collaborator.permissions.length} {collaborator.permissions.length === 1 ? "câmara autorizada" : "câmaras autorizadas"}</span></div>
                  <span className={"badge badge-" + (collaborator.active ? "ok" : "inactive")}>{collaborator.active ? "Ativo" : "Inativo"}</span>
                </div>
                <div className="permission-chips">
                  {collaborator.permissions.map((permission) => <span key={permission.chamberId}><b>{permission.chamberName}</b>{permission.canProduce && " · produção"}{permission.canDispatch && " · saídas"}</span>)}
                </div>
                <div className="member-actions">
                  <button className="row-action" onClick={() => startEditing(collaborator)}><Pencil size={15} />Editar</button>
                  <button className="row-action" onClick={() => void setActive({ id: collaborator._id, active: !collaborator.active })}><ArchiveRestore size={15} />{collaborator.active ? "Inativar" : "Reativar"}</button>
                </div>
              </article>
            ))}
          </div>
        )}

        {editing && (
          <div className="permission-editor">
            <div className="permission-editor-heading"><div><p>Editando colaborador</p><h3>{editing.name}</h3></div><button className="text-button" onClick={() => setEditingId(undefined)}>Cancelar</button></div>
            <label className="field collaborator-name-edit"><span>Nome completo</span><input autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} minLength={2} maxLength={80} required /></label>
            <PermissionGrid chambers={chambers} draft={editDraft} onChange={setEditDraft} prefix="edit" />
            <label className="field reset-pin"><span>Novo PIN (opcional)</span><div><KeyRound size={17} /><input type="password" inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, ""))} placeholder="Deixe vazio para manter" /></div></label>
            <button className="button button-primary" disabled={saving} onClick={() => void saveEditing()}><Save size={18} />Salvar alterações</button>
          </div>
        )}
      </section>
    </div>
  );
}

export function CollaboratorsPage({ integrationsReady }: CollaboratorsPageProps) {
  return (
    <AdminShell integrationsReady={integrationsReady}>
      <section className="page-heading register-heading"><div><p className="eyebrow">Equipe operacional</p><h1>Colaboradores e permissões</h1><p>Defina quem pode produzir ou registrar saídas em cada câmara.</p></div></section>
      {integrationsReady ? <ConnectedCollaborators /> : <div className="setup-notice"><div><strong>Equipe indisponível no modo demonstração</strong></div></div>}
    </AdminShell>
  );
}
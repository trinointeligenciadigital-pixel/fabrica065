import { useQuery } from "convex/react";
import { AlertTriangle, CheckCircle2, CircleHelp, Database, History, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { AdminShell } from "../components/AdminShell";

interface DiagnosticsPageProps {
  integrationsReady: boolean;
}

const actionByCheck: Record<string, { label: string; to: string }> = {
  "negative-balances": { label: "Revisar estoque", to: "/estoque" },
  "orphan-references": { label: "Abrir histórico", to: "/historico" },
  "source-trail": { label: "Auditar histórico", to: "/historico" },
  "stale-counts": { label: "Revisar contagens", to: "/contagens" },
  "expired-sessions": { label: "Revisar equipe", to: "/cadastros/equipe" },
};

function formatDate(value: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Cuiaba",
  }).format(value);
}

function ConnectedDiagnostics() {
  const overview = useQuery(api.health.overview);

  if (overview === undefined) {
    return (
      <AdminShell integrationsReady>
        <div className="movement-entry-loading" role="status" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          <span>Verificando a integridade operacional…</span>
        </div>
      </AdminShell>
    );
  }

  const warningCount = overview.checks.filter((check) => check.status === "warning").length;
  const criticalCount = overview.checks.filter((check) => check.status === "critical").length;

  return (
    <AdminShell integrationsReady>
      <section className="page-heading diagnostic-page-heading">
        <div>
          <p className="eyebrow">Segurança operacional</p>
          <h1>Diagnóstico do sistema</h1>
          <p>Verificação reativa do ledger, das sessões e dos bloqueios de contagem.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => window.location.reload()}>
          <RefreshCw size={17} aria-hidden="true" /> Verificar novamente
        </button>
      </section>

      <section className={`diagnostic-summary ${overview.healthy ? "is-healthy" : "has-critical"}`} aria-live="polite">
        <span className="diagnostic-summary-icon" aria-hidden="true">
          {overview.healthy ? <ShieldCheck size={28} /> : <AlertTriangle size={28} />}
        </span>
        <div>
          <p>{overview.healthy ? "Operação protegida" : "Ação necessária"}</p>
          <h2>{criticalCount > 0 ? `${criticalCount} ${criticalCount === 1 ? "falha crítica encontrada" : "falhas críticas encontradas"}` : "Nenhuma inconsistência crítica encontrada"}</h2>
          <span>{warningCount > 0 ? `${warningCount} ${warningCount === 1 ? "ponto requer atenção" : "pontos requerem atenção"}.` : "Todos os controles estão dentro do esperado."} Última leitura: {formatDate(overview.checkedAt)}.</span>
        </div>
      </section>

      <section className="diagnostic-metrics" aria-label="Cobertura da verificação">
        <article><Database size={19} aria-hidden="true" /><span><strong>{overview.counts.movementsChecked.toLocaleString("pt-BR")}</strong><small>movimentações verificadas</small></span></article>
        <article><History size={19} aria-hidden="true" /><span><strong>{overview.counts.sessionsChecked.toLocaleString("pt-BR")}</strong><small>sessões verificadas</small></span></article>
        <article><ShieldCheck size={19} aria-hidden="true" /><span><strong>{overview.counts.countsChecked.toLocaleString("pt-BR")}</strong><small>contagens verificadas</small></span></article>
      </section>

      <section className="content-section diagnostic-checks">
        <div className="section-heading">
          <div><h2>Controles automáticos</h2><p>Falhas críticas exigem revisão antes de novos lançamentos administrativos.</p></div>
        </div>
        <div className="diagnostic-check-list">
          {overview.checks.map((check) => {
            const action = actionByCheck[check.id];
            return (
              <article className={`diagnostic-check is-${check.status}`} key={check.id}>
                <span className="diagnostic-check-icon" aria-hidden="true">
                  {check.status === "ok" ? <CheckCircle2 size={20} /> : check.status === "critical" ? <AlertTriangle size={20} /> : <CircleHelp size={20} />}
                </span>
                <div className="diagnostic-check-copy">
                  <div><h3>{check.label}</h3><span>{check.status === "ok" ? "Conforme" : check.status === "critical" ? "Crítico" : "Atenção"}{check.count > 0 ? ` · ${check.count.toLocaleString("pt-BR")} ocorrência${check.count === 1 ? "" : "s"}` : ""}</span></div>
                  <p>{check.description}</p>
                </div>
                {action && check.status !== "ok" ? <Link className="button button-secondary button-compact" to={action.to}>{action.label}</Link> : null}
              </article>
            );
          })}
        </div>
      </section>

      <p className="diagnostic-footnote">A verificação é somente leitura. Nenhum saldo, lançamento ou cadastro é alterado por esta tela.</p>
    </AdminShell>
  );
}

export function DiagnosticsPage({ integrationsReady }: DiagnosticsPageProps) {
  if (!integrationsReady) {
    return (
      <AdminShell integrationsReady={false}>
        <section className="page-heading"><div><p className="eyebrow">Segurança operacional</p><h1>Diagnóstico do sistema</h1><p>Conecte Clerk e Convex para verificar o ledger e as sessões.</p></div></section>
        <section className="content-section empty-state"><ShieldCheck size={30} /><strong>Diagnóstico aguardando conexão</strong><p>A leitura de integridade será habilitada quando o ambiente estiver conectado.</p></section>
      </AdminShell>
    );
  }
  return <ConnectedDiagnostics />;
}

import { SignInButton, UserButton } from "@clerk/react";
import { AuthLoading, Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { Snowflake, UserRoundCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";

interface AdminAccessProps {
  children: ReactNode;
  integrationsReady: boolean;
}

function AccessPanel({ children }: { children: ReactNode }) {
  return (
    <main className="access-page">
      <section className="access-card">
        <div className="access-brand">
          <span className="brand-mark"><Snowflake size={22} /></span>
          <span><strong>Estoque</strong><b>065</b></span>
        </div>
        {children}
      </section>
    </main>
  );
}

function LoadingAccess() {
  return (
    <AccessPanel>
      <div className="access-content" role="status" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <h1>Preparando seu acesso</h1>
        <p>Validando a sessão e as permissões administrativas.</p>
      </div>
    </AccessPanel>
  );
}

function SignInAccess() {
  return (
    <AccessPanel>
      <div className="access-content">
        <span className="access-symbol"><UserRoundCheck size={25} /></span>
        <p className="eyebrow">Área administrativa</p>
        <h1>Entre para gerenciar o estoque</h1>
        <p>Use sua conta autorizada da 065 Gelo para acessar cadastros, saldos e movimentações.</p>
        <SignInButton mode="modal">
          <button className="button button-primary access-button">Entrar com Clerk</button>
        </SignInButton>
      </div>
    </AccessPanel>
  );
}

function AdminBootstrap({ children }: { children: ReactNode }) {
  const syncCurrent = useMutation(api.admins.syncCurrent);
  const status = useQuery(api.admins.currentStatus);
  const [syncState, setSyncState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    void syncCurrent({})
      .then(() => {
        if (active) setSyncState("ready");
      })
      .catch(() => {
        if (active) setSyncState("error");
      });
    return () => {
      active = false;
    };
  }, [syncCurrent]);

  if (syncState === "error") {
    return (
      <AccessPanel>
        <div className="access-content">
          <h1>Não foi possível validar o acesso</h1>
          <p>Confirme sua conexão e tente novamente. Nenhum dado foi alterado.</p>
          <button className="button button-secondary access-button" onClick={() => window.location.reload()}>Tentar novamente</button>
        </div>
      </AccessPanel>
    );
  }

  if (syncState === "loading" || status === undefined || !status.authenticated || !status.exists) {
    return <LoadingAccess />;
  }

  if (!status.active) {
    return (
      <AccessPanel>
        <div className="access-content">
          <span className="access-symbol"><UserRoundCheck size={25} /></span>
          <p className="eyebrow">Acesso pendente</p>
          <h1>Seu cadastro aguarda liberação</h1>
          <p>Um administrador ativo precisa liberar esta conta antes do acesso ao estoque.</p>
          <div className="access-user"><UserButton /><span>{status.name}</span></div>
        </div>
      </AccessPanel>
    );
  }

  return children;
}

export function AdminAccess({ children, integrationsReady }: AdminAccessProps) {
  if (!integrationsReady) return children;

  return (
    <>
      <AuthLoading><LoadingAccess /></AuthLoading>
      <Unauthenticated><SignInAccess /></Unauthenticated>
      <Authenticated><AdminBootstrap>{children}</AdminBootstrap></Authenticated>
    </>
  );
}
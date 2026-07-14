import {
  Boxes,
  ClipboardCheck,
  History,
  LayoutDashboard,
  PackagePlus,
  ScrollText,
  Settings2,
  ShieldCheck,
  Snowflake,
  Truck,
  UsersRound,
  Warehouse,
} from "lucide-react";
import { Show, SignInButton, UserButton } from "@clerk/react";
import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { OfflineBanner } from "./OfflineBanner";

interface AdminShellProps {
  children: ReactNode;
  integrationsReady: boolean;
}

const navItems = [
  { label: "Visão geral", icon: LayoutDashboard, to: "/" },
  { label: "Estoque", icon: Boxes, to: "/estoque" },
  { label: "Movimentações", icon: History, to: "/movimentacoes" },
  { label: "Histórico", icon: ScrollText, to: "/historico" },
  { label: "Carregamentos", icon: Truck, to: "/carregamentos" },
  { label: "Contagens", icon: ClipboardCheck, to: "/contagens" },
];

const registerItems = [
  { label: "Produtos", icon: PackagePlus, to: "/cadastros/produtos" },
  { label: "Câmaras", icon: Warehouse, to: "/cadastros/camaras" },
  { label: "Equipe", icon: UsersRound, to: "/configuracoes/colaboradores" },
  { label: "Preparação", icon: Settings2, to: "/configuracoes/formatos" },
  { label: "Diagnóstico", icon: ShieldCheck, to: "/diagnostico" },
];

export function AdminShell({ children, integrationsReady }: AdminShellProps) {
  const currentDate = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Cuiaba",
  }).format(new Date());

  return (
    <div className="app-frame">
      <OfflineBanner />
      <a className="skip-link" href="#main-content">Ir para o conteúdo principal</a>
      <aside className="sidebar" aria-label="Navegação principal">
        <Link className="brand" to="/" aria-label="Estoque 065 — início">
          <span className="brand-mark" aria-hidden="true"><Snowflake size={22} /></span>
          <span><strong>Estoque</strong><b>065</b></span>
        </Link>

        <nav className="nav-groups">
          <div className="nav-group">
            <p className="nav-label">Operação</p>
            {navItems.map(({ label, icon: Icon, to }) => (
              <NavLink className={({ isActive }) => "nav-link" + (isActive ? " is-active" : "")} key={to} to={to} end={to === "/"}>
                <Icon size={18} aria-hidden="true" /><span>{label}</span>
              </NavLink>
            ))}
          </div>
          <div className="nav-group">
            <p className="nav-label">Administração</p>
            {registerItems.map(({ label, icon: Icon, to }) => (
              <NavLink className={({ isActive }) => "nav-link" + (isActive ? " is-active" : "")} key={to} to={to}>
                <Icon size={18} aria-hidden="true" /><span>{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer"><span className="environment-dot" aria-hidden="true" /><span>{integrationsReady ? "Ambiente conectado" : "Modo demonstração"}</span></div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div><p className="topbar-context">Gestão 065 Gelo</p><p className="topbar-date">{currentDate}</p></div>
          <div className="topbar-actions">
            <Link className="button button-secondary button-compact" to="/cadastros/camaras">Acessos QR</Link>
            {integrationsReady ? (
              <>
                <Show when="signed-out"><SignInButton><button className="button button-primary button-compact">Entrar</button></SignInButton></Show>
                <Show when="signed-in"><UserButton /></Show>
              </>
            ) : <span className="mode-badge">Dados de exemplo</span>}
          </div>
        </header>
        <main className="main-content" id="main-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}

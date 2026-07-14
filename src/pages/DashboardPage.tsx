import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Boxes,
  CircleCheck,
  Clock3,
  PackagePlus,
  Snowflake,
} from "lucide-react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { AdminShell } from "../components/AdminShell";

interface DashboardPageProps {
  integrationsReady: boolean;
}

type BaseUnit = "pacote" | "grama";

interface BalanceRow {
  key: string;
  camera: string;
  product: string;
  variant: string;
  baseUnit: BaseUnit;
  quantityBase: number;
  minimumBase: number | null;
  isLow: boolean;
}

interface MovementRow {
  id: string;
  type: string;
  detail: string;
  camera: string;
  baseUnit: BaseUnit;
  quantityBase: number;
  direction: "entrada" | "saida";
  person: string;
  occurredAt: number;
}

interface DashboardData {
  activeChambersCount: number;
  lowCount: number;
  balances: BalanceRow[];
  recent: MovementRow[];
}

const demoData: DashboardData = {
  activeChambersCount: 2,
  lowCount: 2,
  balances: [
    { key: "1", camera: "Câmara 01", product: "Saborizado", variant: "Limão", baseUnit: "pacote", quantityBase: 184, minimumBase: 120, isLow: false },
    { key: "2", camera: "Câmara 01", product: "Gelo cubo", variant: "Todas as apresentações", baseUnit: "grama", quantityBase: 192000, minimumBase: 200000, isLow: true },
    { key: "3", camera: "Câmara 02", product: "Saborizado", variant: "Maracujá", baseUnit: "pacote", quantityBase: 76, minimumBase: 80, isLow: true },
    { key: "4", camera: "Câmara 02", product: "Gelo escamado", variant: "Todas as apresentações", baseUnit: "grama", quantityBase: 340000, minimumBase: 160000, isLow: false },
  ],
  recent: [
    { id: "1", type: "Produção", detail: "Saborizado · Limão", camera: "Câmara 01", baseUnit: "pacote", quantityBase: 24, direction: "entrada", person: "Rafael", occurredAt: Date.now() - 18 * 60_000 },
    { id: "2", type: "Venda", detail: "Gelo cubo · 2 kg", camera: "Câmara 01", baseUnit: "grama", quantityBase: 40000, direction: "saida", person: "Márcia", occurredAt: Date.now() - 102 * 60_000 },
  ],
};

function formatQuantity(value: number, unit: BaseUnit) {
  if (unit === "pacote") {
    return `${new Intl.NumberFormat("pt-BR").format(value)} ${Math.abs(value) === 1 ? "pacote" : "pacotes"}`;
  }
  if (Math.abs(value) >= 1000) {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value / 1000)} kg`;
  }
  return `${new Intl.NumberFormat("pt-BR").format(value)} g`;
}

function formatMovementTime(value: number) {
  const date = new Date(value);
  const today = new Date();
  const sameDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(date)
    === new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(today);
  return new Intl.DateTimeFormat("pt-BR", {
    ...(sameDay ? {} : { day: "2-digit", month: "2-digit" }),
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Cuiaba",
  }).format(date);
}

function DashboardSkeleton() {
  return (
    <AdminShell integrationsReady>
      <section className="page-heading">
        <div><p className="eyebrow">Visão geral</p><h1>Estoque por câmara</h1><p>Carregando saldos e movimentações.</p></div>
      </section>
      <div className="dashboard-skeleton" role="status" aria-live="polite">
        <span className="skeleton-block skeleton-summary" />
        <span className="skeleton-block skeleton-table" />
        <span className="sr-only">Carregando painel</span>
      </div>
    </AdminShell>
  );
}

function DashboardContent({ data, integrationsReady }: { data: DashboardData; integrationsReady: boolean }) {
  const hasLowStock = data.lowCount > 0;

  return (
    <AdminShell integrationsReady={integrationsReady}>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Visão geral</p>
          <h1>Estoque por câmara</h1>
          <p>Acompanhe o saldo atual e aja primeiro onde o mínimo foi atingido.</p>
        </div>
        <div className="heading-actions">
          <Link className="button button-secondary" to="/movimentacoes"><Clock3 size={18} /> Nova movimentação</Link>
          <Link className="button button-primary" to="/cadastros/produtos"><PackagePlus size={18} /> Gerenciar produtos</Link>
        </div>
      </section>

      {!integrationsReady && (
        <div className="setup-notice" role="status">
          <Snowflake size={20} aria-hidden="true" />
          <div>
            <strong>Visualização de homologação</strong>
            <span>Os dados abaixo são exemplos. Configure Clerk e Convex para ativar o ambiente conectado.</span>
          </div>
        </div>
      )}

      <section className="status-strip" aria-label="Resumo operacional">
        <div className="status-primary">
          <span className={`status-icon ${hasLowStock ? "status-icon-warning" : "status-icon-success"}`}>
            {hasLowStock ? <AlertTriangle size={20} /> : <CircleCheck size={20} />}
          </span>
          <div>
            <strong>{hasLowStock ? `${data.lowCount} ${data.lowCount === 1 ? "item pede" : "itens pedem"} atenção` : "Estoque sem alertas"}</strong>
            <span>{hasLowStock ? "Abaixo do estoque mínimo configurado" : "Nenhum saldo abaixo do mínimo"}</span>
          </div>
        </div>
        <div className="status-separator" />
        <div className="status-item"><Boxes size={18} /><span><b>{data.activeChambersCount}</b> {data.activeChambersCount === 1 ? "câmara ativa" : "câmaras ativas"}</span></div>
        <div className="status-item"><CircleCheck size={18} /><span>Última atualização <b>agora</b></span></div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div><h2>Saldos atuais</h2><p>Unidades compatíveis aparecem sem conversão ambígua.</p></div>
          <Link className="text-button" to="/estoque">Ver estoque completo <ArrowRight size={16} /></Link>
        </div>
        {data.balances.length === 0 ? (
          <div className="empty-state dashboard-empty">
            <span className="empty-symbol"><Boxes size={22} /></span>
            <strong>Ainda não há saldos registrados</strong>
            <p>Cadastre produtos e câmaras; os saldos aparecerão após a primeira movimentação ou configuração de mínimo.</p>
            <Link className="button button-secondary button-compact" to="/cadastros/produtos">Começar pelos produtos</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Câmara</th><th>Produto</th><th>Apresentação</th><th className="numeric">Saldo</th><th className="numeric">Mínimo</th><th>Situação</th></tr></thead>
              <tbody>
                {data.balances.map((item) => (
                  <tr key={item.key}>
                    <td><span className="camera-cell"><Snowflake size={15} />{item.camera}</span></td>
                    <td><strong>{item.product}</strong></td>
                    <td className="muted-cell">{item.variant}</td>
                    <td className="numeric data-number">{formatQuantity(item.quantityBase, item.baseUnit)}</td>
                    <td className="numeric data-number subtle-number">{item.minimumBase === null ? "Não definido" : formatQuantity(item.minimumBase, item.baseUnit)}</td>
                    <td><span className={`badge badge-${item.isLow ? "low" : "ok"}`}>{item.isLow ? "Abaixo do mínimo" : "Regular"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bottom-grid">
        <div className="content-section movements-section">
          <div className="section-heading"><div><h2>Movimentações recentes</h2><p>Últimos registros do livro-razão.</p></div><Link className="icon-button" to="/movimentacoes" aria-label="Abrir movimentações"><ArrowRight size={18} /></Link></div>
          {data.recent.length === 0 ? (
            <div className="empty-state compact-empty"><strong>Nenhuma movimentação registrada</strong><p>Produções, saídas e ajustes aparecerão aqui.</p></div>
          ) : (
            <div className="movement-list">
              {data.recent.map((movement) => {
                const direction = movement.direction === "entrada" ? "in" : "out";
                return (
                  <div className="movement-row" key={movement.id}>
                    <span className={`movement-icon movement-icon-${direction}`}>{direction === "in" ? <ArrowDownToLine size={18} /> : <ArrowUpFromLine size={18} />}</span>
                    <div className="movement-main"><strong>{movement.type}</strong><span>{movement.detail} · {movement.camera}</span></div>
                    <span className={`movement-quantity quantity-${direction}`}>{direction === "in" ? "+" : "−"}{formatQuantity(movement.quantityBase, movement.baseUnit)}</span>
                    <div className="movement-meta"><strong>{movement.person}</strong><span>{formatMovementTime(movement.occurredAt)}</span></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="content-section quick-section">
          <div className="section-heading"><div><h2>Próximos cadastros</h2><p>Prepare a estrutura operacional.</p></div></div>
          <div className="quick-actions">
            <Link to="/cadastros/produtos"><span className="quick-icon"><PackagePlus size={20} /></span><span><strong>Produtos</strong><small>Tipo e unidade-base</small></span><ArrowRight size={17} /></Link>
            <Link to="/cadastros/sabores"><span className="quick-icon"><Snowflake size={20} /></span><span><strong>Sabores</strong><small>Variações saborizadas</small></span><ArrowRight size={17} /></Link>
            <Link to="/cadastros/camaras"><span className="quick-icon"><Boxes size={20} /></span><span><strong>Câmaras</strong><small>Locais de estoque</small></span><ArrowRight size={17} /></Link>
          </div>
          <Link className="operation-link" to="/cadastros/camaras">Abrir acessos das câmaras <ArrowRight size={16} /></Link>
        </aside>
      </section>
    </AdminShell>
  );
}

function ConnectedDashboard() {
  const data = useQuery(api.stock.dashboard);
  if (data === undefined) return <DashboardSkeleton />;
  return <DashboardContent data={data} integrationsReady />;
}

export function DashboardPage({ integrationsReady }: DashboardPageProps) {
  return integrationsReady ? <ConnectedDashboard /> : <DashboardContent data={demoData} integrationsReady={false} />;
}

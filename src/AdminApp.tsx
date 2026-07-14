import { ClerkProvider, useAuth } from "@clerk/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ConvexReactClient } from "convex/react";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminAccess } from "./components/AdminAccess";

const ChamberQrPage = lazy(() => import("./pages/ChamberQrPage").then((module) => ({ default: module.ChamberQrPage })));
const CollaboratorsPage = lazy(() => import("./pages/CollaboratorsPage").then((module) => ({ default: module.CollaboratorsPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const MovementsPage = lazy(() => import("./pages/MovementsPage").then((module) => ({ default: module.MovementsPage })));
const RegistersPage = lazy(() => import("./pages/RegistersPage").then((module) => ({ default: module.RegistersPage })));
const SetupPage = lazy(() => import("./pages/SetupPage").then((module) => ({ default: module.SetupPage })));

interface AdminAppProps {
  integrationsReady: boolean;
  clerkKey?: string;
  convex: ConvexReactClient | null;
}

function RouteLoading() {
  return <div className="route-loading" role="status"><span className="loading-spinner" /><span>Carregando módulo…</span></div>;
}

function AdminRoutes({ integrationsReady }: { integrationsReady: boolean }) {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<DashboardPage integrationsReady={integrationsReady} />} />
        <Route path="/movimentacoes" element={<MovementsPage integrationsReady={integrationsReady} />} />
        <Route path="/cadastros/produtos" element={<RegistersPage section="products" integrationsReady={integrationsReady} />} />
        <Route path="/cadastros/sabores" element={<RegistersPage section="flavors" integrationsReady={integrationsReady} />} />
        <Route path="/cadastros/camaras" element={<RegistersPage section="chambers" integrationsReady={integrationsReady} />} />
        <Route path="/cadastros/camaras/:chamberId/qr" element={<ChamberQrPage integrationsReady={integrationsReady} />} />
        <Route path="/configuracoes/colaboradores" element={<CollaboratorsPage integrationsReady={integrationsReady} />} />
        <Route path="/configuracoes/formatos" element={<SetupPage section="formats" integrationsReady={integrationsReady} />} />
        <Route path="/configuracoes/veiculos" element={<SetupPage section="vehicles" integrationsReady={integrationsReady} />} />
        <Route path="/configuracoes/clientes" element={<SetupPage section="customers" integrationsReady={integrationsReady} />} />
        <Route path="/configuracoes/perdas" element={<SetupPage section="losses" integrationsReady={integrationsReady} />} />
        <Route path="/configuracoes/minimos" element={<SetupPage section="minimums" integrationsReady={integrationsReady} />} />
        <Route path="/configuracoes" element={<Navigate to="/configuracoes/formatos" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export function AdminApp({ integrationsReady, clerkKey, convex }: AdminAppProps) {
  const routes = (
    <AdminAccess integrationsReady={integrationsReady}>
      <AdminRoutes integrationsReady={integrationsReady} />
    </AdminAccess>
  );

  if (!integrationsReady || !clerkKey || !convex) return routes;

  return (
    <ClerkProvider publishableKey={clerkKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {routes}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
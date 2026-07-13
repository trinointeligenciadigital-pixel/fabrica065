import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

const AdminApp = lazy(() => import("./AdminApp").then((module) => ({ default: module.AdminApp })));
const OperationPage = lazy(() => import("./pages/OperationPage").then((module) => ({ default: module.OperationPage })));

interface AppProps {
  integrationsReady: boolean;
  clerkKey?: string;
  convex: ConvexReactClient | null;
}

function RouteLoading() {
  return <div className="route-loading" role="status"><span className="loading-spinner" /><span>Carregando módulo…</span></div>;
}

export default function App({ integrationsReady, clerkKey, convex }: AppProps) {
  const operation = (
    <Suspense fallback={<RouteLoading />}>
      <OperationPage integrationsReady={integrationsReady} />
    </Suspense>
  );

  return (
    <Routes>
      <Route
        path="/operacao/:cameraToken"
        element={integrationsReady && convex ? <ConvexProvider client={convex}>{operation}</ConvexProvider> : operation}
      />
      <Route
        path="*"
        element={
          <Suspense fallback={<RouteLoading />}>
            <AdminApp integrationsReady={integrationsReady} clerkKey={clerkKey} convex={convex} />
          </Suspense>
        }
      />
    </Routes>
  );
}
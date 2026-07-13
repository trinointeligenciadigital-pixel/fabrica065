import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { registerSW } from "virtual:pwa-register";
import "@fontsource-variable/inter/wght.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import App from "./App";
import "./styles.css";

registerSW({ immediate: true });

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const convexUrl = import.meta.env.VITE_CONVEX_URL;
const integrationsReady = Boolean(clerkKey && convexUrl);
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App integrationsReady={integrationsReady} clerkKey={clerkKey} convex={convex} />
    </BrowserRouter>
  </StrictMode>,
);
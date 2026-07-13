import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5176,
    strictPort: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["estoque-065.svg"],
      manifest: {
        name: "Estoque 065",
        short_name: "Estoque 065",
        description: "Controle de produção e estoque da 065 Gelo",
        theme_color: "#EEF3F4",
        background_color: "#EEF3F4",
        display: "standalone",
        start_url: "/",
        lang: "pt-BR",
        icons: [
          {
            src: "/estoque-065.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        runtimeCaching: [],
      },
    }),
  ],
});
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND = process.env.VITE_API_URL || "http://localhost:8000";

// Proxy API avec repli SPA : si la requête vient d'une navigation navigateur
// (rechargement d'une page comme /analyst, /cases, /settings…), on sert
// index.html au lieu de proxifier vers le backend — sinon on tombe sur du 404.
function apiProxy() {
  return {
    target: BACKEND,
    changeOrigin: true,
    secure: false,
    bypass(req: any) {
      const accept = String(req.headers?.accept || "");
      if (req.method === "GET" && accept.includes("text/html")) {
        return "/index.html";
      }
      return undefined;
    },
  };
}

const PREFIXES = [
  "/auth", "/analyst", "/screening", "/cases", "/documents", "/settings",
  "/admin", "/health", "/referentiel", "/scoring", "/alertes", "/kyt",
  "/reportings", "/integration", "/rbac", "/adverse-media",
];

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(PREFIXES.map((p) => [p, apiProxy()])),
  },
});

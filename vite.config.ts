// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // charge .env, .env.local, .env.production etc
  const env = loadEnv(mode, process.cwd(), "");

  const BACKEND =
    env.VITE_API_URL ||
    "http://localhost:8000";

  const proxyRoutes = [
    "/auth",
    "/analyst",
    "/screening",
    "/cases",
    "/documents",
    "/admin",
    "/health",
  ];

  const proxy = Object.fromEntries(
    proxyRoutes.map((route) => [
      route,
      {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
    ])
  );

  return {
    plugins: [react()],

    server: {
      proxy,
    },

    preview: {
      proxy,
    },

    define: {
      __API_URL__: JSON.stringify(env.VITE_API_URL),
    },
  };
});
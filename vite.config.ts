// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En dev: /api -> http://localhost:8000 (et on enlève le préfixe /api)
// En prod (Vercel): pas de proxy, le front appelle directement VITE_API_BASE_URL
export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  return {
    plugins: [react()],
    server: isDev
      ? {
          host: true,
          port: 5173,
          strictPort: true,
          proxy: {
            "/api": {
              target: "http://localhost:8000",
              changeOrigin: true,
              secure: false,
              rewrite: (path) => path.replace(/^\/api/, ""),
            },
          },
        }
      : undefined,
  };
});
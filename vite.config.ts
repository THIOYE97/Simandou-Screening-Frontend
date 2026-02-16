import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    allowedHosts: true, // ou "all" selon ta version

    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,

        // 🔥 enlève le préfixe /api avant d'envoyer au backend
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});


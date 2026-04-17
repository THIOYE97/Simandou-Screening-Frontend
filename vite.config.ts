// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND = process.env.VITE_API_URL || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Auth
      "/auth": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      // Analyst router
      "/analyst": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      // Screening engine
      "/screening": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      // Cases
      "/cases": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      // Documents
      "/documents": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      // Settings routes
      "/settings": {
        target: process.env.VITE_API_URL || "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
      // Backoffice / admin
      "/admin": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      // Health
      "/health": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
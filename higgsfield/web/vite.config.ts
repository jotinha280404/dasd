import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Higgsfield web (dev :5174) proxies to the higgsfield server (:8788).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:8788",
      "/ws": { target: "ws://localhost:8788", ws: true },
    },
  },
});

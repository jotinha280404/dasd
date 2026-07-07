import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Calendar web (dev :5176) proxies to the calendar server (:8790).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5176,
    proxy: {
      "/api": "http://localhost:8790",
    },
  },
});

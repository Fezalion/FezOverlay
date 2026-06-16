import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:48000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:48000",
        ws: true,
      },
      "/auth": {
        target: "http://localhost:48000",
        changeOrigin: true,
      },
    },
  },
});

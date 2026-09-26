import { defineConfig } from "vite";
export default defineConfig({
  root: "client",
  base: "/Supply-X/",
  build: { outDir: "../dist", emptyOutDir: true },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
});

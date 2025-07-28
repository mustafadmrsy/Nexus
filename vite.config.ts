import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(), // ⛔️ crossorigin'ı kaldıran HTML plugin
    removeCrossoriginPlugin(),
  ],
  base: "./",
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});

function removeCrossoriginPlugin(): Plugin {
  return {
    name: "remove-crossorigin-from-html",
    transformIndexHtml(html) {
      return html.replace(/\scrossorigin\b/g, "");
    },
  };
}

import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "::",
    port: 5173,
    strictPort: true
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("firebase")) {
            return "vendor-firebase";
          }
          if (id.includes("recharts")) {
            return "vendor-charts";
          }
          if (id.includes("@tanstack/react-table")) {
            return "vendor-table";
          }
          if (id.includes("react-router") || id.includes("history")) {
            return "vendor-router";
          }
          if (id.includes("react-toastify")) {
            return "vendor-toast";
          }
          if (id.includes("date-fns")) {
            return "vendor-date";
          }
          if (id.includes("jspdf") || id.includes("html2canvas") || id.includes("xlsx")) {
            return "vendor-export";
          }

          return "vendor-core";
        }
      }
    }
  }
});

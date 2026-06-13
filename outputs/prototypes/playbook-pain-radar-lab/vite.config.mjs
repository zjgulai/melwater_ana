import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { reviewStateVitePlugin } from "./server/reviewStateApi.mjs";

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        chunkFileNames: "assets/[name]-[hash].js",
        codeSplitting: {
          groups: [
            {
              name: "chart-vendor",
              test: /node_modules[\\/]recharts/,
              priority: 40,
            },
            {
              name: "icon-vendor",
              test: /node_modules[\\/]@tabler[\\/]icons-react/,
              priority: 30,
            },
            {
              name: "react-vendor",
              test: /node_modules[\\/](react|react-dom|scheduler)/,
              priority: 20,
            },
            {
              name: "vendor",
              test: /node_modules/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [reviewStateVitePlugin(), react()],
});

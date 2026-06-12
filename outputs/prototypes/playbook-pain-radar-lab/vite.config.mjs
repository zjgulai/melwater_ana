import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { reviewStateVitePlugin } from "./server/reviewStateApi.mjs";

export default defineConfig({
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

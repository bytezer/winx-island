import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The island is a fixed-size transparent canvas, so there is no need for a
// host or HMR tuning beyond keeping the port stable for the dev URL.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5274,
    strictPort: true,
  },
  build: {
    target: "chrome110",
    minify: "esbuild",
    sourcemap: false,
  },
});

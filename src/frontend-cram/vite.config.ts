import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 4174,
  },
  resolve: {
    alias: {
      pages: fileURLToPath(new URL("./pages", import.meta.url)),
      app: fileURLToPath(new URL("./app", import.meta.url)),
      dumb: fileURLToPath(new URL("./dumb", import.meta.url)),
    },
  },
});

import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { resolve } from "node:path";

// Vite builds the viewer site from ./site; the Cloudflare plugin runs the
// Worker (src/worker.js) alongside it in dev and emits it in the build.
export default defineConfig({
  root: "site",
  plugins: [cloudflare({ configPath: "../wrangler.jsonc" })],
  build: { outDir: "../dist", emptyOutDir: true },
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: {
            index: resolve(__dirname, "site/index.html"),
            view: resolve(__dirname, "site/view.html"),
            docs: resolve(__dirname, "site/docs.html"),
          },
        },
      },
    },
  },
});

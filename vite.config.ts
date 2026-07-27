import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    /* Never inline an asset as a data: URI.

       Vite's 4096-byte default inlined jadwal-band-h/v.svg (2027B each),
       jadwal-corner.svg (315B) and noor.svg (1427B) straight into the CSS as
       `url("data:image/svg+xml,...")`. The app's CSP is
       `img-src 'self' asset: ... ytimg.com` with NO `data:` source, and
       background-image and mask-image are both governed by img-src — so in a
       packaged build those four became blocked requests and the jadwal, the
       app's stated signature element, silently did not render.

       It survived because neither verification path exercises the shipping
       configuration: `tauri dev` serves real URLs and never inlines, and
       dist/index.html carries no CSP meta because Tauri injects the policy at
       serve time, so the Playwright sweep renders with no policy in force.
       guards.mjs now asserts the built CSS contains no data:image. */
    assetsInlineLimit: 0,
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
import { defineConfig } from "vite";

// Bundles www/ (including the native-bridge.js plugin imports) into dist-www/,
// which is what capacitor.config.ts's webDir should point to for native builds.
// The web prototype in www/ keeps working unmodified when opened directly or
// served without this build step - Vite is only needed for the iOS/Capacitor build.
export default defineConfig({
  root: "www",
  base: "",
  build: {
    outDir: "../dist-www",
    emptyOutDir: true,
  },
});

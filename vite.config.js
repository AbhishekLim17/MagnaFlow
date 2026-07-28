import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Strip developer logging from production bundles. `pure` marks these calls
  // as side-effect free so minification drops them, while deliberately keeping
  // console.error so genuine failures are still reportable in the field.
  esbuild: {
    pure:
      mode === 'production'
        ? ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.trace']
        : [],
    drop: mode === 'production' ? ['debugger'] : [],
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // Firebase SDK — split by namespace to enable tree-shaking
          "vendor-firebase-app": ["firebase/app"],
          "vendor-firebase-auth": ["firebase/auth"],
          "vendor-firebase-firestore": ["firebase/firestore"],
          "vendor-firebase-storage": ["firebase/storage"],
          "vendor-firebase-functions": ["firebase/functions"],
          // Heavy third-party libs
          "vendor-emailjs": ["@emailjs/browser"],
          "vendor-animation": ["framer-motion"],
          "vendor-charts": ["recharts"],
          "vendor-pdf": ["html2canvas", "jspdf"],
          "vendor-dompurify": ["dompurify"],
          // UI component library
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
          ],
        },
      },
    },
  },
}));

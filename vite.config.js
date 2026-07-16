import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
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
});

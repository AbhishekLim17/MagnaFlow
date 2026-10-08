import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/index.css";
import { installFirestoreRecovery } from "@/lib/firestoreRecovery";

installFirestoreRecovery();

// Installable app + push notifications (public/sw.js). It caches nothing, so it never serves an old deploy.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("Service worker not registered:", error?.message));
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

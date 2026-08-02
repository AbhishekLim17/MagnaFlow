import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/index.css";

// Error tracking. This is a no-op unless VITE_SENTRY_DSN is set AND the build
// is a production build, so development stays quiet and nothing leaves the
// browser until a DSN is deliberately configured.

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "tippy.js/dist/tippy.css";
// Initialize theme store — applies data-theme/data-mode to <html> before first paint
import "./stores/useThemeStore";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

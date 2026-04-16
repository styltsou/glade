import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
// Initialize store mode on top level
import "./store";
import { ThemeProvider } from "./components/ThemeProvider";
import { initMermaid } from "./lib/mermaid";

// Initialize mermaid rendering engine
initMermaid();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);

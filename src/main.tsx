import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// The webview's default browser context menu (Back/Reload/Inspect Element) has
// no place in a desktop app: "Reload" triggers a full page reload, silently
// wiping all in-memory state (every open repo tab) with no confirmation.
document.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

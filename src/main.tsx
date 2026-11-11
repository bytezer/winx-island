import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AppearanceEditor from "./settings/AppearanceEditor";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root container is missing");

createRoot(container).render(
  <StrictMode>
    {new URLSearchParams(window.location.search).get("view") === "appearance" ? <AppearanceEditor /> : <App />}
  </StrictMode>,
);

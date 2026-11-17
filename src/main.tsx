import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import SettingsApp from "./settings/SettingsApp";
import "./styles.css";
import "./settings/settings.css";

/**
 * Every window loads the same bundle. The native side marks the settings
 * window with `__winxSettingsWindow`; the hash is a manual fallback for
 * development.
 */
const isSettingsWindow =
  (window as unknown as { __winxSettingsWindow?: boolean }).__winxSettingsWindow === true ||
  window.location.hash === "#settings";

document.documentElement.dataset.window = isSettingsWindow ? "settings" : "island";
// Rendered before the settings event arrives, so the first paint is themed.
document.documentElement.dataset.theme = "midnight";

const container = document.getElementById("root");
if (!container) throw new Error("Root container is missing");

const root = createRoot(container);
root.render(
  <StrictMode>
    {isSettingsWindow ? <SettingsApp /> : <App />}
  </StrictMode>,
);

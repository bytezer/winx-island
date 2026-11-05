import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { fetchAppVersion, revealSettings } from "../../hooks/useSettings";

export function About() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchAppVersion()
      .then((value) => {
        if (active) setVersion(value);
      })
      .catch(() => {
        /* not fatal: the version line stays empty */
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="settings-section">
      <header className="settings-section-head">
        <h2>About</h2>
        <p>A Dynamic Island style media overlay for Windows 11.</p>
      </header>

      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-title">
              winx-island{version ? ` v${version}` : ""}
            </span>
            <span className="settings-row-hint">
              Settings live in %APPDATA%\winx-island\settings.yaml. Shortcut edits require a
              restart; every other setting is saved immediately.
            </span>
          </div>
          <button
            type="button"
            className="settings-button"
            onClick={() => void revealSettings()}
          >
            Open settings.yaml
          </button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-row-text">
          <span className="settings-row-title">License</span>
          <span className="settings-row-hint">
            GNU General Public License v2.0 or later (GPL-2.0-or-later). This program is free
            software: you may redistribute and modify it under the same terms, without any warranty.
          </span>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-title">Quit</span>
            <span className="settings-row-hint">Stops the overlay and closes this window.</span>
          </div>
          <button
            type="button"
            className="settings-button is-danger"
            onClick={() => void invoke("quit_app")}
          >
            Quit winx-island
          </button>
        </div>
      </div>
    </section>
  );
}

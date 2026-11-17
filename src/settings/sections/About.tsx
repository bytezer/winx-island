import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { fetchAppVersion, revealSettings } from "../../hooks/useSettings";
import { useT } from "../../i18n/LocaleContext";

export function About() {
  const t = useT();
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
        <h2>{t("settings.about.title")}</h2>
        <p>{t("settings.about.subtitle")}</p>
      </header>

      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-title">
              winx-island{version ? ` v${version}` : ""}
            </span>
            <span className="settings-row-hint">{t("settings.about.settings_hint")}</span>
          </div>
          <button
            type="button"
            className="settings-button"
            onClick={() => void revealSettings()}
          >
            {t("settings.about.open_settings_file")}
          </button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-row-text">
          <span className="settings-row-title">{t("settings.about.license")}</span>
          <span className="settings-row-hint">{t("settings.about.license_text")}</span>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-title">{t("settings.about.quit")}</span>
            <span className="settings-row-hint">{t("settings.about.quit_hint")}</span>
          </div>
          <button
            type="button"
            className="settings-button is-danger"
            onClick={() => void invoke("quit_app")}
          >
            {t("settings.about.quit_button")}
          </button>
        </div>
      </div>
    </section>
  );
}

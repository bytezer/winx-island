import { useEffect, useState } from "react";
import { useSettings, closeSettings } from "../hooks/useSettings";
import { useTheme } from "../hooks/useTheme";
import { LocaleProvider, useT } from "../i18n/LocaleContext";
import { SettingsNav, type SettingsSection } from "./SettingsNav";
import { General } from "./sections/General";
import { AppearanceEditor } from "./AppearanceEditor";
import { About } from "./sections/About";

/**
 * Rendered inside the provider on purpose: SettingsApp itself sits above
 * LocaleProvider, so a hook call there would always read the fallback locale.
 */
function SettingsHeader() {
  const t = useT();

  return (
    <header className="settings-header" data-tauri-drag-region>
      <span className="settings-title" data-tauri-drag-region>
        {t("settings.title")}
      </span>
      <button
        type="button"
        className="settings-close"
        aria-label={t("settings.close")}
        title={t("settings.close")}
        onClick={() => void closeSettings()}
      >
        <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true">
          <path
            d="M7 7l10 10M17 7L7 17"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </header>
  );
}

export default function SettingsApp() {
  const settings = useSettings();
  useTheme(settings.appearance.theme);
  const [section, setSection] = useState<SettingsSection>("general");

  // The window has no native titlebar, so Escape is the keyboard way out.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      void closeSettings();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <LocaleProvider language={settings.language}>
      <div className="settings-shell">
        <SettingsHeader />

        <div className="settings-body">
          <SettingsNav active={section} onSelect={setSection} />
          <main
            className={"settings-content" + (section === "appearance" ? " is-fullbleed" : "")}
          >
            {section === "general" && (
              <General
                visualizerEnabled={settings.visualizerEnabled}
                languageOverride={settings.languageOverride}
              />
            )}
            {section === "appearance" && <AppearanceEditor />}
            {section === "about" && <About />}
          </main>
        </div>
      </div>
    </LocaleProvider>
  );
}

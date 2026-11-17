import { changeLanguage, changeVisualizer } from "../../hooks/useSettings";
import { useT } from "../../i18n/LocaleContext";

interface GeneralProps {
  visualizerEnabled: boolean;
  /** Raw preference: null follows the Windows display language. */
  languageOverride: string | null;
}

interface LanguageOption {
  value: string | null;
  labelKey: string;
}

const LANGUAGES: LanguageOption[] = [
  { value: null, labelKey: "settings.general.language_system" },
  { value: "en", labelKey: "settings.general.language_en" },
  { value: "es", labelKey: "settings.general.language_es" },
];

export function General({ visualizerEnabled, languageOverride }: GeneralProps) {
  const t = useT();

  return (
    <section className="settings-section">
      <header className="settings-section-head">
        <h2>{t("settings.general.title")}</h2>
        <p>{t("settings.general.subtitle")}</p>
      </header>

      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-title">{t("settings.general.language")}</span>
            <span className="settings-row-hint">{t("settings.general.language_hint")}</span>
          </div>
          <div
            className="settings-lang"
            role="radiogroup"
            aria-label={t("settings.general.language")}
          >
            {LANGUAGES.map((option) => (
              <button
                key={option.labelKey}
                type="button"
                role="radio"
                aria-checked={languageOverride === option.value}
                className="settings-lang-option"
                onClick={() => void changeLanguage(option.value)}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-title">{t("settings.general.visualizer")}</span>
            <span className="settings-row-hint">{t("settings.general.visualizer_hint")}</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={visualizerEnabled}
            aria-label={t("settings.general.visualizer")}
            className="settings-switch"
            onClick={() => void changeVisualizer(!visualizerEnabled)}
          />
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-title">{t("settings.general.media_source")}</span>
            <span className="settings-row-hint">{t("settings.general.media_source_hint")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { closeSettings, revealSettings, useSettings } from "../hooks/useSettings";
import { LocaleProvider, useT } from "../i18n/LocaleContext";
import { errorText, toUiError, type UiError } from "../i18n/errors";
import { useSpectrum } from "../hooks/useLevel";
import { DEFAULT_THEME, normalizeTheme, CLASSIC_SPECTRUM } from "../lib/theme";
import { AppearancePreview } from "./AppearancePreview";
import { FrameControls } from "./FrameControls";
import type { Appearance, SettingsState, ThemeSettings, View, VisualizerColorMode, VisualizerBarStyle } from "../types";
import "./appearance.css";

const PALETTES = [
  { nameKey: "appearance_editor.palette_aurora", colors: ["#35e8c3", "#8b7bff", "#f35ac7"] },
  { nameKey: "appearance_editor.palette_ocean", colors: ["#34d399", "#38bdf8", "#6366f1"] },
  { nameKey: "appearance_editor.palette_sunset", colors: ["#fbbf24", "#fb7185", "#a78bfa"] },
];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  return (
    <label className="color-field">
      <span>{label}</span>
      <div className="color-value">
        <input type="color" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
        <span>{value.toUpperCase()}</span>
      </div>
    </label>
  );
}

function RoundnessField({ label, value, onChange, disabled = false }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  const t = useT();
  return (
    <label className="roundness-field">
      <span>{label}<output>{value}%</output></span>
      <input type="range" disabled={disabled} aria-label={label} min="0" max="100" step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <span className="range-hints"><span>{t("appearance_editor.hint_square")}</span><span>{t("appearance_editor.hint_rounded")}</span></span>
    </label>
  );
}

function useSampleSpectrum(enabled: boolean) {
  const [bands, setBands] = useState([0.45, 0.8, 0.55, 0.9, 0.65, 0.4, 0.6]);
  useEffect(() => {
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      const time = performance.now() / 1_000;
      setBands(Array.from({ length: 7 }, (_, index) => {
        const pulse = 0.5 + 0.5 * Math.sin(time * (2.3 + index * 0.21) + index * 1.4);
        return 0.12 + 0.7 * pulse * (0.65 + 0.35 * Math.sin(time * 1.1 + index) ** 2);
      }));
    }, 60);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return bands;
}

interface StudioProps {
  initial: ThemeSettings;
  appearance: Appearance;
}

export function AppearanceStudio({ initial, appearance }: StudioProps) {
  const t = useT();
  const [baseline, setBaseline] = useState(() => normalizeTheme(initial));
  const [draft, setDraft] = useState(() => normalizeTheme(initial));
  const [view, setView] = useState<View>("compact");
  const [live, setLive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [saved, setSaved] = useState(false);
  const audio = useSpectrum();
  const sample = useSampleSpectrum(!live);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  function change(patch: Partial<ThemeSettings>) {
    setDraft((current) => normalizeTheme({ ...current, ...patch }));
    setSaved(false);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const result = normalizeTheme(await invoke<ThemeSettings>("save_theme", { theme: draft }));
      setDraft(result);
      setBaseline(result);
      setSaved(true);
    } catch (reason) {
      setError({ key: "appearance_editor.save_failed", params: { error: String(reason) } });
    } finally {
      setSaving(false);
    }
  }

  /** Revert the draft to the persisted baseline without saving anything. */
  function discard() {
    setDraft(baseline);
    setError(null);
  }

  return (
    <div className="appearance-editor is-embedded">
      <div className="appearance-band">
        <span className="editor-eyebrow">{t("appearance_editor.eyebrow")}</span>
        <span className={`draft-status ${dirty ? "is-dirty" : ""}`}>
          {dirty ? t("appearance_editor.status_dirty") : saved ? t("appearance_editor.status_saved") : t("appearance_editor.status_current")}
        </span>
      </div>

      <main className="appearance-main">
        <fieldset className="appearance-controls" disabled={saving}>
          <section className="appearance-section">
            <div className="section-title"><span className="section-number">01</span><h2>{t("appearance_editor.section_island")}</h2></div>
            <div className="shape-presets" aria-label={t("appearance_editor.shapes_group")}>
              {[{ label: t("appearance_editor.shape_capsule"), value: 100 }, { label: t("appearance_editor.shape_soft"), value: 35 }, { label: t("appearance_editor.shape_square"), value: 0 }].map((preset) => (
                <button type="button" key={preset.value} aria-pressed={draft.islandRoundness === preset.value} onClick={() => change({ islandRoundness: preset.value })}>
                  <span className="shape-sample" style={{ borderRadius: `${preset.value / 5}px` }} />{preset.label}
                </button>
              ))}
            </div>
            <RoundnessField label={t("appearance_editor.island_corners")} value={draft.islandRoundness} onChange={(islandRoundness) => change({ islandRoundness })} />
            <div className="color-grid">
              <ColorField label={t("appearance_editor.background_compact")} value={draft.backgroundColor} onChange={(backgroundColor) => change({ backgroundColor })} />
              <ColorField label={t("appearance_editor.background_expanded")} value={draft.raisedColor} onChange={(raisedColor) => change({ raisedColor })} />
            </div>
          </section>

          <section className="appearance-section">
            <div className="section-title"><span className="section-number">02</span><h2>{t("appearance_editor.section_bars")}</h2></div>
            <div className="bar-style-options" role="group" aria-label={t("appearance_editor.bar_style_group")}>
              {([{ style: "smooth", label: t("appearance_editor.bar_smooth") }, { style: "segmented", label: t("appearance_editor.bar_segmented") }, { style: "dots", label: t("appearance_editor.bar_dots") }] as { style: VisualizerBarStyle; label: string }[]).map(({ style, label }) => (
                <button type="button" key={style} aria-pressed={draft.barStyle === style} onClick={() => change({ barStyle: style })}>
                  <span className="bar-style-thumbnail" data-style={style}><i /><i /><i /></span>{label}
                </button>
              ))}
            </div>
            <button type="button" className="classic-preset" onClick={() => change(CLASSIC_SPECTRUM)}><span className="classic-preset-icon" />{t("appearance_editor.classic_preset")}<span>↗</span></button>
            <RoundnessField label={t("appearance_editor.bar_ends")} value={draft.barRoundness} disabled={draft.barStyle === "dots"} onChange={(barRoundness) => change({ barRoundness })} />
            {draft.barStyle === "dots" && <p className="bar-style-hint">{t("appearance_editor.dots_hint")}</p>}
            <div className="color-mode" role="group" aria-label={t("appearance_editor.color_mode_group")}>
              {([{ mode: "rgb", label: t("appearance_editor.color_rgb") }, { mode: "gradient", label: t("appearance_editor.color_gradient") }, { mode: "solid", label: t("appearance_editor.color_solid") }] as { mode: VisualizerColorMode; label: string }[]).map(({ mode, label }) => (
                <button type="button" key={mode} aria-pressed={draft.colorMode === mode} onClick={() => change({ colorMode: mode })}>{label}</button>
              ))}
            </div>
            {draft.colorMode === "rgb" ? (
              <div className="rgb-description"><div className="rgb-strip" /><p>{t("appearance_editor.rgb_hint")}</p></div>
            ) : draft.colorMode === "solid" ? (
              <ColorField label={t("appearance_editor.bar_color")} value={draft.solidColor} onChange={(solidColor) => change({ solidColor })} />
            ) : (
              <>
                <div className="gradient-direction" role="group" aria-label={t("appearance_editor.gradient_direction_group")}>
                  <button type="button" aria-pressed={draft.gradientDirection === "horizontal"} onClick={() => change({ gradientDirection: "horizontal" })}>{t("appearance_editor.gradient_horizontal")}</button>
                  <button type="button" aria-pressed={draft.gradientDirection === "vertical"} onClick={() => change({ gradientDirection: "vertical" })}>{t("appearance_editor.gradient_vertical")}</button>
                </div>
                <div className="palette-presets" aria-label={t("appearance_editor.palettes_group")}>
                  {PALETTES.map(({ nameKey, colors }) => {
                    const name = t(nameKey);
                    return (
                      <button type="button" key={nameKey} title={name} aria-label={t("appearance_editor.palette_aria", { name })} onClick={() => change({ gradientStart: colors[0], gradientMiddle: colors[1], gradientEnd: colors[2] })}>
                        <span style={{ background: `linear-gradient(90deg, ${colors.join(",")})` }} />{name}
                      </button>
                    );
                  })}
                </div>
                <div className="gradient-colors">
                  <ColorField label={t("appearance_editor.gradient_start")} value={draft.gradientStart} onChange={(gradientStart) => change({ gradientStart })} />
                  <ColorField label={t("appearance_editor.gradient_middle")} value={draft.gradientMiddle} onChange={(gradientMiddle) => change({ gradientMiddle })} />
                  <ColorField label={t("appearance_editor.gradient_end")} value={draft.gradientEnd} onChange={(gradientEnd) => change({ gradientEnd })} />
                </div>
              </>
            )}
            <label className="glow-toggle"><span><strong>{t("appearance_editor.peaks")}</strong><small>{t("appearance_editor.peaks_hint")}</small></span><input type="checkbox" aria-label={t("appearance_editor.peaks")} checked={draft.peakEnabled} onChange={(event) => change({ peakEnabled: event.target.checked })} /></label>
            {draft.peakEnabled && (
              <div className="peak-controls">
                <label className="roundness-field"><span>{t("appearance_editor.peak_hold")}<output>{draft.peakHoldMs} ms</output></span><input type="range" aria-label={t("appearance_editor.peak_hold")} min="0" max="1000" step="20" value={draft.peakHoldMs} onChange={(event) => change({ peakHoldMs: Number(event.target.value) })} /><span className="range-hints"><span>{t("appearance_editor.peak_hold_none")}</span><span>{t("appearance_editor.peak_hold_one_second")}</span></span></label>
                <label className="roundness-field"><span>{t("appearance_editor.peak_gravity")}<output>{Math.round((draft.peakGravity - 40) / 360 * 100)}%</output></span><input type="range" aria-label={t("appearance_editor.peak_gravity")} min="40" max="400" step="10" value={draft.peakGravity} onChange={(event) => change({ peakGravity: Number(event.target.value) })} /><span className="range-hints"><span>{t("appearance_editor.gravity_slow")}</span><span>{t("appearance_editor.gravity_fast")}</span></span></label>
              </div>
            )}
            <label className="glow-toggle"><span><strong>{t("appearance_editor.glow")}</strong><small>{t("appearance_editor.glow_hint")}</small></span><input type="checkbox" checked={draft.glow} onChange={(event) => change({ glow: event.target.checked })} /></label>
          </section>

          <FrameControls appearance={appearance} />
          <button type="button" className="editor-advanced" onClick={() => void revealSettings().catch((reason: unknown) => setError(toUiError(reason)))}>{t("appearance_editor.open_settings_file")}</button>
        </fieldset>

        <aside className="appearance-preview-pane">
          <div className="preview-heading"><span className="editor-eyebrow">{t("appearance_editor.preview_eyebrow")}</span><span className="preview-live-dot" />{t("appearance_editor.preview_live")}</div>
          <div className="preview-view-tabs" role="group" aria-label={t("appearance_editor.preview_view_group")}>
            {[{ value: "compact", label: t("appearance_editor.preview_compact") }, { value: "hover", label: t("appearance_editor.preview_expanded") }, { value: "panel", label: t("appearance_editor.preview_panel") }].map(({ value, label }) => (
              <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value as View)}>{label}</button>
            ))}
          </div>
          <AppearancePreview appearance={appearance} theme={draft} bands={live ? audio : sample} view={view} />
          <div className="preview-source" role="group" aria-label={t("appearance_editor.preview_source_group")}>
            <button type="button" aria-pressed={!live} onClick={() => setLive(false)}>{t("appearance_editor.preview_sample")}</button>
            <button type="button" aria-pressed={live} onClick={() => setLive(true)}>{t("appearance_editor.preview_real")}</button>
          </div>
          <p className="preview-note">{live ? audio.some((value) => value > 0.01) ? t("appearance_editor.preview_note_live") : t("appearance_editor.preview_note_silent") : t("appearance_editor.preview_note_sample")}</p>
          <div className="preview-save-note"><span>✦</span><p>{t("appearance_editor.preview_save_note_1")}<br />{t("appearance_editor.preview_save_note_2")}</p></div>
        </aside>
      </main>

      <footer className="appearance-footer">
        <button type="button" className="editor-reset" disabled={saving} onClick={() => change(DEFAULT_THEME)}>{t("appearance_editor.reset")}</button>
        <div className="editor-feedback" role={error ? "alert" : "status"}>{errorText(t, error) ?? (saved ? t("appearance_editor.saved") : "")}</div>
        <button type="button" className="editor-cancel" disabled={!dirty || saving} onClick={discard}>{t("appearance_editor.cancel")}</button>
        <button type="button" className="editor-save" disabled={!dirty || saving} onClick={() => void save()}>{saving ? t("appearance_editor.saving") : t("appearance_editor.save")}</button>
      </footer>
    </div>
  );
}

export function AppearanceEditor(): ReactNode {
  // Live language: the editor is a section of the settings window now, but it
  // is still the same bundle, so it must follow `island://settings` too.
  const { language } = useSettings();
  return <LocaleProvider language={language}><AppearanceEditorContent /></LocaleProvider>;
}

/** Rendered inside the provider so its copy follows the live language. */
function AppearanceEditorContent() {
  const t = useT();
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  useEffect(() => {
    let active = true;
    void invoke<SettingsState>("get_settings").then((value) => {
      if (active) setSettings(value);
    }).catch((reason: unknown) => { if (active) setError(toUiError(reason)); });
    return () => { active = false; };
  }, []);
  if (!settings) {
    return <div className="appearance-loading"><h1>{t("appearance_editor.window_title")}</h1><p role={error ? "alert" : "status"}>{errorText(t, error) ?? t("appearance_editor.loading")}</p><button type="button" onClick={() => void closeSettings()}>{t("appearance_editor.dismiss")}</button></div>;
  }
  return <AppearanceStudio initial={settings.theme ?? DEFAULT_THEME} appearance={settings.appearance} />;
}

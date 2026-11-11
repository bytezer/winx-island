import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { revealSettings } from "../hooks/useSettings";
import { useSpectrum } from "../hooks/useLevel";
import { DEFAULT_THEME, normalizeTheme, CLASSIC_SPECTRUM } from "../lib/theme";
import { AppearancePreview } from "./AppearancePreview";
import type { Appearance, SettingsState, ThemeSettings, View, VisualizerColorMode, VisualizerBarStyle } from "../types";
import "./appearance.css";

const PALETTES = [
  { name: "Aurora", colors: ["#35e8c3", "#8b7bff", "#f35ac7"] },
  { name: "Océano", colors: ["#34d399", "#38bdf8", "#6366f1"] },
  { name: "Atardecer", colors: ["#fbbf24", "#fb7185", "#a78bfa"] },
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
  return (
    <label className="roundness-field">
      <span>{label}<output>{value}%</output></span>
      <input type="range" disabled={disabled} aria-label={label} min="0" max="100" step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <span className="range-hints"><span>Recto</span><span>Redondeado</span></span>
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
  onClose: () => Promise<void>;
}

export function AppearanceStudio({ initial, appearance, onClose }: StudioProps) {
  const [baseline, setBaseline] = useState(() => normalizeTheme(initial));
  const [draft, setDraft] = useState(() => normalizeTheme(initial));
  const [view, setView] = useState<View>("compact");
  const [live, setLive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setError(`No se pudo guardar. ${String(reason)}`);
    } finally {
      setSaving(false);
    }
  }

  async function close() {
    try { await onClose(); } catch (reason) { setError(String(reason)); }
  }

  return (
    <div className="appearance-editor">
      <header className="appearance-header">
        <div><span className="editor-eyebrow">WINX ISLAND / A TU MANERA</span><h1>Hazla tuya.</h1><p>Una isla que encaje con tu estilo.</p></div>
        <span className={`draft-status ${dirty ? "is-dirty" : ""}`}>{dirty ? "Sin guardar" : saved ? "Guardado" : "Aspecto actual"}</span>
      </header>

      <main className="appearance-main">
        <fieldset className="appearance-controls" disabled={saving}>
          <section className="appearance-section">
            <div className="section-title"><span className="section-number">01</span><h2>La isla</h2></div>
            <div className="shape-presets" aria-label="Formas de la isla">
              {[{ label: "Cápsula", value: 100 }, { label: "Suave", value: 35 }, { label: "Recta", value: 0 }].map((preset) => (
                <button type="button" key={preset.label} aria-pressed={draft.islandRoundness === preset.value} onClick={() => change({ islandRoundness: preset.value })}>
                  <span className="shape-sample" style={{ borderRadius: `${preset.value / 5}px` }} />{preset.label}
                </button>
              ))}
            </div>
            <RoundnessField label="Esquinas de la isla" value={draft.islandRoundness} onChange={(islandRoundness) => change({ islandRoundness })} />
            <div className="color-grid">
              <ColorField label="Fondo compacto" value={draft.backgroundColor} onChange={(backgroundColor) => change({ backgroundColor })} />
              <ColorField label="Fondo ampliado" value={draft.raisedColor} onChange={(raisedColor) => change({ raisedColor })} />
            </div>
          </section>

          <section className="appearance-section">
            <div className="section-title"><span className="section-number">02</span><h2>Las barras</h2></div>
            <div className="bar-style-options" role="group" aria-label="Estilo de barras">
              {([{ style: "smooth", label: "Continuas" }, { style: "segmented", label: "Segmentos" }, { style: "dots", label: "Puntos" }] as { style: VisualizerBarStyle; label: string }[]).map(({ style, label }) => (
                <button type="button" key={style} aria-pressed={draft.barStyle === style} onClick={() => change({ barStyle: style })}>
                  <span className="bar-style-thumbnail" data-style={style}><i /><i /><i /></span>{label}
                </button>
              ))}
            </div>
            <button type="button" className="classic-preset" onClick={() => change(CLASSIC_SPECTRUM)}><span className="classic-preset-icon" />Clásico con picos<span>↗</span></button>
            <RoundnessField label="Extremos de las barras" value={draft.barRoundness} disabled={draft.barStyle === "dots"} onChange={(barRoundness) => change({ barRoundness })} />
            {draft.barStyle === "dots" && <p className="bar-style-hint">Los puntos siempre son circulares.</p>}
            <div className="color-mode" role="group" aria-label="Modo de color">
              {([{ mode: "rgb", label: "RGB" }, { mode: "gradient", label: "Degradado" }, { mode: "solid", label: "Un color" }] as { mode: VisualizerColorMode; label: string }[]).map(({ mode, label }) => (
                <button type="button" key={mode} aria-pressed={draft.colorMode === mode} onClick={() => change({ colorMode: mode })}>{label}</button>
              ))}
            </div>
            {draft.colorMode === "rgb" ? (
              <div className="rgb-description"><div className="rgb-strip" /><p>El recorrido original de cian, azul, violeta y rosa.</p></div>
            ) : draft.colorMode === "solid" ? (
              <ColorField label="Color de las barras" value={draft.solidColor} onChange={(solidColor) => change({ solidColor })} />
            ) : (
              <>
                <div className="gradient-direction" role="group" aria-label="Dirección del degradado">
                  <button type="button" aria-pressed={draft.gradientDirection === "horizontal"} onClick={() => change({ gradientDirection: "horizontal" })}>Por columnas →</button>
                  <button type="button" aria-pressed={draft.gradientDirection === "vertical"} onClick={() => change({ gradientDirection: "vertical" })}>Por altura ↑</button>
                </div>
                <div className="palette-presets" aria-label="Paletas de color">
                  {PALETTES.map(({ name, colors }) => (
                    <button type="button" key={name} title={name} aria-label={`Paleta ${name}`} onClick={() => change({ gradientStart: colors[0], gradientMiddle: colors[1], gradientEnd: colors[2] })}>
                      <span style={{ background: `linear-gradient(90deg, ${colors.join(",")})` }} />{name}
                    </button>
                  ))}
                </div>
                <div className="gradient-colors">
                  <ColorField label="Inicio" value={draft.gradientStart} onChange={(gradientStart) => change({ gradientStart })} />
                  <ColorField label="Centro" value={draft.gradientMiddle} onChange={(gradientMiddle) => change({ gradientMiddle })} />
                  <ColorField label="Final" value={draft.gradientEnd} onChange={(gradientEnd) => change({ gradientEnd })} />
                </div>
              </>
            )}
            <label className="glow-toggle"><span><strong>Indicadores de pico</strong><small>Conservan el máximo y caen con gravedad.</small></span><input type="checkbox" aria-label="Indicadores de pico" checked={draft.peakEnabled} onChange={(event) => change({ peakEnabled: event.target.checked })} /></label>
            {draft.peakEnabled && (
              <div className="peak-controls">
                <label className="roundness-field"><span>Retención del pico<output>{draft.peakHoldMs} ms</output></span><input type="range" aria-label="Retención del pico" min="0" max="1000" step="20" value={draft.peakHoldMs} onChange={(event) => change({ peakHoldMs: Number(event.target.value) })} /><span className="range-hints"><span>Sin espera</span><span>1 segundo</span></span></label>
                <label className="roundness-field"><span>Velocidad de caída<output>{Math.round((draft.peakGravity - 40) / 360 * 100)}%</output></span><input type="range" aria-label="Velocidad de caída" min="40" max="400" step="10" value={draft.peakGravity} onChange={(event) => change({ peakGravity: Number(event.target.value) })} /><span className="range-hints"><span>Lenta</span><span>Rápida</span></span></label>
              </div>
            )}
            <label className="glow-toggle"><span><strong>Brillo suave</strong><small>Un halo sutil alrededor de la isla y las barras.</small></span><input type="checkbox" checked={draft.glow} onChange={(event) => change({ glow: event.target.checked })} /></label>
          </section>
          <button type="button" className="editor-advanced" onClick={() => void revealSettings().catch((reason: unknown) => setError(String(reason)))}>Abrir archivo de ajustes ↗</button>
        </fieldset>

        <aside className="appearance-preview-pane">
          <div className="preview-heading"><span className="editor-eyebrow">VISTA PREVIA</span><span className="preview-live-dot" />En tiempo real</div>
          <div className="preview-view-tabs" role="group" aria-label="Estado de la vista previa">
            {[{ value: "compact", label: "Compacta" }, { value: "hover", label: "Ampliada" }, { value: "panel", label: "Panel" }].map(({ value, label }) => (
              <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value as View)}>{label}</button>
            ))}
          </div>
          <AppearancePreview appearance={appearance} theme={draft} bands={live ? audio : sample} view={view} />
          <div className="preview-source" role="group" aria-label="Audio de la vista previa">
            <button type="button" aria-pressed={!live} onClick={() => setLive(false)}>Animación de ejemplo</button>
            <button type="button" aria-pressed={live} onClick={() => setLive(true)}>Audio real</button>
          </div>
          <p className="preview-note">{live ? audio.some((value) => value > 0.01) ? "Las barras siguen el audio de Windows." : "Reproduce música para ver las barras con audio real." : "Prueba el aspecto aunque no haya música sonando."}</p>
          <div className="preview-save-note"><span>✦</span><p>La previsualización cambia al instante.<br />Tu isla se actualiza al guardar.</p></div>
        </aside>
      </main>

      <footer className="appearance-footer">
        <button type="button" className="editor-reset" disabled={saving} onClick={() => change(DEFAULT_THEME)}>Restablecer aspecto</button>
        <div className="editor-feedback" role={error ? "alert" : "status"}>{error ?? (saved ? "Cambios guardados en la isla." : "")}</div>
        <button type="button" className="editor-cancel" disabled={saving} onClick={() => void close()}>{dirty ? "Cancelar" : "Cerrar"}</button>
        <button type="button" className="editor-save" disabled={!dirty || saving} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar y aplicar"}</button>
      </footer>
    </div>
  );
}

export default function AppearanceEditor() {
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void invoke<SettingsState>("get_settings").then((value) => {
      if (active) setSettings(value);
    }).catch((reason: unknown) => { if (active) setError(String(reason)); });
    return () => { active = false; };
  }, []);
  if (!settings) {
    return <div className="appearance-loading"><h1>Personalizar apariencia</h1><p role={error ? "alert" : "status"}>{error ?? "Cargando tu aspecto…"}</p><button type="button" onClick={() => void getCurrentWindow().close()}>Cerrar</button></div>;
  }
  return <AppearanceStudio initial={settings.theme ?? DEFAULT_THEME} appearance={settings.appearance} onClose={() => getCurrentWindow().close()} />;
}

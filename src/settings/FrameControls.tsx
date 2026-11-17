import { useCallback, useEffect, useRef, useState } from "react";
import { changeCompactSize, changeTheme, resetPosition } from "../hooks/useSettings";
import { THEMES } from "../hooks/useTheme";
import { useT } from "../i18n/LocaleContext";
import type { Appearance } from "../types";

const MIN_WIDTH = 100;
const MAX_WIDTH = 320;
const MIN_HEIGHT = 28;
const MAX_HEIGHT = 64;

/** How long the slider has to rest before the value is written to disk. */
const PERSIST_DELAY_MS = 160;

interface Size {
  width: number;
  height: number;
}

interface FrameControlsProps {
  appearance: Appearance;
}

/**
 * "The frame" block of the appearance editor: the controls that apply
 * immediately (theme, pill size, position), unlike the bar styling above them,
 * which is part of the draft and only lands on Save.
 */
export function FrameControls({ appearance }: FrameControlsProps) {
  const t = useT();

  // Local draft for the sliders. It starts from the persisted values, but the
  // first native snapshot can arrive after mount (useSettings renders DEFAULTS
  // first), so it is treated as provisional until the user touches a slider.
  const [width, setWidth] = useState(appearance.compactWidth);
  const [height, setHeight] = useState(appearance.compactHeight);

  // Refs keep the latest draft readable from the unmount cleanup without stale
  // closures.
  const draft = useRef<Size>({ width, height });
  // False until a slider moves: persisted values must win while it is false,
  // otherwise the DEFAULT size would be written over a custom one.
  const dirty = useRef(false);
  // Last size handed to the native side, so a flush after a debounce write does
  // not save the same values twice.
  const sent = useRef<Size | null>(null);

  const persist = useCallback((next: Size) => {
    const previous = sent.current;
    if (previous && previous.width === next.width && previous.height === next.height) return;
    sent.current = next;
    void changeCompactSize(next.width, next.height);
  }, []);

  // Persisted values win while the draft is clean; once the user is dragging,
  // only an echo that matches the draft releases the dirty flag.
  useEffect(() => {
    if (dirty.current) {
      if (
        appearance.compactWidth === draft.current.width &&
        appearance.compactHeight === draft.current.height
      ) {
        dirty.current = false;
        sent.current = null;
      }
      return;
    }
    if (appearance.compactWidth === width && appearance.compactHeight === height) return;
    draft.current = { width: appearance.compactWidth, height: appearance.compactHeight };
    setWidth(appearance.compactWidth);
    setHeight(appearance.compactHeight);
  }, [appearance.compactWidth, appearance.compactHeight, width, height]);

  // Debounced write while the draft is dirty; no clean draft ever writes.
  useEffect(() => {
    if (!dirty.current) return;
    if (width === appearance.compactWidth && height === appearance.compactHeight) {
      // Dragged back to the saved size: the draft is clean again.
      dirty.current = false;
      sent.current = null;
      return;
    }
    const timeout = window.setTimeout(() => {
      persist({ width, height });
    }, PERSIST_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [width, height, appearance.compactWidth, appearance.compactHeight, persist]);

  // Leaving the section unmounts this component with the debounce possibly
  // still pending; flush the latest draft instead of dropping the change.
  useEffect(() => {
    return () => {
      if (!dirty.current) return;
      persist(draft.current);
    };
  }, [persist]);

  const commit = useCallback(() => {
    if (!dirty.current) return;
    const next = draft.current;
    if (next.width === appearance.compactWidth && next.height === appearance.compactHeight) {
      // Dragged back to the saved size: nothing to write.
      dirty.current = false;
      return;
    }
    persist(next);
  }, [appearance.compactWidth, appearance.compactHeight, persist]);

  const updateWidth = (value: number) => {
    dirty.current = true;
    draft.current = { ...draft.current, width: value };
    setWidth(value);
  };

  const updateHeight = (value: number) => {
    dirty.current = true;
    draft.current = { ...draft.current, height: value };
    setHeight(value);
  };

  return (
    <section className="appearance-section frame-section" data-immediate>
      <div className="section-title">
        <span className="section-number">03</span>
        <h2>{t("settings.frame.title")}</h2>
      </div>
      <p className="frame-hint">{t("settings.frame.hint")}</p>

      <div className="frame-swatches">
        <div className="settings-row-text">
          <span className="settings-row-title">{t("settings.appearance.theme")}</span>
          <span className="settings-row-hint">{t("settings.appearance.theme_hint")}</span>
        </div>
        <div
          className="settings-theme-grid"
          role="radiogroup"
          aria-label={t("settings.appearance.theme")}
        >
          {THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={appearance.theme === theme}
              className="settings-theme"
              onClick={() => void changeTheme(theme)}
            >
              <span className={`settings-swatch settings-swatch-${theme}`} />
              {t(`settings.theme_names.${theme}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="frame-slider">
        <div className="settings-row-text">
          <span className="settings-row-title">{t("settings.appearance.pill_size")}</span>
          <span className="settings-row-hint">{t("settings.appearance.pill_size_hint")}</span>
        </div>

        <div className="settings-size-sliders">
          <div className="settings-slider">
            <span className="settings-slider-label">{t("settings.appearance.width")}</span>
            <input
              type="range"
              min={MIN_WIDTH}
              max={MAX_WIDTH}
              step={1}
              value={width}
              aria-label={t("settings.appearance.width")}
              onChange={(event) => updateWidth(Number(event.target.value))}
              onPointerUp={commit}
              onKeyUp={commit}
              onBlur={commit}
            />
            <span className="settings-slider-value">{width} px</span>
          </div>

          <div className="settings-slider">
            <span className="settings-slider-label">{t("settings.appearance.height")}</span>
            <input
              type="range"
              min={MIN_HEIGHT}
              max={MAX_HEIGHT}
              step={1}
              value={height}
              aria-label={t("settings.appearance.height")}
              onChange={(event) => updateHeight(Number(event.target.value))}
              onPointerUp={commit}
              onKeyUp={commit}
              onBlur={commit}
            />
            <span className="settings-slider-value">{height} px</span>
          </div>
        </div>
      </div>

      <div className="frame-actions">
        <div className="settings-row-text">
          <span className="settings-row-title">{t("settings.appearance.position")}</span>
          <span className="settings-row-hint">{t("settings.appearance.position_hint")}</span>
        </div>
        <button type="button" className="settings-button" onClick={() => void resetPosition()}>
          {t("settings.appearance.reset_position")}
        </button>
      </div>
    </section>
  );
}

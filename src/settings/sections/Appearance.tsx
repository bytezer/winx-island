import { useCallback, useEffect, useRef, useState } from "react";
import { changeCompactSize, changeTheme, resetPosition } from "../../hooks/useSettings";
import { THEMES, THEME_LABELS } from "../../hooks/useTheme";
import type { Appearance as AppearanceSettings } from "../../types";

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

interface AppearanceProps {
  appearance: AppearanceSettings;
}

export function Appearance({ appearance }: AppearanceProps) {
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
    <section className="settings-section">
      <header className="settings-section-head">
        <h2>Appearance</h2>
        <p>Colour theme and the size of the collapsed pill.</p>
      </header>

      <div className="settings-card">
        <div className="settings-row-text">
          <span className="settings-row-title">Theme</span>
          <span className="settings-row-hint">Applies to the island and this window.</span>
        </div>
        <div className="settings-theme-grid" role="radiogroup" aria-label="Theme">
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
              {THEME_LABELS[theme]}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-row-text">
          <span className="settings-row-title">Pill size</span>
          <span className="settings-row-hint">The hover card and panel keep their own size.</span>
        </div>

        <div className="settings-size-grid">
          <div className="settings-size-sliders">
            <div className="settings-slider">
              <span className="settings-slider-label">Width</span>
              <input
                type="range"
                min={MIN_WIDTH}
                max={MAX_WIDTH}
                step={1}
                value={width}
                aria-label="Pill width"
                onChange={(event) => updateWidth(Number(event.target.value))}
                onPointerUp={commit}
                onKeyUp={commit}
                onBlur={commit}
              />
              <span className="settings-slider-value">{width} px</span>
            </div>

            <div className="settings-slider">
              <span className="settings-slider-label">Height</span>
              <input
                type="range"
                min={MIN_HEIGHT}
                max={MAX_HEIGHT}
                step={1}
                value={height}
                aria-label="Pill height"
                onChange={(event) => updateHeight(Number(event.target.value))}
                onPointerUp={commit}
                onKeyUp={commit}
                onBlur={commit}
              />
              <span className="settings-slider-value">{height} px</span>
            </div>
          </div>

          <div className="settings-preview">
            <div
              className="settings-preview-pill"
              style={{
                width,
                height,
                borderRadius: Math.min(height / 2, 22),
                // Shrunk to fit the preview stage, never enlarged.
                transform: `scale(${Math.min(1, 148 / width, 64 / height)})`,
              }}
            >
              <span className="settings-preview-dot" />
              <span className="settings-preview-bars">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-title">Position</span>
            <span className="settings-row-hint">
              Move the island back to the top centre of the primary display.
            </span>
          </div>
          <button
            type="button"
            className="settings-button"
            onClick={() => void resetPosition()}
          >
            Reset position
          </button>
        </div>
      </div>
    </section>
  );
}

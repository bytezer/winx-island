import { changeVisualizer } from "../../hooks/useSettings";

interface GeneralProps {
  visualizerEnabled: boolean;
}

export function General({ visualizerEnabled }: GeneralProps) {
  return (
    <section className="settings-section">
      <header className="settings-section-head">
        <h2>General</h2>
        <p>Overlay behaviour and where the media data comes from.</p>
      </header>

      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-title">Visualizer</span>
            <span className="settings-row-hint">
              Show a live 24-band spectrum next to the transport controls, captured from the
              default output device while something is playing.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={visualizerEnabled}
            aria-label="Visualizer"
            className="settings-switch"
            onClick={() => void changeVisualizer(!visualizerEnabled)}
          />
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-title">Media source</span>
            <span className="settings-row-hint">
              Track data comes from the Windows System Media Transport Controls (SMTC), so Spotify,
              browsers, VLC and any other well-behaved player are picked up automatically. No account
              or extra plugin is needed.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

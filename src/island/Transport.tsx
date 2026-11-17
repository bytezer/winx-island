import type { MediaAction, MediaSnapshot } from "../types";
import { useT } from "../i18n/LocaleContext";

interface TransportProps {
  media: MediaSnapshot;
  large?: boolean;
  busy?: boolean;
  onAction: (action: MediaAction) => void;
}

function PreviousIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M7 5v14M19 5.5v13L9.5 12z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M17 5v14M5 5.5v13L14.5 12z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function PlayIcon({ large }: { large?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={large ? 20 : 16} height={large ? 20 : 16} aria-hidden="true">
      <path d="M8 5.2v13.6L19 12z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon({ large }: { large?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={large ? 20 : 16} height={large ? 20 : 16} aria-hidden="true">
      <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" />
    </svg>
  );
}

function ShuffleIcon() {
  return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h2c5 0 7 12 12 12h4m-4-4 4 4-4 4M3 18h2c2.5 0 4.2-3 6-6s3.5-6 6-6h4m-4-4 4 4-4 4" />
  </svg>;
}

function RepeatIcon({ one }: { one: boolean }) {
  return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m16 2 4 4-4 4M20 6H7a4 4 0 0 0-4 4m5 12-4-4 4-4m-4 4h13a4 4 0 0 0 4-4" />
    {one && <path d="m10 11 2-1v5m-2 0h4" />}
  </svg>;
}

export function Transport({ media, large, busy = false, onAction }: TransportProps) {
  const t = useT();
  const local = media.sourceApp === "winx-island.local";
  const repeat = media.repeatMode || "off";
  const modeKey = repeat === "one" ? "island.transport.repeat_one" : repeat === "all" ? "island.transport.repeat_all" : "island.transport.repeat_off";
  const repeatLabel = t("island.transport.repeat", { mode: t(modeKey) });
  const stop = (event: React.MouseEvent, action: MediaAction) => {
    event.stopPropagation();
    onAction(action);
  };

  return (
    <div className={`transport ${large ? "transport-large" : ""}`}>
      {local && <button type="button" className="icon-button mode-button" disabled={busy} onClick={(event) => stop(event, "shuffle")}
        aria-label={t("island.transport.shuffle")} aria-pressed={media.shuffleEnabled} title={media.shuffleEnabled ? t("island.transport.shuffle_on") : t("island.transport.shuffle_off")}>
        <ShuffleIcon />
      </button>}
      <button
        type="button"
        className="icon-button"
        disabled={!media.canPrev}
        onClick={(event) => stop(event, "prev")}
        aria-label={t("island.transport.previous")}
      >
        <PreviousIcon />
      </button>
      <button
        type="button"
        className={`play-button ${large ? "play-button-large" : ""}`}
        disabled={busy || media.canPlayPause === false}
        onClick={(event) => stop(event, "play_pause")}
        aria-label={!media.available && !media.sourceSelection ? t("island.transport.open_files") : media.playing ? t("island.transport.pause") : t("island.transport.play")}
      >
        {media.playing ? <PauseIcon large={large} /> : <PlayIcon large={large} />}
      </button>
      <button
        type="button"
        className="icon-button"
        disabled={!media.canNext}
        onClick={(event) => stop(event, "next")}
        aria-label={t("island.transport.next")}
      >
        <NextIcon />
      </button>
      {local && <button type="button" className="icon-button mode-button" disabled={busy} onClick={(event) => stop(event, "repeat")}
        aria-label={repeatLabel} aria-pressed={repeat !== "off"} title={t("island.transport.repeat_change", { label: repeatLabel })}>
        <RepeatIcon one={repeat === "one"} />
      </button>}
    </div>
  );
}

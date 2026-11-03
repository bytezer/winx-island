import type { MediaSnapshot } from "../types";

interface TransportProps {
  media: MediaSnapshot;
  large?: boolean;
  onAction: (action: "play_pause" | "next" | "prev") => void;
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

export function Transport({ media, large, onAction }: TransportProps) {
  const stop = (event: React.MouseEvent, action: "play_pause" | "next" | "prev") => {
    event.stopPropagation();
    onAction(action);
  };

  return (
    <div className={`transport ${large ? "transport-large" : ""}`}>
      <button
        type="button"
        className="icon-button"
        disabled={!media.available || !media.canPrev}
        onClick={(event) => stop(event, "prev")}
        aria-label="Previous track"
      >
        <PreviousIcon />
      </button>
      <button
        type="button"
        className={`play-button ${large ? "play-button-large" : ""}`}
        disabled={!media.available}
        onClick={(event) => stop(event, "play_pause")}
        aria-label={media.playing ? "Pause" : "Play"}
      >
        {media.playing ? <PauseIcon large={large} /> : <PlayIcon large={large} />}
      </button>
      <button
        type="button"
        className="icon-button"
        disabled={!media.available || !media.canNext}
        onClick={(event) => stop(event, "next")}
        aria-label="Next track"
      >
        <NextIcon />
      </button>
    </div>
  );
}

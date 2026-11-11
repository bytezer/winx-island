import type { MediaSnapshot, MusicLibraryActions } from "../types";

interface MusicLibraryControlsProps {
  media: MediaSnapshot;
  library: MusicLibraryActions;
}

export function MusicLibraryControls({ media, library }: MusicLibraryControlsProps) {
  const local = media.sourceApp === "winx-island.local";

  return (
    <div className="music-library" onClick={(event) => event.stopPropagation()}>
      <div className="music-library-actions">
        <button
          type="button"
          className="music-open"
          disabled={library.busy}
          onClick={library.onFolders}
          title="Add one or more folders, including music in subfolders"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v2M3 7h16a2 2 0 0 1 2 2l-2 10H3L1 9a2 2 0 0 1 2-2Z" />
          </svg>
          {library.busy ? "Adding…" : "Add folders"}
        </button>
        <button type="button" className="music-system" disabled={library.busy} onClick={library.onOpen} title="Choose individual music files" aria-label="Open music files">
          Files
        </button>
        {local && (
          <>
            <span className="music-queue">{media.queueIndex + 1} / {media.queueLength}</span>
            <button type="button" className="music-system" aria-label="Switch to Windows controls" onClick={library.onSystem} disabled={library.busy} title="Pause local playback and control other Windows apps">
              Windows
            </button>
          </>
        )}
      </div>
      {library.error && <div className="music-error" role="alert" title={library.error}>{library.error}</div>}
    </div>
  );
}

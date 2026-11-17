import { errorText } from "../i18n/errors";
import { useT } from "../i18n/LocaleContext";
import type { MediaSnapshot, MusicLibraryActions } from "../types";

interface MusicLibraryControlsProps {
  media: MediaSnapshot;
  library: MusicLibraryActions;
  showSources?: boolean;
}

export function MusicLibraryControls({ media, library, showSources = true }: MusicLibraryControlsProps) {
  const t = useT();
  const local = media.sourceApp === "winx-island.local";
  const errorMessage = errorText(t, library.error);

  return (
    <div className="music-library" onClick={(event) => event.stopPropagation()}>
      <div className="music-library-actions">
        <button
          type="button"
          className="music-open"
          disabled={library.busy}
          onClick={library.onFolders}
          title={t("island.library.add_folders_title")}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v2M3 7h16a2 2 0 0 1 2 2l-2 10H3L1 9a2 2 0 0 1 2-2Z" />
          </svg>
          {library.busy ? t("island.library.adding") : t("island.library.add_folders")}
        </button>
        <button type="button" className="music-system" disabled={library.busy} onClick={library.onOpen} title={t("island.library.files_title")} aria-label={t("island.transport.open_files")}>
          {t("island.library.files")}
        </button>
        {local && (
          <>
            <span className="music-queue">{t("island.library.queue", { index: media.queueIndex + 1, total: media.queueLength })}</span>
            <button type="button" className="music-system" aria-label={t("island.library.windows_aria")} onClick={library.onSystem} disabled={library.busy} title={t("island.library.windows_title")}>
              {t("island.library.windows")}
            </button>
          </>
        )}
      </div>
      {showSources && <MediaSourceControls media={media} library={library} />}
      {errorMessage && <div className="music-error" role="alert" title={errorMessage}>{errorMessage}</div>}
    </div>
  );
}

export function MediaSourceControls({ media, library }: MusicLibraryControlsProps) {
  const t = useT();
  if (!library.onSource || !media.sourceSelection) return null;
  return (
    <div className="media-sources" role="group" aria-label={t("island.library.sources_group")} onClick={(event) => event.stopPropagation()}>
        <button type="button" aria-pressed={media.sourceSelection === "auto"} onClick={() => library.onSource?.("auto")} title={t("island.library.source_auto_title")}>{t("island.library.source_auto")}</button>
        <button type="button" aria-pressed={media.sourceSelection === "system"} onClick={() => library.onSource?.("system")} title={t("island.library.source_system_title")}>{t("island.library.source_system")}</button>
        {media.sources?.map(source => {
          // App labels ("Spotify") are not keys, so `t` returns them unchanged.
          const label = t(source.label);
          return <button type="button" key={source.id} data-source-id={source.id} aria-label={`${label}: ${source.title || t("island.library.source_no_title")}`} aria-pressed={media.sourceSelection === source.id} data-current={media.selectedSourceId === source.id}
          onClick={() => library.onSource?.(source.id)} title={`${label}${source.title ? ` · ${source.title}` : ""}${source.playing ? ` · ${t("island.library.source_playing")}` : ""}`}>
          {source.playing && <span aria-hidden="true">● </span>}{label}
        </button>; })}
    </div>
  );
}

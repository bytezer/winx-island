import type { Shortcut } from "../types";
import { launchShortcut } from "../hooks/useSettings";
import { shortcutIcon } from "./icons";

interface ShortcutTileProps {
  shortcut: Shortcut;
  onOpened: () => void;
}

export function ShortcutTile({ shortcut, onOpened }: ShortcutTileProps) {
  const Icon = shortcutIcon(shortcut.icon);

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    void launchShortcut(shortcut.id).then(onOpened).catch(onOpened);
  };

  return (
    <button
      type="button"
      className={`shortcut-tile ${shortcut.missing ? "is-missing" : ""}`}
      onClick={handleClick}
      aria-label={shortcut.label}
      disabled={shortcut.missing}
      title={shortcut.missing ? `${shortcut.label} is not available` : shortcut.label}
    >
      <span className="tile-glyph">
        <Icon size={20} />
      </span>
      <span className="tile-label">{shortcut.label}</span>
    </button>
  );
}

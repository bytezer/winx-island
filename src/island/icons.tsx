import type { ReactNode } from "react";

interface IconProps {
  size?: number;
}

/**
 * Built-in stroke icons for shortcut tiles. `stroke="currentColor"` keeps them
 * tintable from CSS and consistent with the transport controls.
 */
export function FolderIcon({ size = 22 }: IconProps): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DownloadIcon({ size = 22 }: IconProps): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 3.5v11M12 14.5l-4.2-4.2M12 14.5l4.2-4.2M4.5 17v2a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DocumentsIcon({ size = 22 }: IconProps): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M6.5 3.5h7l4 4v11a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5 19.5v-14A1.5 1.5 0 0 1 6.5 3.5zM13.5 3.5V7h4M8.5 12h7M8.5 15.5h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PicturesIcon({ size = 22 }: IconProps): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="9" cy="10.5" r="1.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M4 16.5l4.5-3.5 3.5 3 3-2.5 5 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DesktopIcon({ size = 22 }: IconProps): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect
        x="3.5"
        y="4.5"
        width="17"
        height="11"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M9 19.5h6M12 15.5v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TrashIcon({ size = 22 }: IconProps): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M6 7h12M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M7.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h4.4a1.5 1.5 0 0 0 1.5-1.4L16.5 7M10.5 10.5v6M13.5 10.5v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SettingsIcon({ size = 22 }: IconProps): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M4 7.5h7M16.5 7.5H20M4 14.5h3.5M12 14.5h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="13.5" cy="7.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9.5" cy="14.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function SuspendIcon({ size = 22 }: IconProps): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M8.6 6.8a6 6 0 1 0 6.8 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M12 3.5v6.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const ICONS: Record<string, (props: IconProps) => ReactNode> = {
  folder: FolderIcon,
  download: DownloadIcon,
  documents: DocumentsIcon,
  pictures: PicturesIcon,
  desktop: DesktopIcon,
  trash: TrashIcon,
  settings: SettingsIcon,
  suspend: SuspendIcon,
};

export function shortcutIcon(name: string): (props: IconProps) => ReactNode {
  return ICONS[name] ?? FolderIcon;
}

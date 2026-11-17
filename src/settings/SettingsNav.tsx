import type { ReactNode } from "react";
import { useT } from "../i18n/LocaleContext";

export type SettingsSection = "general" | "appearance" | "about";

interface NavItem {
  id: SettingsSection;
  labelKey: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "general",
    labelKey: "settings.nav_general",
    icon: (
      <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
        <path
          d="M4 7.5h5.5M15 7.5h5M4 16.5h9M18.5 16.5H20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="12" cy="7.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="15.5" cy="16.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    id: "appearance",
    labelKey: "settings.nav_appearance",
    icon: (
      <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
        <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M12 3.8a8.2 8.2 0 0 1 0 16.4z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "about",
    labelKey: "settings.nav_about",
    icon: (
      <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
        <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M12 10.8v5.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="8" r="1.05" fill="currentColor" />
      </svg>
    ),
  },
];

interface SettingsNavProps {
  active: SettingsSection;
  onSelect: (section: SettingsSection) => void;
}

export function SettingsNav({ active, onSelect }: SettingsNavProps) {
  const t = useT();

  return (
    <nav className="settings-nav" aria-label={t("settings.nav_group")}>
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className="settings-nav-item"
          aria-current={active === item.id ? "page" : undefined}
          onClick={() => onSelect(item.id)}
        >
          {item.icon}
          {t(item.labelKey)}
        </button>
      ))}
    </nav>
  );
}

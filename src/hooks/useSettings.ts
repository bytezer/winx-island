import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import type { PanelTab, SettingsState, Theme } from "../types";

const DEFAULTS: SettingsState = {
  visualizerEnabled: true,
  appearance: {
    compactWidth: 132,
    compactHeight: 40,
    offsetX: 0,
    offsetY: 0,
    theme: "midnight",
  },
  lastPanelTab: "media",
  shortcuts: [],
};

export function useSettings(): SettingsState {
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS);

  useEffect(() => {
    let disposed = false;
    void invoke<SettingsState>("get_settings")
      .then((value) => {
        if (!disposed) setSettings(value);
      })
      .catch(() => {
        /* the window may be closing */
      });

    const unsubscribe = listen<SettingsState>("island://settings", (event) => {
      if (!disposed) setSettings(event.payload);
    });

    return () => {
      disposed = true;
      void unsubscribe.then((off) => off());
    };
  }, []);

  return settings;
}

export async function changeVisualizer(enabled: boolean) {
  await invoke("set_visualizer_enabled", { enabled });
}

export async function changePanelTab(tab: PanelTab) {
  await invoke("set_panel_tab", { tab });
}

export async function changeTheme(theme: Theme) {
  await invoke("set_theme", { theme });
}

export async function changeCompactSize(width: number, height: number) {
  await invoke("set_compact_size", { width, height });
}

export async function resetPosition() {
  await invoke("reset_position");
}

export async function openSettings() {
  await invoke("open_settings");
}

export async function closeSettings() {
  await invoke("close_settings");
}

export async function fetchAppVersion(): Promise<string> {
  return invoke<string>("app_version");
}

export async function launchShortcut(id: string) {
  await invoke("open_shortcut", { id });
}

export async function revealSettings() {
  await invoke("open_settings_location");
}

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import type { PanelTab, SettingsState } from "../types";

const DEFAULTS: SettingsState = {
  visualizerEnabled: true,
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

export async function launchShortcut(id: string) {
  await invoke("open_shortcut", { id });
}

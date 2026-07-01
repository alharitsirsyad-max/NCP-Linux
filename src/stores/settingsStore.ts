import { create } from "zustand";

export type TerminalEmulator = "auto" | "kitty" | "alacritty" | "gnome-terminal" | "xterm";

export interface AppSettings {
  winboxPath: string;
  packetTracerPath: string;
  terminalEmulator: TerminalEmulator;
  adapterRefreshInterval: number; // seconds
}

export const DEFAULT_SETTINGS: AppSettings = {
  winboxPath: "",
  packetTracerPath: "",
  terminalEmulator: "auto",
  adapterRefreshInterval: 5,
};

const STORAGE_KEY = "ncp_settings";

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

interface SettingsStore {
  settings: AppSettings;
  setSettings: (patch: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: loadSettings(),
  setSettings: (patch) =>
    set((state) => {
      const updated = { ...state.settings, ...patch };
      saveSettings(updated);
      return { settings: updated };
    }),
  resetSettings: () => {
    saveSettings(DEFAULT_SETTINGS);
    set({ settings: { ...DEFAULT_SETTINGS } });
  },
}));

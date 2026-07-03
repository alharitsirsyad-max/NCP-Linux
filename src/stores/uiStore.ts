import { create } from "zustand";

export type SelectedPage =
  | "adapters"
  | "diagnostics"
  | "routing"
  | "arp"
  | "ports"
  | "dashboard"
  | "settings"
  | "ssh"
  | "speedtest"
  | "lan_scanner"
  | "dns_benchmark"
  | "wol"
  | "wifi_analyzer";

export type DiagnosticsTab = "ping" | "traceroute" | "mtr" | "dns" | "whois" | "calculator";

interface UIStore {
  selectedAdapter: string | null;
  selectedPage: SelectedPage;
  diagnosticsTab: DiagnosticsTab;
  pingTarget: string | null;
  setSelectedAdapter: (name: string) => void;
  setSelectedPage: (page: SelectedPage) => void;
  openDiagnostics: (tab?: DiagnosticsTab, pingTarget?: string | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  selectedAdapter: null,
  selectedPage: "adapters",
  diagnosticsTab: "ping",
  pingTarget: null,
  setSelectedAdapter: (name) =>
    set({ selectedAdapter: name, selectedPage: "adapters" }),
  setSelectedPage: (page) => set({ selectedPage: page }),
  openDiagnostics: (tab = "ping", pingTarget = undefined) =>
    set({ selectedPage: "diagnostics", diagnosticsTab: tab, pingTarget: pingTarget ?? null }),
}));

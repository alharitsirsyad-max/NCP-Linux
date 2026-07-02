import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface LocalNetwork {
  interface: string;
  network: string;
  local_ip: string;
  gateway: string | null;
}

export interface LanDevice {
  ip: string;
  mac: string | null;
  vendor: string | null;
  hostname: string | null;
  latency_ms: number | null;
  status: string;
}

export interface LanScanProgress {
  devices_found: number;
  percent: number;
  message: string;
}

interface LanScannerState {
  status: "idle" | "running" | "done" | "error";
  devices: LanDevice[];
  progress: LanScanProgress | null;
  networks: LocalNetwork[];
  selectedNetwork: string | null;
  hasNmap: boolean | null;
  hasSudo: boolean;
  error: string | null;
}

export function useLanScanner() {
  const [state, setState] = useState<LanScannerState>({
    status: "idle",
    devices: [],
    progress: null,
    networks: [],
    selectedNetwork: null,
    hasNmap: null,
    hasSudo: false,
    error: null,
  });

  const unlistenRefs = useRef<UnlistenFn[]>([]);

  // Load available networks and check nmap on mount
  useEffect(() => {
    async function init() {
      const [nmap, nets] = await Promise.all([
        invoke<boolean>("check_nmap_available"),
        invoke<LocalNetwork[]>("get_local_networks").catch(() => [] as LocalNetwork[]),
      ]);

      setState((prev) => ({
        ...prev,
        hasNmap: nmap,
        networks: nets,
        selectedNetwork: nets.length > 0 ? nets[0].network : null,
      }));
    }
    init();
  }, []);

  async function start(network: string) {
    setState((prev) => ({
      ...prev,
      status: "running",
      devices: [],
      progress: { devices_found: 0, percent: 0, message: "Starting scan..." },
      error: null,
    }));

    // Subscribe to per-device events for realtime row updates
    const unlistenDevice = await listen<LanDevice>("lan_device_found", (event) => {
      setState((prev) => ({
        ...prev,
        devices: [...prev.devices, event.payload],
      }));
    });

    const unlistenProgress = await listen<LanScanProgress>("lan_scan_progress", (event) => {
      setState((prev) => ({ ...prev, progress: event.payload }));
    });

    const unlistenDone = await listen<number>("lan_scan_done", () => {
      setState((prev) => ({ ...prev, status: "done" }));
    });

    unlistenRefs.current = [unlistenDevice, unlistenProgress, unlistenDone];

    try {
      // invoke returns the full list (useful if events were missed)
      const devices = await invoke<LanDevice[]>("run_lan_scan", { network });
      setState((prev) => ({
        ...prev,
        status: "done",
        // Merge: deduplicate by IP in case events already populated some
        devices: mergeDedupe(prev.devices, devices),
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: String(err),
      }));
    } finally {
      cleanup();
    }
  }

  async function stop() {
    await invoke("cancel_lan_scan");
    cleanup();
    setState((prev) => ({
      ...prev,
      status: "idle",
      progress: null,
    }));
  }

  function reset() {
    setState((prev) => ({
      ...prev,
      status: "idle",
      devices: [],
      progress: null,
      error: null,
    }));
  }

  function setSelectedNetwork(network: string) {
    setState((prev) => ({ ...prev, selectedNetwork: network }));
  }

  function cleanup() {
    unlistenRefs.current.forEach((fn) => fn());
    unlistenRefs.current = [];
  }

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    start,
    stop,
    reset,
    setSelectedNetwork,
  };
}

// Merge two device lists, preferring items from `incoming` on IP collision
function mergeDedupe(existing: LanDevice[], incoming: LanDevice[]): LanDevice[] {
  const map = new Map<string, LanDevice>();
  for (const d of existing) map.set(d.ip, d);
  for (const d of incoming) map.set(d.ip, d);
  return Array.from(map.values()).sort((a, b) => ipToNum(a.ip) - ipToNum(b.ip));
}

function ipToNum(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

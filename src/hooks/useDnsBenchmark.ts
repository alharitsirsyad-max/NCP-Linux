import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface DnsServer {
  name: string;
  ip: string;
  category: string;
}

export interface DnsBenchmarkResult {
  server: DnsServer;
  latency_ms: number[];
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  success_rate: number;
  status: string;
}

export interface DnsBenchmarkProgress {
  server_name: string;
  server_index: number;
  total_servers: number;
  query_index: number;
  total_queries: number;
  current_latency_ms: number | null;
}

interface DnsBenchmarkState {
  status: "idle" | "running" | "done" | "error";
  results: DnsBenchmarkResult[];
  currentProgress: DnsBenchmarkProgress | null;
  servers: DnsServer[];
  error: string | null;
}

export function useDnsBenchmark() {
  const [state, setState] = useState<DnsBenchmarkState>({
    status: "idle",
    results: [],
    currentProgress: null,
    servers: [],
    error: null,
  });

  const unlistenRefs = useRef<UnlistenFn[]>([]);

  // Load default servers on mount (including ISP DNS)
  useEffect(() => {
    async function init() {
      try {
        const servers = await invoke<DnsServer[]>("get_default_dns_servers");
        setState((prev) => ({ ...prev, servers }));
      } catch (err) {
        // Fallback to a minimal hardcoded list if the command fails
        setState((prev) => ({
          ...prev,
          servers: [
            { name: "Cloudflare", ip: "1.1.1.1", category: "Public" },
            { name: "Google",     ip: "8.8.8.8", category: "Public" },
            { name: "Quad9",      ip: "9.9.9.9", category: "Public" },
          ],
        }));
      }
    }
    init();
  }, []);

  async function start(servers: DnsServer[], domain: string, queryCount: number) {
    setState((prev) => ({
      ...prev,
      status: "running",
      results: [],
      currentProgress: null,
      error: null,
    }));

    // Listen to per-query progress events
    const unlistenProgress = await listen<DnsBenchmarkProgress>(
      "dns_benchmark_progress",
      (event) => {
        setState((prev) => ({ ...prev, currentProgress: event.payload }));
      }
    );

    // Listen to per-server done events — accumulate rows in realtime
    const unlistenServerDone = await listen<DnsBenchmarkResult>(
      "dns_benchmark_server_done",
      (event) => {
        setState((prev) => ({
          ...prev,
          results: [...prev.results, event.payload],
        }));
      }
    );

    unlistenRefs.current = [unlistenProgress, unlistenServerDone];

    try {
      // invoke returns the full sorted result list
      const finalResults = await invoke<DnsBenchmarkResult[]>("run_dns_benchmark", {
        servers,
        testDomain: domain,
        queryCount,
      });
      // Replace with the final sorted list from the backend
      setState((prev) => ({
        ...prev,
        status: "done",
        results: finalResults,
        currentProgress: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: String(err),
        currentProgress: null,
      }));
    } finally {
      cleanup();
    }
  }

  function addCustomServer(server: DnsServer) {
    setState((prev) => ({
      ...prev,
      servers: [...prev.servers, server],
    }));
  }

  function removeCustomServer(ip: string) {
    setState((prev) => ({
      ...prev,
      servers: prev.servers.filter((s) => s.ip !== ip),
    }));
  }

  function reset() {
    cleanup();
    setState((prev) => ({
      ...prev,
      status: "idle",
      results: [],
      currentProgress: null,
      error: null,
    }));
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
    addCustomServer,
    removeCustomServer,
    reset,
  };
}

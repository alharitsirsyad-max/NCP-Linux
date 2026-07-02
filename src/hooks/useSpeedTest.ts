import { useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface SpeedTestResult {
  ping: number;
  download: number;  // Mbps
  upload: number;    // Mbps
  server_name: string;
  server_country: string;
  isp: string;
  timestamp: string;
}

export interface SpeedTestProgressEvent {
  stage: string;
  percent: number;
  current_value: number | null;
  message: string;
}

export type SpeedTestStatus = "idle" | "running" | "done" | "error";
export type SpeedTestStage = "ping" | "download" | "upload" | null;

interface SpeedTestState {
  status: SpeedTestStatus;
  stage: SpeedTestStage;
  percent: number;
  message: string;
  currentValue: number | null;
  result: SpeedTestResult | null;
  error: string | null;
}

export function useSpeedTest() {
  const [state, setState] = useState<SpeedTestState>({
    status: "idle",
    stage: null,
    percent: 0,
    message: "",
    currentValue: null,
    result: null,
    error: null,
  });

  const unlistenRef = useRef<UnlistenFn | null>(null);

  const cleanup = () => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
  };

  const start = async () => {
    cleanup();
    setState({
      status: "running",
      stage: "ping",
      percent: 0,
      message: "Starting speed test...",
      currentValue: null,
      result: null,
      error: null,
    });

    // Listen to progress events
    const unlisten = await listen<SpeedTestProgressEvent>("speedtest_progress", (event) => {
      const p = event.payload;
      const stage = (["ping", "download", "upload"].includes(p.stage)
        ? p.stage
        : null) as SpeedTestStage;

      setState((prev) => ({
        ...prev,
        stage,
        percent: p.percent,
        message: p.message,
        currentValue: p.current_value,
      }));
    });
    unlistenRef.current = unlisten;

    try {
      const result = await invoke<SpeedTestResult>("run_speedtest");
      cleanup();
      setState((prev) => ({
        ...prev,
        status: "done",
        stage: null,
        percent: 100,
        message: "Test complete!",
        result,
      }));
    } catch (e) {
      cleanup();
      setState((prev) => ({
        ...prev,
        status: "error",
        stage: null,
        error: String(e),
      }));
    }
  };

  const reset = () => {
    cleanup();
    setState({
      status: "idle",
      stage: null,
      percent: 0,
      message: "",
      currentValue: null,
      result: null,
      error: null,
    });
  };

  return { ...state, start, reset };
}

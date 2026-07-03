import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Activity } from "lucide-react";
import TrafficGraph, { type TrafficPoint } from "../components/traffic/TrafficGraph";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrafficUpdate {
  iface: string;
  point: TrafficPoint;
  total_rx_bytes: number;
  total_tx_bytes: number;
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatTotalBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatBps(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} MB/s`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrafficMonitorPage() {
  const [interfaces, setInterfaces] = useState<string[]>([]);
  const [selectedIface, setSelectedIface] = useState<string>("");
  const [points, setPoints] = useState<TrafficPoint[]>([]);
  const [duration, setDuration] = useState<60 | 300 | 3600>(60);
  const [totalRx, setTotalRx] = useState(0);
  const [totalTx, setTotalTx] = useState(0);
  const [sessionRx, setSessionRx] = useState(0);
  const [sessionTx, setSessionTx] = useState(0);
  const [baselineRx, setBaselineRx] = useState<number | null>(null);
  const [baselineTx, setBaselineTx] = useState<number | null>(null);

  const unlistenRef = useRef<UnlistenFn | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphWidth, setGraphWidth] = useState(600);

  // Track container width for responsive graph
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setGraphWidth(Math.max(300, entry.contentRect.width - 32));
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Load interface list on mount
  useEffect(() => {
    invoke<string[]>("list_traffic_interfaces")
      .then((ifaces) => {
        setInterfaces(ifaces);
        if (ifaces.length > 0) setSelectedIface(ifaces[0]);
      })
      .catch(() => {});
  }, []);

  const startMonitor = useCallback(async (iface: string) => {
    // Cleanup previous listener
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }

    // Reset state
    setPoints([]);
    setTotalRx(0);
    setTotalTx(0);
    setSessionRx(0);
    setSessionTx(0);
    setBaselineRx(null);
    setBaselineTx(null);

    // Load existing history first
    try {
      const history = await invoke<TrafficPoint[]>("get_traffic_history", {
        iface,
        durationSeconds: 3600,
      });
      setPoints(history);
    } catch {
      // ignore — just start fresh
    }

    // Subscribe to live events
    const unlisten = await listen<TrafficUpdate>("traffic_update", (event) => {
      const update = event.payload;
      if (update.iface !== iface) return;

      setPoints((prev) => {
        const next = [...prev, update.point];
        // Keep at most 3600 points in frontend memory
        return next.length > 3600 ? next.slice(next.length - 3600) : next;
      });

      setTotalRx(update.total_rx_bytes);
      setTotalTx(update.total_tx_bytes);

      // Session bytes = current total minus baseline (set on first update).
      // Use a single combined updater to avoid reading stale state across
      // two separate setBaselineRx calls (React batches state updates but
      // functional updaters for *different* state atoms still close over
      // the same render's snapshot, so chaining two setBaselineRx calls
      // caused the second one to see the pre-update value of baselineTx).
      setBaselineRx((prevRx) => {
        const newBaselineRx = prevRx === null ? update.total_rx_bytes : prevRx;
        if (prevRx !== null) {
          setSessionRx(Math.max(0, update.total_rx_bytes - newBaselineRx));
        }
        return newBaselineRx;
      });
      setBaselineTx((prevTx) => {
        const newBaselineTx = prevTx === null ? update.total_tx_bytes : prevTx;
        if (prevTx !== null) {
          setSessionTx(Math.max(0, update.total_tx_bytes - newBaselineTx));
        }
        return newBaselineTx;
      });
    });

    unlistenRef.current = unlisten;

    // Start backend monitor
    await invoke("start_traffic_monitor", { iface }).catch(() => {});
  }, []);

  // Start monitoring when selected interface changes
  useEffect(() => {
    if (!selectedIface) return;
    startMonitor(selectedIface);
  }, [selectedIface, startMonitor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unlistenRef.current) unlistenRef.current();
      if (selectedIface) {
        invoke("stop_traffic_monitor", { iface: selectedIface }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentPoint = points.length > 0 ? points[points.length - 1] : null;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
      }}
    >
      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
          flexShrink: 0,
        }}
      >
        <Activity size={14} color="var(--accent)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
          Traffic Monitor
        </span>

        <select
          value={selectedIface}
          onChange={(e) => setSelectedIface(e.target.value)}
          style={{
            padding: "4px 8px",
            fontSize: 12,
            border: "1px solid var(--border)",
            borderRadius: 4,
            background: "var(--surface-0)",
            color: "var(--text-primary)",
            marginLeft: 8,
          }}
        >
          {interfaces.length === 0 && (
            <option value="">No interfaces</option>
          )}
          {interfaces.map((iface) => (
            <option key={iface} value={iface}>
              {iface}
            </option>
          ))}
        </select>

        {selectedIface && (
          <span
            style={{
              fontSize: 10,
              color: "var(--color-success)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--color-success)",
                display: "inline-block",
                animation: "pulse 2s infinite",
              }}
            />
            Live
          </span>
        )}
      </div>

      {/* ── Graph ────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minHeight: 0,
        }}
      >
        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "12px 8px",
            overflow: "hidden",
          }}
        >
          <TrafficGraph
            points={points}
            duration={duration}
            onDurationChange={setDuration}
            width={graphWidth}
            height={220}
          />
        </div>

        {/* ── Stats row ──────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
          }}
        >
          <StatCard
            label="Current ↓"
            value={currentPoint ? formatBps(currentPoint.rx_bytes_per_sec) : "—"}
            color="#0078d4"
          />
          <StatCard
            label="Current ↑"
            value={currentPoint ? formatBps(currentPoint.tx_bytes_per_sec) : "—"}
            color="#107c10"
          />
          <StatCard
            label="Session RX"
            value={formatTotalBytes(sessionRx)}
            color="var(--text-secondary)"
          />
          <StatCard
            label="Session TX"
            value={formatTotalBytes(sessionTx)}
            color="var(--text-secondary)"
          />
        </div>

        {/* Interface total (since system boot) */}
        <div
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            display: "flex",
            gap: 24,
          }}
        >
          <span>
            Interface total RX: <span style={{ fontFamily: "monospace" }}>{formatTotalBytes(totalRx)}</span>
          </span>
          <span>
            Interface total TX: <span style={{ fontFamily: "monospace" }}>{formatTotalBytes(totalTx)}</span>
          </span>
          <span style={{ marginLeft: "auto", fontStyle: "italic" }}>
            Since system boot · resets on restart
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color }}>
        {value}
      </div>
    </div>
  );
}

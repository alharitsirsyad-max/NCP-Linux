import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Play, StopCircle, AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessBandwidth {
  pid: number;
  process_name: string;
  program_path: string;
  sent_kb_per_sec: number;
  received_kb_per_sec: number;
  total_sent_kb: number;
  total_received_kb: number;
}

interface BandwidthSnapshot {
  processes: ProcessBandwidth[];
  total_sent_kb_per_sec: number;
  total_recv_kb_per_sec: number;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtKbps(kbps: number): string {
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(2)} MB/s`;
  if (kbps >= 1)    return `${kbps.toFixed(1)} KB/s`;
  return `${(kbps * 1024).toFixed(0)} B/s`;
}

function fmtKb(kb: number): string {
  if (kb >= 1_048_576) return `${(kb / 1_048_576).toFixed(1)} GB`;
  if (kb >= 1_024)     return `${(kb / 1_024).toFixed(1)} MB`;
  return `${kb.toFixed(0)} KB`;
}

// ─── Bar ─────────────────────────────────────────────────────────────────────

function BwBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden", minWidth: 60 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BandwidthMonitorPage() {
  const [interfaces, setInterfaces] = useState<string[]>([]);
  const [selectedIface, setSelectedIface] = useState("");
  const [hasNethogs, setHasNethogs] = useState<boolean | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [processes, setProcesses] = useState<ProcessBandwidth[]>([]);
  const [totals, setTotals] = useState({ sent: 0, recv: 0 });
  const [error, setError] = useState<string | null>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  // Check nethogs + load interfaces on mount
  useEffect(() => {
    async function init() {
      const [nethogs, ifaces] = await Promise.all([
        invoke<boolean>("check_nethogs_available"),
        invoke<string[]>("list_traffic_interfaces"),
      ]);
      setHasNethogs(nethogs);
      setInterfaces(ifaces);
      if (ifaces.length > 0) setSelectedIface(ifaces[0]);
    }
    init();
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    unlistenRefs.current.forEach((fn) => fn());
    unlistenRefs.current = [];
  }

  const handleStart = useCallback(async () => {
    if (!selectedIface) return;
    setError(null);
    setProcesses([]);
    setTotals({ sent: 0, recv: 0 });

    const unSnap = await listen<BandwidthSnapshot>("bandwidth_update", (e) => {
      const snap = e.payload;
      // Sort by total bw desc
      const sorted = [...snap.processes].sort(
        (a, b) =>
          (b.sent_kb_per_sec + b.received_kb_per_sec) -
          (a.sent_kb_per_sec + a.received_kb_per_sec)
      );
      setProcesses(sorted);
      setTotals({ sent: snap.total_sent_kb_per_sec, recv: snap.total_recv_kb_per_sec });
    });

    const unErr = await listen<string>("bandwidth_error", (e) => {
      setError(e.payload);
      setStatus("error");
    });

    unlistenRefs.current = [unSnap, unErr];

    try {
      await invoke("start_bandwidth_monitor", { iface: selectedIface });
      setStatus("running");
    } catch (err) {
      setError(String(err));
      setStatus("error");
      cleanup();
    }
  }, [selectedIface]);

  const handleStop = useCallback(async () => {
    cleanup();
    try {
      await invoke("stop_bandwidth_monitor");
    } catch {/* ignore */}
    setStatus("idle");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      invoke("stop_bandwidth_monitor").catch(() => {});
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── No nethogs ────────────────────────────────────────────────────────────
  if (hasNethogs === false) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
        <AlertTriangle size={36} color="var(--color-warning)" />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>nethogs tidak ditemukan</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 340, textAlign: "center" }}>
          Bandwidth Monitor per Process membutuhkan nethogs. Install dengan:
        </div>
        <code style={{ background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 14px", fontSize: 12 }}>
          sudo pacman -S nethogs
        </code>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          atau: sudo apt install nethogs / sudo dnf install nethogs
        </div>
      </div>
    );
  }

  if (hasNethogs === null) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>Checking dependencies...</div>;
  }

  const isRunning = status === "running";
  const maxSent = processes.length > 0 ? Math.max(...processes.map(p => p.sent_kb_per_sec), 0.001) : 0.001;
  const maxRecv = processes.length > 0 ? Math.max(...processes.map(p => p.received_kb_per_sec), 0.001) : 0.001;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}>
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
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
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
          Bandwidth Monitor
        </span>

        <select
          value={selectedIface}
          onChange={(e) => setSelectedIface(e.target.value)}
          disabled={isRunning}
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
          {interfaces.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>

        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={!selectedIface}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", fontSize: 11, fontWeight: 600,
              background: "var(--accent)", color: "#fff", border: "none",
              borderRadius: 4, cursor: "pointer",
            }}
          >
            <Play size={12} /> Start
          </button>
        ) : (
          <button
            onClick={handleStop}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", fontSize: 11, fontWeight: 600,
              background: "#dc3545", color: "#fff", border: "none",
              borderRadius: 4, cursor: "pointer",
            }}
          >
            <StopCircle size={12} /> Stop
          </button>
        )}

        {isRunning && (
          <span style={{ fontSize: 10, color: "var(--color-success)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-success)", display: "inline-block" }} />
            Live
          </span>
        )}

        {/* Totals */}
        {isRunning && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 11 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <ArrowDown size={11} color="#0078d4" />
              <span style={{ fontFamily: "monospace", color: "#0078d4", fontWeight: 600 }}>
                {fmtKbps(totals.recv)}
              </span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <ArrowUp size={11} color="#107c10" />
              <span style={{ fontFamily: "monospace", color: "#107c10", fontWeight: 600 }}>
                {fmtKbps(totals.sent)}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* ── Error ───────────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: "7px 16px", background: "rgba(220,53,69,0.08)", borderBottom: "1px solid rgba(220,53,69,0.2)", fontSize: 11, color: "#dc3545", flexShrink: 0 }}>
          {error}
          {error.includes("sudo") && (
            <span style={{ marginLeft: 8, opacity: 0.8 }}>
              (nethogs requires passwordless sudo — add to /etc/sudoers.d/)
            </span>
          )}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", position: "sticky", top: 0, zIndex: 1 }}>
              {[
                { label: "Process", w: "auto" },
                { label: "PID", w: 60 },
                { label: "Download ↓", w: 110 },
                { label: "Upload ↑", w: 110 },
                { label: "", w: 200 },  // bars
              ].map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: "7px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 11,
                    width: h.w !== "auto" ? h.w : undefined,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processes.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-muted)", fontSize: 12 }}>
                  {isRunning
                    ? "Waiting for data... (processes with no traffic are hidden)"
                    : "Click Start to begin monitoring"}
                </td>
              </tr>
            )}
            {processes.map((proc, i) => (
              <ProcessRow
                key={`${proc.pid}-${proc.process_name}`}
                proc={proc}
                index={i}
                maxSent={maxSent}
                maxRecv={maxRecv}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "4px 16px",
          fontSize: 10,
          color: "var(--text-muted)",
          background: "var(--surface-2)",
          display: "flex",
          gap: 16,
          flexShrink: 0,
          alignItems: "center",
        }}
      >
        <span>{processes.length} active process{processes.length !== 1 ? "es" : ""}</span>
        <span style={{ marginLeft: "auto", fontStyle: "italic" }}>
          Requires: sudo nethogs · Sorted by total bandwidth
        </span>
      </div>
    </div>
  );
}

// ─── Process Row ──────────────────────────────────────────────────────────────

function ProcessRow({
  proc,
  index,
  maxSent,
  maxRecv,
}: {
  proc: ProcessBandwidth;
  index: number;
  maxSent: number;
  maxRecv: number;
}) {
  const rowBg = index % 2 === 0 ? "transparent" : "var(--surface-1)";

  return (
    <tr
      style={{ background: rowBg }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "var(--surface-3)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = rowBg)}
    >
      {/* Process name */}
      <td style={cellStyle}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
            {proc.process_name}
          </span>
          {proc.program_path && proc.program_path !== proc.process_name && (
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>
              {proc.program_path}
            </span>
          )}
        </div>
      </td>

      {/* PID */}
      <td style={{ ...cellStyle, fontFamily: "monospace", color: "var(--text-muted)", fontSize: 11 }}>
        {proc.pid > 0 ? proc.pid : "—"}
      </td>

      {/* Download */}
      <td style={cellStyle}>
        <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#0078d4" }}>
          {fmtKbps(proc.received_kb_per_sec)}
        </span>
      </td>

      {/* Upload */}
      <td style={cellStyle}>
        <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#107c10" }}>
          {fmtKbps(proc.sent_kb_per_sec)}
        </span>
      </td>

      {/* Bars */}
      <td style={{ ...cellStyle, minWidth: 160 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <BwBar value={proc.received_kb_per_sec} max={maxRecv} color="#0078d4" />
          <BwBar value={proc.sent_kb_per_sec} max={maxSent} color="#107c10" />
        </div>
      </td>
    </tr>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "7px 12px",
  borderBottom: "1px solid var(--border)",
  color: "var(--text-primary)",
  verticalAlign: "middle",
};

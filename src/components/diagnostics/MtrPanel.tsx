import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Play, Square, RefreshCw } from "lucide-react";
import ExportButton from "../shared/ExportButton";

interface MtrHop {
  hop: number;
  host: string | null;
  loss_pct: number;
  sent: number;
  last_ms: number;
  avg_ms: number;
  best_ms: number;
  worst_ms: number;
}

interface MtrUpdate {
  cycle: number;
  hops: MtrHop[];
}

const CYCLE_OPTIONS = [
  { label: "Continuous", value: 0 },
  { label: "10 cycles",  value: 10 },
  { label: "20 cycles",  value: 20 },
  { label: "50 cycles",  value: 50 },
];

function lossColor(loss: number): string {
  if (loss === 0)   return "var(--color-success)";
  if (loss <= 10)   return "var(--color-warning)";
  return "var(--color-error)";
}

function latencyColor(ms: number): string {
  if (ms === 0)    return "var(--text-muted)";
  if (ms < 20)     return "var(--color-success)";
  if (ms < 100)    return "var(--text-primary)";
  if (ms < 300)    return "var(--color-warning)";
  return "var(--color-error)";
}

function fmt(ms: number): string {
  if (ms <= 0) return "—";
  return `${ms.toFixed(1)}`;
}

export default function MtrPanel() {
  const [target, setTarget] = useState("");
  const [cycles, setCycles] = useState(0);
  const [running, setRunning] = useState(false);
  const [hops, setHops] = useState<MtrHop[]>([]);
  const [currentCycle, setCurrentCycle] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const unlistenRefs = useRef<(() => void)[]>([]);

  const cleanup = () => {
    unlistenRefs.current.forEach((fn) => fn());
    unlistenRefs.current = [];
  };

  useEffect(() => () => cleanup(), []);

  const handleStart = async () => {
    if (!target.trim()) { setError("Please enter a target host or IP."); return; }
    setError(null);
    setHops([]);
    setCurrentCycle(0);
    setRunning(true);

    const unlistenUpdate = await listen<MtrUpdate>("mtr_update", (e) => {
      setHops(e.payload.hops);
      setCurrentCycle(e.payload.cycle);
    });

    const unlistenDone = await listen("mtr_done", () => {
      setRunning(false);
      cleanup();
    });

    unlistenRefs.current = [unlistenUpdate, unlistenDone];

    try {
      await invoke("run_mtr", { target: target.trim(), cycles });
    } catch (e) {
      setError(String(e));
      setRunning(false);
      cleanup();
    }
  };

  const handleStop = () => {
    setRunning(false);
    cleanup();
  };

  const colStyle = (width: string): React.CSSProperties => ({
    padding: "6px 10px",
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    textAlign: "right" as const,
    width,
    whiteSpace: "nowrap",
  });

  const thStyle = (width: string): React.CSSProperties => ({
    ...colStyle(width),
    fontSize: "10px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: "var(--text-muted)",
    background: "var(--surface-2)",
    borderBottom: "1px solid var(--border)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px" }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <input
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !running && handleStart()}
          placeholder="Target host or IP (e.g. 8.8.8.8)"
          disabled={running}
          style={{
            flex: 1,
            padding: "5px 10px",
            background: "var(--surface-0)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
            outline: "none",
          }}
        />

        <label style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Cycles:</label>
        <select
          value={cycles}
          onChange={(e) => setCycles(Number(e.target.value))}
          disabled={running}
          style={{ padding: "5px 6px", borderRadius: "var(--radius-sm)", fontSize: "12px", minWidth: "110px" }}
        >
          {CYCLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <button
          onClick={running ? handleStop : handleStart}
          style={{
            display: "flex", alignItems: "center", gap: "5px",
            padding: "5px 14px", borderRadius: "var(--radius-sm)",
            fontSize: "12px", fontWeight: 500,
            background: running ? "var(--color-error)" : "var(--accent)",
            color: "white", border: "none", cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          {running ? <><Square size={12} /> Stop</> : <><Play size={12} /> Start MTR</>}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ fontSize: "11px", color: "var(--color-error)", padding: "6px 10px", background: "rgba(196,43,28,0.08)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(196,43,28,0.25)" }}>
          {error}
        </div>
      )}

      {/* Status */}
      {(running || hops.length > 0) && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>
          {running && <RefreshCw size={11} style={{ animation: "spin 1.5s linear infinite", color: "var(--accent)" }} />}
          <span>
            {running ? `Running — cycle ${currentCycle}` : `Completed — ${currentCycle} cycle${currentCycle !== 1 ? "s" : ""}`}
          </span>
          {hops.length > 0 && <span>· {hops.length} hops</span>}
          {!running && hops.length > 0 && (
            <div style={{ marginLeft: "auto" }}>
              <ExportButton
                filenamePrefix={`mtr-${target}`}
                getContent={() => {
                  const header = `MTR Report — ${target} — ${new Date().toLocaleString()}\nCycles: ${currentCycle}\n${"=".repeat(70)}\n\n`;
                  const col = (s: string, w: number) => s.padEnd(w);
                  const headRow = `${col("#", 4)}${col("Host", 22)}${col("Loss%", 8)}${col("Snt", 6)}${col("Last", 10)}${col("Avg", 10)}${col("Best", 10)}${"Worst"}\n`;
                  const rows = hops.map((h) =>
                    `${col(String(h.hop), 4)}${col(h.host ?? "*", 22)}${col(`${h.loss_pct.toFixed(1)}%`, 8)}${col(String(h.sent), 6)}${col(`${h.last_ms.toFixed(1)}ms`, 10)}${col(`${h.avg_ms.toFixed(1)}ms`, 10)}${col(`${h.best_ms.toFixed(1)}ms`, 10)}${h.worst_ms.toFixed(1)}ms`
                  ).join("\n");
                  return header + headRow + rows + "\n";
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
        {hops.length === 0 && !running ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
            Enter a target and click Start MTR.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle("36px"), textAlign: "left" }}>#</th>
                <th style={{ ...thStyle("auto"), textAlign: "left" }}>Host</th>
                <th style={thStyle("60px")}>Loss%</th>
                <th style={thStyle("50px")}>Snt</th>
                <th style={thStyle("70px")}>Last</th>
                <th style={thStyle("70px")}>Avg</th>
                <th style={thStyle("70px")}>Best</th>
                <th style={thStyle("70px")}>Worst</th>
              </tr>
            </thead>
            <tbody>
              {hops.map((hop, i) => (
                <tr
                  key={hop.hop}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: i % 2 === 0 ? "var(--surface-0)" : "var(--surface-2)",
                  }}
                >
                  <td style={{ ...colStyle("36px"), textAlign: "left", color: "var(--text-muted)" }}>{hop.hop}</td>
                  <td style={{ ...colStyle("auto"), textAlign: "left", color: "var(--text-primary)" }}>
                    {hop.host ?? <span style={{ color: "var(--text-muted)" }}>*</span>}
                  </td>
                  <td style={{ ...colStyle("60px"), color: lossColor(hop.loss_pct), fontWeight: hop.loss_pct > 0 ? 600 : 400 }}>
                    {hop.loss_pct.toFixed(1)}%
                  </td>
                  <td style={{ ...colStyle("50px"), color: "var(--text-secondary)" }}>{hop.sent}</td>
                  <td style={{ ...colStyle("70px"), color: latencyColor(hop.last_ms) }}>{fmt(hop.last_ms)}</td>
                  <td style={{ ...colStyle("70px"), color: latencyColor(hop.avg_ms)  }}>{fmt(hop.avg_ms)}</td>
                  <td style={{ ...colStyle("70px"), color: latencyColor(hop.best_ms) }}>{fmt(hop.best_ms)}</td>
                  <td style={{ ...colStyle("70px"), color: latencyColor(hop.worst_ms)}}>{fmt(hop.worst_ms)}</td>
                </tr>
              ))}
              {running && hops.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                    Waiting for first response...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      {hops.length > 0 && (
        <div style={{ display: "flex", gap: "16px", fontSize: "10px", color: "var(--text-muted)", flexShrink: 0 }}>
          <span>Latency (ms) —</span>
          <span style={{ color: "var(--color-success)" }}>● &lt;20ms excellent</span>
          <span style={{ color: "var(--text-primary)" }}>● 20–100ms good</span>
          <span style={{ color: "var(--color-warning)" }}>● 100–300ms fair</span>
          <span style={{ color: "var(--color-error)" }}>● &gt;300ms poor</span>
        </div>
      )}
    </div>
  );
}

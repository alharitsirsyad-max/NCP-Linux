import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Play, Square } from "lucide-react";
import ExportButton from "../shared/ExportButton";

interface PingLineEvent {
  seq: number;
  ttl: number;
  time_ms: number;
  status: "success" | "timeout";
  raw: string;
}

interface PingSummaryEvent {
  packets_sent: number;
  packets_received: number;
  packet_loss: number;
  rtt_min: number;
  rtt_avg: number;
  rtt_max: number;
}

const COUNT_OPTIONS = [4, 8, 16, 32];

export default function PingPanel({ initialTarget = "" }: { initialTarget?: string }) {
  const [target, setTarget] = useState(initialTarget);
  const [count, setCount] = useState(4);
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<PingLineEvent[]>([]);
  const [summary, setSummary] = useState<PingSummaryEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Update target if initialTarget changes (e.g. pre-filled from context menu)
  useEffect(() => {
    if (initialTarget) setTarget(initialTarget);
  }, [initialTarget]);

  // Auto-scroll output to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  const handleRun = async () => {
    if (!target.trim()) {
      setError("Please enter a target host or IP.");
      return;
    }
    setLines([]);
    setSummary(null);
    setError(null);
    setRunning(true);

    // Listen for streaming events
    const unlistenLine = await listen<PingLineEvent>("ping_line", (event) => {
      setLines((prev) => [...prev, event.payload]);
    });

    const unlistenDone = await listen<PingSummaryEvent>("ping_done", (event) => {
      setSummary(event.payload);
      setRunning(false);
      unlistenLine();
      unlistenDone();
    });

    try {
      await invoke("run_ping", { target: target.trim(), count });
    } catch (e) {
      setError(String(e));
      setRunning(false);
      unlistenLine();
      unlistenDone();
    }
  };

  const handleStop = async () => {
    // Tauri will emit ping_done with partial data when process is killed
    // For now, just mark as not running — the invoke will resolve
    setRunning(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px" }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <input
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !running && handleRun()}
          placeholder="Target host or IP (e.g. 8.8.8.8)"
          disabled={running}
          style={{
            flex: 1,
            padding: "5px 10px",
            background: "var(--surface-3)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
            outline: "none",
          }}
        />
        <label style={{ fontSize: "11px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          Count:
        </label>
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          disabled={running}
          style={{
            padding: "5px 6px",
            background: "var(--surface-0)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontSize: "12px",
            minWidth: "60px",
          }}
        >
          {COUNT_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button
          onClick={running ? handleStop : handleRun}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: "5px 14px",
            borderRadius: "var(--radius-sm)",
            fontSize: "12px",
            fontWeight: 500,
            background: running ? "var(--color-error)" : "var(--accent)",
            color: "white",
            border: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {running ? <><Square size={12} /> Stop</> : <><Play size={12} /> Run Ping</>}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ fontSize: "11px", color: "var(--color-error)", padding: "6px 10px", background: "rgba(196,43,28,0.1)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(196,43,28,0.3)" }}>
          {error}
        </div>
      )}

      {/* Output terminal */}
      <div
        ref={outputRef}
        style={{
          flex: 1,
          background: "var(--surface-0)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "10px 12px",
          overflowY: "auto",
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          lineHeight: 1.6,
          minHeight: "120px",
        }}
      >
        {lines.length === 0 && !running && (
          <span style={{ color: "var(--text-muted)" }}>
            Enter a target and press Run Ping.
          </span>
        )}
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              color: line.status === "success"
                ? "#1a7c1a"
                : line.status === "timeout"
                ? "#c42b1c"
                : "var(--text-secondary)",
            }}
          >
            {line.raw}
          </div>
        ))}
        {running && lines.length === 0 && (
          <span style={{ color: "var(--text-muted)" }}>Waiting for response...</span>
        )}
      </div>

      {/* Summary bar */}
      {summary && (
        <div
          style={{
            display: "flex",
            gap: "16px",
            padding: "8px 14px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: "11px",
            color: "var(--text-secondary)",
            flexShrink: 0,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <SummaryItem label="Sent" value={String(summary.packets_sent)} />
          <SummaryItem label="Received" value={String(summary.packets_received)} />
          <SummaryItem
            label="Loss"
            value={`${summary.packet_loss.toFixed(0)}%`}
            highlight={summary.packet_loss > 0}
          />
          <SummaryItem label="Min" value={`${summary.rtt_min.toFixed(1)} ms`} />
          <SummaryItem label="Avg" value={`${summary.rtt_avg.toFixed(1)} ms`} />
          <SummaryItem label="Max" value={`${summary.rtt_max.toFixed(1)} ms`} />
          <div style={{ marginLeft: "auto" }}>
            <ExportButton
              label="Export"
              filenamePrefix={`ping-${target}`}
              getContent={() => {
                const header = `Ping Report — ${target} — ${new Date().toLocaleString()}\n${"=".repeat(60)}\n\n`;
                const output = lines.map((l) => l.raw).join("\n");
                const sum = `\n\n${"=".repeat(60)}\nSent: ${summary.packets_sent}  Received: ${summary.packets_received}  Loss: ${summary.packet_loss.toFixed(0)}%\nMin: ${summary.rtt_min.toFixed(1)}ms  Avg: ${summary.rtt_avg.toFixed(1)}ms  Max: ${summary.rtt_max.toFixed(1)}ms\n`;
                return header + output + sum;
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", gap: "4px" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}:</span>
      <span style={{
        fontFamily: "var(--font-mono)",
        color: highlight ? "var(--color-warning)" : "var(--text-primary)",
        fontWeight: highlight ? 600 : 400,
      }}>
        {value}
      </span>
    </div>
  );
}

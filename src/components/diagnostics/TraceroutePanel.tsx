import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Play, Square } from "lucide-react";
import ExportButton from "../shared/ExportButton";

interface TracerouteHop {
  hop: number;
  ip: string | null;
  probes: (number | null)[];
}

export default function TraceroutePanel() {
  const [target, setTarget] = useState("");
  const [running, setRunning] = useState(false);
  const [hops, setHops] = useState<TracerouteHop[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tableRef.current) tableRef.current.scrollTop = tableRef.current.scrollHeight;
  }, [hops]);

  const handleRun = async () => {
    if (!target.trim()) { setError("Please enter a target."); return; }
    setHops([]);
    setDone(false);
    setError(null);
    setRunning(true);

    const unlistenHop = await listen<TracerouteHop>("traceroute_hop", (e) => {
      setHops((prev) => [...prev, e.payload]);
    });
    const unlistenDone = await listen("traceroute_done", () => {
      setDone(true);
      setRunning(false);
      unlistenHop();
      unlistenDone();
    });

    try {
      await invoke("run_traceroute", { target: target.trim() });
    } catch (e) {
      setError(String(e));
      setRunning(false);
      unlistenHop();
      unlistenDone();
    }
  };

  const formatProbe = (ms: number | null) =>
    ms === null ? <span style={{ color: "var(--text-muted)" }}>*</span> : <span>{ms.toFixed(2)} ms</span>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px" }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <input
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !running && handleRun()}
          placeholder="Target host or IP"
          disabled={running}
          style={{ flex: 1, padding: "5px 10px", background: "var(--surface-3)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "12px", fontFamily: "var(--font-mono)", outline: "none" }}
        />
        <button
          onClick={running ? () => setRunning(false) : handleRun}
          style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 14px", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: 500, background: running ? "var(--color-error)" : "var(--accent)", color: "white", border: "none", cursor: "pointer" }}
        >
          {running ? <><Square size={12} /> Stop</> : <><Play size={12} /> Trace</>}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: "11px", color: "var(--color-error)", padding: "6px 10px", background: "rgba(196,43,28,0.1)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(196,43,28,0.3)" }}>
          {error}
        </div>
      )}

      {/* Hops table */}
      <div ref={tableRef} style={{ flex: 1, overflow: "auto", background: "var(--surface-0)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
        {hops.length === 0 && !running && (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>Enter a target and press Trace.</div>
        )}
        {hops.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                {["#", "IP Address", "Probe 1", "Probe 2", "Probe 3"].map((h) => (
                  <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hops.map((hop, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface-3)" }}>
                  <td style={{ padding: "6px 12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{hop.hop}</td>
                  <td style={{ padding: "6px 12px", fontFamily: "var(--font-mono)", color: hop.ip ? "var(--text-primary)" : "var(--text-muted)" }}>{hop.ip ?? "*"}</td>
                  <td style={{ padding: "6px 12px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{formatProbe(hop.probes[0] ?? null)}</td>
                  <td style={{ padding: "6px 12px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{formatProbe(hop.probes[1] ?? null)}</td>
                  <td style={{ padding: "6px 12px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{formatProbe(hop.probes[2] ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {running && (
          <div style={{ padding: "8px 14px", fontSize: "11px", color: "var(--text-muted)" }}>
            Tracing route... {hops.length} hops so far
          </div>
        )}
        {done && hops.length > 0 && (
          <div style={{ padding: "8px 14px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border)" }}>
            <span style={{ color: "var(--color-success)" }}>Trace complete — {hops.length} hops.</span>
            <ExportButton
              filenamePrefix={`traceroute-${target}`}
              getContent={() => {
                const header = `Traceroute Report — ${target} — ${new Date().toLocaleString()}\n${"=".repeat(60)}\n\nHop  IP Address          Probe 1    Probe 2    Probe 3\n`;
                const rows = hops.map((h) =>
                  `${String(h.hop).padEnd(4)} ${(h.ip ?? "*").padEnd(18)} ${h.probes.map((p) => p === null ? "   *      " : `${p.toFixed(2)} ms`).join("  ")}`
                ).join("\n");
                return header + rows + "\n";
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

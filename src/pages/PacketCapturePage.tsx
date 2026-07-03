import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Circle, StopCircle, AlertTriangle, FolderOpen, ExternalLink, Info } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaptureConfig {
  interface: string;
  filter: string | null;
  packet_count: number | null;
  output_path: string;
}

interface CaptureProgress {
  packets_captured: number;
  file_size_bytes: number;
  message: string;
}

type StopMode = "manual" | "packets" | "seconds";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function defaultOutputPath(): string {
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  return `~/captures/capture_${ts}.pcap`;
}

// ─── Filter Examples ─────────────────────────────────────────────────────────

const FILTER_EXAMPLES: { label: string; value: string; desc: string }[] = [
  { label: "HTTP",       value: "port 80",          desc: "HTTP traffic" },
  { label: "HTTPS",      value: "port 443",         desc: "HTTPS traffic" },
  { label: "DNS",        value: "port 53",          desc: "DNS queries" },
  { label: "TCP only",   value: "tcp",              desc: "TCP packets" },
  { label: "UDP only",   value: "udp",              desc: "UDP packets" },
  { label: "ICMP",       value: "icmp",             desc: "Ping/ICMP" },
  { label: "No SSH",     value: "not port 22",      desc: "Exclude SSH" },
  { label: "8.8.8.8",    value: "host 8.8.8.8",    desc: "Specific host" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PacketCapturePage() {
  const [interfaces, setInterfaces] = useState<string[]>([]);
  const [selectedIface, setSelectedIface] = useState("");
  const [filter, setFilter] = useState("");
  const [outputPath, setOutputPath] = useState(defaultOutputPath());
  const [stopMode, setStopMode] = useState<StopMode>("manual");
  const [stopPackets, setStopPackets] = useState("100");
  const [stopSeconds, setStopSeconds] = useState("60");

  const [hasTcpdump, setHasTcpdump] = useState<boolean | null>(null);
  const [hasWireshark, setHasWireshark] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState<CaptureProgress | null>(null);
  const [lastOutputPath, setLastOutputPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // seconds countdown for timed capture
  const [remaining, setRemaining] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlistenRef = useRef<UnlistenFn[]>([]);

  // Check deps and load interfaces on mount
  useEffect(() => {
    async function init() {
      const [tcp, ws, ifaces] = await Promise.all([
        invoke<boolean>("check_tcpdump_available"),
        invoke<boolean>("check_wireshark_available"),
        invoke<string[]>("list_traffic_interfaces"),
      ]);
      setHasTcpdump(tcp);
      setHasWireshark(ws);
      setInterfaces(ifaces);
      if (ifaces.length > 0) setSelectedIface(ifaces[0]);
    }
    init();

    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    unlistenRef.current.forEach((fn) => fn());
    unlistenRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
  }

  const handleStop = useCallback(async () => {
    cleanup();
    try {
      const path = await invoke<string>("stop_capture");
      setLastOutputPath(path || null);
    } catch {
      // ignore
    }
    setStatus("done");
    setRemaining(null);
  }, []);

  const handleStart = useCallback(async () => {
    setError(null);
    setProgress(null);
    setLastOutputPath(null);

    // Expand ~ in path
    const expandedPath = await invoke<string>("expand_capture_path", { path: outputPath });

    // Ensure parent dir exists (best effort via Rust)
    const config: CaptureConfig = {
      interface: selectedIface,
      filter: filter.trim() || null,
      packet_count: stopMode === "packets" ? parseInt(stopPackets, 10) : null,
      output_path: expandedPath,
    };

    // Subscribe to events
    const unProg = await listen<CaptureProgress>("capture_progress", (e) => {
      setProgress(e.payload);
    });
    const unDone = await listen<string>("capture_done", (e) => {
      setLastOutputPath(e.payload);
      setStatus("done");
      if (timerRef.current) clearInterval(timerRef.current);
    });
    unlistenRef.current = [unProg, unDone];

    // Start seconds countdown
    if (stopMode === "seconds") {
      const secs = parseInt(stopSeconds, 10);
      setRemaining(secs);
      timerRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev === null || prev <= 1) {
            // time up — stop capture
            handleStop();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }

    try {
      await invoke("start_capture", { config });
      setStatus("running");
    } catch (err) {
      setError(String(err));
      setStatus("error");
      cleanup();
    }
  }, [selectedIface, filter, outputPath, stopMode, stopPackets, stopSeconds, handleStop]);

  async function handleOpenWireshark() {
    if (!lastOutputPath) return;
    try {
      await invoke("open_in_wireshark", { path: lastOutputPath });
    } catch (err) {
      setError(String(err));
    }
  }

  function handleReset() {
    setStatus("idle");
    setProgress(null);
    setLastOutputPath(null);
    setError(null);
    setRemaining(null);
    setOutputPath(defaultOutputPath());
  }

  // ── No tcpdump ───────────────────────────────────────────────────────────
  if (hasTcpdump === false) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 32,
        }}
      >
        <AlertTriangle size={36} color="var(--color-warning)" />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          tcpdump tidak ditemukan
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 340, textAlign: "center" }}>
          Packet Capture membutuhkan tcpdump. Install dengan:
        </div>
        <code
          style={{
            background: "var(--surface-3)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "6px 14px",
            fontSize: 12,
          }}
        >
          sudo pacman -S tcpdump
        </code>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          atau: sudo apt install tcpdump / sudo dnf install tcpdump
        </div>
      </div>
    );
  }

  if (hasTcpdump === null) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
        Checking dependencies...
      </div>
    );
  }

  const isRunning = status === "running";
  const isDone = status === "done";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}>
      {/* ── Config panel ────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Row 1: Interface + Filter */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <FormField label="Interface">
            <select
              value={selectedIface}
              onChange={(e) => setSelectedIface(e.target.value)}
              disabled={isRunning}
              style={selectStyle}
            >
              {interfaces.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </FormField>

          <FormField label="BPF Filter (optional)" style={{ flex: 1, minWidth: 200 }}>
            <input
              type="text"
              placeholder='e.g. port 80, host 8.8.8.8, tcp'
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              disabled={isRunning}
              style={{ ...inputStyle, width: "100%" }}
            />
          </FormField>
        </div>

        {/* Filter examples */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {FILTER_EXAMPLES.map((ex) => (
            <button
              key={ex.value}
              onClick={() => setFilter(ex.value)}
              disabled={isRunning}
              title={ex.desc}
              style={{
                padding: "2px 8px",
                fontSize: 10,
                border: "1px solid var(--border)",
                borderRadius: 3,
                background: filter === ex.value ? "var(--accent)" : "var(--surface-3)",
                color: filter === ex.value ? "#fff" : "var(--text-secondary)",
                cursor: isRunning ? "not-allowed" : "pointer",
              }}
            >
              {ex.label}
            </button>
          ))}
          {filter && (
            <button
              onClick={() => setFilter("")}
              disabled={isRunning}
              style={{
                padding: "2px 8px",
                fontSize: 10,
                border: "1px solid var(--border)",
                borderRadius: 3,
                background: "transparent",
                color: "#dc3545",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Row 2: Output path */}
        <FormField label="Output File (.pcap)">
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              disabled={isRunning}
              style={{ ...inputStyle, flex: 1, fontFamily: "monospace", fontSize: 11 }}
            />
            <button
              title="Open file manager to choose location"
              disabled={isRunning}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                fontSize: 11,
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                cursor: "pointer",
                color: "var(--text-secondary)",
              }}
              onClick={() => {
                // Hint: update path manually — Tauri dialog API needs plugin
                const name = prompt("Enter output file path:", outputPath);
                if (name) setOutputPath(name);
              }}
            >
              <FolderOpen size={12} /> Browse
            </button>
          </div>
        </FormField>

        {/* Row 3: Stop condition */}
        <FormField label="Stop After">
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            {(["manual", "packets", "seconds"] as StopMode[]).map((mode) => (
              <label
                key={mode}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}
              >
                <input
                  type="radio"
                  checked={stopMode === mode}
                  onChange={() => setStopMode(mode)}
                  disabled={isRunning}
                />
                {mode === "manual" && "Manual stop"}
                {mode === "packets" && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="number"
                      min={1}
                      value={stopPackets}
                      onChange={(e) => setStopPackets(e.target.value)}
                      disabled={isRunning || stopMode !== "packets"}
                      style={{ ...inputStyle, width: 72 }}
                    />
                    packets
                  </span>
                )}
                {mode === "seconds" && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="number"
                      min={1}
                      value={stopSeconds}
                      onChange={(e) => setStopSeconds(e.target.value)}
                      disabled={isRunning || stopMode !== "seconds"}
                      style={{ ...inputStyle, width: 72 }}
                    />
                    seconds
                    {isRunning && stopMode === "seconds" && remaining !== null && (
                      <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: "monospace" }}>
                        ({remaining}s left)
                      </span>
                    )}
                  </span>
                )}
              </label>
            ))}
          </div>
        </FormField>

        {/* ── Action button ────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={!selectedIface}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 20px",
                fontSize: 13,
                fontWeight: 700,
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 5,
                cursor: selectedIface ? "pointer" : "not-allowed",
              }}
            >
              <Circle size={13} fill="#fff" /> Start Capture
            </button>
          ) : (
            <button
              onClick={handleStop}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 20px",
                fontSize: 13,
                fontWeight: 700,
                background: "#dc3545",
                color: "#fff",
                border: "none",
                borderRadius: 5,
                cursor: "pointer",
              }}
            >
              <StopCircle size={13} /> Stop Capture
            </button>
          )}

          {isDone && (
            <button
              onClick={handleReset}
              style={{
                padding: "6px 14px",
                fontSize: 12,
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                cursor: "pointer",
                color: "var(--text-secondary)",
              }}
            >
              Reset
            </button>
          )}
        </div>

        {/* ── Status / Progress ────────────────────────────────────── */}
        {(isRunning || isDone) && progress && (
          <div
            style={{
              padding: "12px 16px",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: isRunning ? "var(--accent)" : "var(--color-success)", fontWeight: 600 }}>
                {isRunning ? "● Capturing..." : "✓ Done"}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                {progress.message}
              </span>
            </div>
            <div style={{ display: "flex", gap: 24, fontSize: 12 }}>
              <span>
                <span style={{ color: "var(--text-muted)" }}>Packets: </span>
                <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                  ~{progress.packets_captured}
                </span>
              </span>
              <span>
                <span style={{ color: "var(--text-muted)" }}>File size: </span>
                <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                  {formatBytes(progress.file_size_bytes)}
                </span>
              </span>
            </div>
            {lastOutputPath && (
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", wordBreak: "break-all" }}>
                {lastOutputPath}
              </div>
            )}
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────── */}
        {error && (
          <div
            style={{
              padding: "8px 14px",
              background: "rgba(220,53,69,0.08)",
              border: "1px solid rgba(220,53,69,0.25)",
              borderRadius: 4,
              fontSize: 11,
              color: "#dc3545",
            }}
          >
            {error}
          </div>
        )}

        {/* ── Open in Wireshark ────────────────────────────────────── */}
        {isDone && lastOutputPath && hasWireshark && (
          <button
            onClick={handleOpenWireshark}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 16px",
              fontSize: 12,
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              borderRadius: 5,
              cursor: "pointer",
              color: "var(--text-primary)",
              width: "fit-content",
            }}
          >
            <ExternalLink size={13} /> Open in Wireshark
          </button>
        )}

        {/* ── BPF Filter reference ─────────────────────────────────── */}
        <div
          style={{
            padding: "12px 16px",
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 11,
            color: "var(--text-secondary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontWeight: 600, color: "var(--text-primary)" }}>
            <Info size={12} color="var(--accent)" /> BPF Filter Reference
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 20px" }}>
            {[
              ["port 80",        "→ HTTP traffic"],
              ["host 8.8.8.8",   "→ traffic to/from 8.8.8.8"],
              ["tcp",            "→ TCP only"],
              ["udp",            "→ UDP only"],
              ["not port 22",    "→ exclude SSH"],
              ["port 80 or 443", "→ HTTP + HTTPS"],
            ].map(([code, desc]) => (
              <div key={code} style={{ display: "flex", gap: 8 }}>
                <code style={{ color: "var(--accent)", fontFamily: "monospace", minWidth: 120 }}>{code}</code>
                <span style={{ color: "var(--text-muted)" }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* sudo note */}
        <div
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            fontStyle: "italic",
            paddingBottom: 8,
          }}
        >
          ⚠ Packet capture requires sudo. Ensure passwordless sudo is configured for tcpdump, or run the app with elevated privileges.
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormField({
  label,
  children,
  style: extraStyle,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, ...extraStyle }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: "5px 9px",
  fontSize: 12,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--surface-0)",
  color: "var(--text-primary)",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  padding: "5px 9px",
  fontSize: 12,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--surface-0)",
  color: "var(--text-primary)",
};

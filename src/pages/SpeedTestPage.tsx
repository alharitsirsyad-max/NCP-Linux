import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Play, Square, Wifi } from "lucide-react";
import { useSpeedTest } from "../hooks/useSpeedTest";
import SpeedGauge from "../components/speedtest/SpeedGauge";
import SpeedTestProgressBar from "../components/speedtest/SpeedTestProgressBar";

export default function SpeedTestPage() {
  const { status, stage, percent, message, result, error, start, reset } = useSpeedTest();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [lastResult, setLastResult] = useState<typeof result>(null);
  const [lastTime, setLastTime] = useState<string | null>(null);

  useEffect(() => {
    invoke<boolean>("check_speedtest_available").then(setAvailable).catch(() => setAvailable(false));
  }, []);

  // Save last result when test completes
  useEffect(() => {
    if (status === "done" && result) {
      setLastResult(result);
      setLastTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }
  }, [status, result]);

  const handleStart = () => {
    if (status === "running") {
      reset();
    } else {
      start();
    }
  };

  if (available === false) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }}>
        <div style={{ textAlign: "center", maxWidth: "380px" }}>
          <Wifi size={40} style={{ color: "var(--text-muted)", marginBottom: "16px" }} />
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
            speedtest-cli not found
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
            Install the required tool to use Speed Test:
          </div>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-primary)", textAlign: "left" }}>
            <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}># Arch Linux</div>
            <div>sudo pacman -S speedtest-cli</div>
            <div style={{ color: "var(--text-muted)", margin: "8px 0 4px" }}># Ubuntu/Debian</div>
            <div>sudo apt install speedtest-cli</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: "560px", display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>Speed Test</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
            Powered by speedtest-cli
          </div>
        </div>

        {/* Server/ISP info (setelah test selesai) */}
        {result && (
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            <span style={{ padding: "3px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "11px", color: "var(--text-secondary)" }}>
              ISP: <strong>{result.isp}</strong>
            </span>
            <span style={{ padding: "3px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "11px", color: "var(--text-secondary)" }}>
              Server: <strong>{result.server_name}{result.server_country ? `, ${result.server_country}` : ""}</strong>
            </span>
          </div>
        )}

        {/* Three gauges */}
        <div style={{ display: "flex", gap: "12px" }}>
          <SpeedGauge
            label="Ping"
            value={result?.ping ?? null}
            unit="ms"
            color="#f59e0b"
            isActive={stage === "ping"}
          />
          <SpeedGauge
            label="Download"
            value={result?.download ?? null}
            unit="Mbps"
            color="var(--accent)"
            isActive={stage === "download"}
          />
          <SpeedGauge
            label="Upload"
            value={result?.upload ?? null}
            unit="Mbps"
            color="var(--color-success)"
            isActive={stage === "upload"}
          />
        </div>

        {/* Progress bar */}
        {status === "running" && (
          <SpeedTestProgressBar stage={stage ?? "ping"} percent={percent} message={message} />
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: "10px 14px", background: "rgba(196,43,28,0.08)", border: "1px solid rgba(196,43,28,0.25)", borderRadius: "var(--radius-sm)", fontSize: "12px", color: "var(--color-error)" }}>
            {error}
          </div>
        )}

        {/* Start / Stop button */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            onClick={handleStart}
            disabled={available === null}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 40px",
              background: status === "running" ? "var(--color-error)" : "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontSize: "14px",
              fontWeight: 600,
              cursor: available === null ? "not-allowed" : "pointer",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {status === "running"
              ? <><Square size={16} /> Stop</>
              : <><Play size={16} /> Start Test</>
            }
          </button>
        </div>

        {/* Last result bar */}
        {lastResult && lastTime && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px", display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", color: "var(--text-muted)", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Last result:</span>
            <span>Today {lastTime}</span>
            <span style={{ color: "var(--accent)" }}>↓ {lastResult.download.toFixed(1)} Mbps</span>
            <span style={{ color: "var(--color-success)" }}>↑ {lastResult.upload.toFixed(1)} Mbps</span>
            <span style={{ color: "#f59e0b" }}>⬥ {lastResult.ping.toFixed(0)} ms</span>
          </div>
        )}
      </div>
    </div>
  );
}

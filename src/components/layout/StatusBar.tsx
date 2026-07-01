import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface TrafficSnapshot {
  interface: string;
  bytes_rx: number;
  bytes_tx: number;
}

interface UptimeInfo {
  uptime_seconds: number;
}

interface InternetStatus {
  online: boolean;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 0) return "-- KB/s";
  if (bytesPerSec >= 1_048_576) return `${(bytesPerSec / 1_048_576).toFixed(2)} MB/s`;
  return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
}

function formatUptime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

interface SegmentProps {
  children: React.ReactNode;
  last?: boolean;
}

function Segment({ children, last }: SegmentProps) {
  return (
    <div style={{ padding: "0 10px", borderRight: last ? "none" : "1px solid var(--border)", display: "flex", alignItems: "center", height: "100%", whiteSpace: "nowrap" }}>
      {children}
    </div>
  );
}

export default function StatusBar() {
  const [rxSpeed, setRxSpeed] = useState(0);
  const [txSpeed, setTxSpeed] = useState(0);
  const [uptime, setUptime] = useState(0);
  const [online, setOnline] = useState<boolean | null>(null);
  const prevTrafficRef = useRef<{ rx: number; tx: number; time: number } | null>(null);

  // Traffic polling every 1 second
  useEffect(() => {
    const pollTraffic = async () => {
      try {
        const snapshots = await invoke<TrafficSnapshot[]>("get_traffic_snapshot");
        // Sum all non-loopback interfaces
        let totalRx = 0, totalTx = 0;
        for (const s of snapshots) {
          if (s.interface !== "lo") {
            totalRx += s.bytes_rx;
            totalTx += s.bytes_tx;
          }
        }
        const now = Date.now();
        if (prevTrafficRef.current) {
          const dt = (now - prevTrafficRef.current.time) / 1000;
          if (dt > 0) {
            setRxSpeed(Math.max(0, (totalRx - prevTrafficRef.current.rx) / dt));
            setTxSpeed(Math.max(0, (totalTx - prevTrafficRef.current.tx) / dt));
          }
        }
        prevTrafficRef.current = { rx: totalRx, tx: totalTx, time: now };
      } catch {
        // not in Tauri context yet
      }
    };
    pollTraffic();
    const id = setInterval(pollTraffic, 1000);
    return () => clearInterval(id);
  }, []);

  // Uptime polling every 5 seconds
  useEffect(() => {
    const pollUptime = async () => {
      try {
        const info = await invoke<UptimeInfo>("get_uptime");
        setUptime(info.uptime_seconds);
      } catch {}
    };
    pollUptime();
    const id = setInterval(pollUptime, 5000);
    return () => clearInterval(id);
  }, []);

  // Internet check every 30 seconds
  useEffect(() => {
    const checkInternet = async () => {
      try {
        const status = await invoke<InternetStatus>("check_internet");
        setOnline(status.online);
      } catch {}
    };
    checkInternet();
    const id = setInterval(checkInternet, 30000);
    return () => clearInterval(id);
  }, []);

  const internetText =
    online === null ? "Internet: checking..." :
    online ? "Internet: Online" : "Internet: Offline";

  const internetColor =
    online === null ? "var(--text-muted)" :
    online ? "var(--color-success)" : "var(--color-error)";

  return (
    <div style={{ height: "var(--statusbar-height)", background: "var(--surface-2)", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", fontSize: "11px", color: "var(--text-secondary)", flexShrink: 0, overflow: "hidden" }}>
      <Segment>↓ {formatSpeed(rxSpeed)}</Segment>
      <Segment>↑ {formatSpeed(txSpeed)}</Segment>
      <Segment>Uptime: {uptime > 0 ? formatUptime(uptime) : "--"}</Segment>
      <Segment last>
        <span style={{ color: internetColor }}>{internetText}</span>
      </Segment>
    </div>
  );
}

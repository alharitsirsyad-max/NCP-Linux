import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface TrafficSnapshot {
  interface: string;
  bytes_rx: number;
  bytes_tx: number;
}

interface DataPoint {
  rx: number; // bytes/sec
  tx: number;
}

const HISTORY = 60; // 60 seconds of history
const POLL_MS = 1000;

function formatSpeed(bps: number): string {
  if (bps >= 1_048_576) return `${(bps / 1_048_576).toFixed(1)} MB/s`;
  if (bps >= 1024)      return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
}

interface BandwidthGraphProps {
  iface: string; // interface name to monitor
  height?: number;
}

export default function BandwidthGraph({ iface, height = 80 }: BandwidthGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<DataPoint[]>([]);
  const prevRef = useRef<{ rx: number; tx: number; time: number } | null>(null);
  const [currentRx, setCurrentRx] = useState(0);
  const [currentTx, setCurrentTx] = useState(0);

  useEffect(() => {
    let animId: number;

    const poll = async () => {
      try {
        const snapshots = await invoke<TrafficSnapshot[]>("get_traffic_snapshot");
        const snap = snapshots.find((s) => s.interface === iface);
        if (!snap) return;

        const now = Date.now();
        if (prevRef.current) {
          const dt = (now - prevRef.current.time) / 1000;
          if (dt > 0) {
            const rx = Math.max(0, (snap.bytes_rx - prevRef.current.rx) / dt);
            const tx = Math.max(0, (snap.bytes_tx - prevRef.current.tx) / dt);
            historyRef.current = [...historyRef.current.slice(-(HISTORY - 1)), { rx, tx }];
            setCurrentRx(rx);
            setCurrentTx(tx);
          }
        }
        prevRef.current = { rx: snap.bytes_rx, tx: snap.bytes_tx, time: now };
      } catch {
        // not in Tauri context
      }
    };

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const data = historyRef.current;

      ctx.clearRect(0, 0, w, h);

      if (data.length < 2) {
        animId = requestAnimationFrame(draw);
        return;
      }

      const maxVal = Math.max(...data.map((d) => Math.max(d.rx, d.tx)), 1024);
      const step = w / (HISTORY - 1);

      const drawLine = (values: number[], color: string, fillColor: string) => {
        ctx.beginPath();
        values.forEach((v, i) => {
          const x = i * step;
          const y = h - (v / maxVal) * (h - 4);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        // Fill
        ctx.lineTo((values.length - 1) * step, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();

        // Line
        ctx.beginPath();
        values.forEach((v, i) => {
          const x = i * step;
          const y = h - (v / maxVal) * (h - 4);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      };

      const padded = Array(HISTORY - data.length).fill({ rx: 0, tx: 0 }).concat(data);
      drawLine(padded.map((d) => d.rx), "#107c10", "rgba(16,124,16,0.15)");
      drawLine(padded.map((d) => d.tx), "#0067b8", "rgba(0,103,184,0.15)");

      animId = requestAnimationFrame(draw);
    };

    const id = setInterval(poll, POLL_MS);
    poll();
    draw();

    return () => {
      clearInterval(id);
      cancelAnimationFrame(animId);
    };
  }, [iface]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {/* Speed labels */}
      <div style={{ display: "flex", gap: "16px", fontSize: "11px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "10px", height: "3px", background: "#107c10", display: "inline-block", borderRadius: "2px" }} />
          <span style={{ color: "var(--text-muted)" }}>↓</span>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-success)", fontWeight: 600 }}>
            {formatSpeed(currentRx)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "10px", height: "3px", background: "#0067b8", display: "inline-block", borderRadius: "2px" }} />
          <span style={{ color: "var(--text-muted)" }}>↑</span>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: 600 }}>
            {formatSpeed(currentTx)}
          </span>
        </div>
        <span style={{ marginLeft: "auto", fontSize: "10px", color: "var(--text-muted)" }}>
          60s
        </span>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={400}
        height={height}
        style={{
          width: "100%",
          height: `${height}px`,
          background: "var(--surface-0)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          display: "block",
        }}
      />
    </div>
  );
}

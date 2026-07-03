import { useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrafficPoint {
  timestamp: number;
  rx_bytes_per_sec: number;
  tx_bytes_per_sec: number;
}

interface TrafficGraphProps {
  points: TrafficPoint[];
  duration: 60 | 300 | 3600;
  onDurationChange: (d: 60 | 300 | 3600) => void;
  width?: number;
  height?: number;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatBytes(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ─── SVG Graph ────────────────────────────────────────────────────────────────

const PADDING = { top: 16, right: 12, bottom: 32, left: 64 };

export default function TrafficGraph({
  points,
  duration,
  onDurationChange,
  width = 600,
  height = 220,
}: TrafficGraphProps) {
  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;

  // Slice to the requested duration (most recent N points)
  const visible = useMemo(() => {
    if (points.length === 0) return [];
    return points.slice(-duration);
  }, [points, duration]);

  // Max value across both series (with min floor)
  const maxVal = useMemo(() => {
    if (visible.length === 0) return 1000;
    const peak = Math.max(
      ...visible.map((p) => Math.max(p.rx_bytes_per_sec, p.tx_bytes_per_sec))
    );
    return Math.max(peak * 1.2, 1000);
  }, [visible]);

  // Scale helpers
  const scaleX = (i: number) =>
    visible.length <= 1 ? innerW : (i / (visible.length - 1)) * innerW;
  const scaleY = (val: number) =>
    innerH - (val / maxVal) * innerH;

  // Build SVG path string from values
  function buildPath(vals: number[]): string {
    if (vals.length === 0) return "";
    const pts = vals.map((v, i) => `${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`);
    return `M${pts.join(" L")}`;
  }

  // Build area path (closed below the line)
  function buildArea(vals: number[]): string {
    if (vals.length === 0) return "";
    const line = vals.map((v, i) => `${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`);
    const lastX = scaleX(vals.length - 1).toFixed(1);
    return `M0,${innerH} L${line.join(" L")} L${lastX},${innerH} Z`;
  }

  const rxVals = visible.map((p) => p.rx_bytes_per_sec);
  const txVals = visible.map((p) => p.tx_bytes_per_sec);

  // Y-axis ticks (4 levels)
  const yTicks = [0.25, 0.5, 0.75, 1.0].map((t) => ({
    y: scaleY(t * maxVal),
    label: formatBytes(t * maxVal),
  }));

  // X-axis ticks (show ~4 timestamps)
  const xTicks = useMemo(() => {
    if (visible.length < 2) return [];
    const count = 4;
    const step = Math.floor(visible.length / count);
    return Array.from({ length: count }, (_, i) => {
      const idx = i * step;
      return { x: scaleX(idx), label: formatTime(visible[idx].timestamp) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const currentRx = visible.length > 0 ? visible[visible.length - 1].rx_bytes_per_sec : 0;
  const currentTx = visible.length > 0 ? visible[visible.length - 1].tx_bytes_per_sec : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Duration toggle + legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 8px 6px",
        }}
      >
        {/* Legend */}
        <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ display: "inline-block", width: 24, height: 2, background: "#0078d4", borderRadius: 1 }} />
            <span style={{ color: "var(--text-secondary)" }}>
              Download <span style={{ fontFamily: "monospace", color: "#0078d4", fontWeight: 600 }}>{formatBytes(currentRx)}</span>
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ display: "inline-block", width: 24, height: 2, background: "#107c10", borderRadius: 1 }} />
            <span style={{ color: "var(--text-secondary)" }}>
              Upload <span style={{ fontFamily: "monospace", color: "#107c10", fontWeight: 600 }}>{formatBytes(currentTx)}</span>
            </span>
          </span>
        </div>

        {/* Duration buttons */}
        <div style={{ display: "flex", gap: 2 }}>
          {([60, 300, 3600] as const).map((d) => (
            <button
              key={d}
              onClick={() => onDurationChange(d)}
              style={{
                padding: "2px 8px",
                fontSize: 10,
                fontWeight: 600,
                border: "1px solid var(--border)",
                borderRadius: 3,
                cursor: "pointer",
                background: duration === d ? "var(--accent)" : "var(--surface-3)",
                color: duration === d ? "#fff" : "var(--text-secondary)",
              }}
            >
              {d === 60 ? "1m" : d === 300 ? "5m" : "1h"}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart */}
      <svg
        width={width}
        height={height}
        style={{ display: "block", overflow: "visible" }}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0078d4" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0078d4" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#107c10" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#107c10" stopOpacity="0.02" />
          </linearGradient>
          <clipPath id="chartClip">
            <rect x="0" y="0" width={innerW} height={innerH} />
          </clipPath>
        </defs>

        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* Grid lines */}
          {yTicks.map((t, i) => (
            <line
              key={i}
              x1={0}
              y1={t.y}
              x2={innerW}
              y2={t.y}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          ))}

          {/* Area fills */}
          <g clipPath="url(#chartClip)">
            <path d={buildArea(rxVals)} fill="url(#rxGrad)" />
            <path d={buildArea(txVals)} fill="url(#txGrad)" />

            {/* Lines */}
            <path
              d={buildPath(rxVals)}
              fill="none"
              stroke="#0078d4"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={buildPath(txVals)}
              fill="none"
              stroke="#107c10"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>

          {/* Y-axis labels */}
          {yTicks.map((t, i) => (
            <text
              key={i}
              x={-6}
              y={t.y + 4}
              textAnchor="end"
              fontSize={9}
              fill="var(--text-muted)"
              fontFamily="monospace"
            >
              {t.label}
            </text>
          ))}

          {/* X-axis labels */}
          {xTicks.map((t, i) => (
            <text
              key={i}
              x={t.x}
              y={innerH + 18}
              textAnchor="middle"
              fontSize={9}
              fill="var(--text-muted)"
            >
              {t.label}
            </text>
          ))}

          {/* Axes */}
          <line x1={0} y1={0} x2={0} y2={innerH} stroke="var(--border)" strokeWidth={1} />
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="var(--border)" strokeWidth={1} />

          {/* Empty state */}
          {visible.length === 0 && (
            <text
              x={innerW / 2}
              y={innerH / 2}
              textAnchor="middle"
              fontSize={11}
              fill="var(--text-muted)"
            >
              Waiting for data...
            </text>
          )}
        </g>
      </svg>
    </div>
  );
}

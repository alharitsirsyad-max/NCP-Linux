interface SpeedTestProgressBarProps {
  stage: string;
  percent: number;
  message: string;
}

function stageColor(stage: string): string {
  switch (stage) {
    case "ping":     return "#f59e0b";   // orange
    case "download": return "var(--accent)";  // blue
    case "upload":   return "var(--color-success)"; // green
    default:         return "var(--accent)";
  }
}

export default function SpeedTestProgressBar({ stage, percent, message }: SpeedTestProgressBarProps) {
  const color = stageColor(stage);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{message}</span>
        <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color, fontWeight: 600 }}>
          {percent}%
        </span>
      </div>
      <div
        style={{
          height: "8px",
          background: "var(--surface-3)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percent}%`,
            background: color,
            borderRadius: "var(--radius-sm)",
            transition: "width 0.5s ease, background 0.3s",
          }}
        />
      </div>
    </div>
  );
}

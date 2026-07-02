import { useEffect, useState } from "react";

interface SpeedGaugeProps {
  label: string;
  value: number | null;
  unit: string;
  color: string;
  isActive: boolean;
}

export default function SpeedGauge({ label, value, unit, color, isActive }: SpeedGaugeProps) {
  const [displayed, setDisplayed] = useState(0);

  // Animate counter when value arrives
  useEffect(() => {
    if (value === null) { setDisplayed(0); return; }
    const target = value;
    const duration = 800;
    const steps = 30;
    const step = target / steps;
    let current = 0;
    let count = 0;

    const id = setInterval(() => {
      count++;
      current = Math.min(current + step, target);
      setDisplayed(current);
      if (count >= steps) clearInterval(id);
    }, duration / steps);

    return () => clearInterval(id);
  }, [value]);

  const displayValue = value === null ? "—" : displayed.toFixed(1);

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: `2px solid ${isActive ? color : "var(--border)"}`,
        borderRadius: "var(--radius-lg)",
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        minWidth: "140px",
        flex: 1,
        animation: isActive ? "pulseGauge 1.2s ease-in-out infinite" : "none",
        transition: "border-color 0.3s",
        boxShadow: isActive ? `0 0 12px ${color}33` : "none",
      }}
    >
      <div
        style={{
          fontSize: "36px",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          color: value !== null ? color : "var(--text-muted)",
          lineHeight: 1,
          minHeight: "44px",
          display: "flex",
          alignItems: "center",
        }}
      >
        {displayValue}
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        {unit}
      </div>
      <div style={{ fontSize: "11px", fontWeight: 600, color: isActive ? color : "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "4px" }}>
        {label}
      </div>
    </div>
  );
}

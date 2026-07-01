// Base card wrapper used by all dashboard cards

interface DashboardCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  minHeight?: string;
}

export default function DashboardCard({ title, icon, children, minHeight }: DashboardCardProps) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        minHeight: minHeight ?? "120px",
      }}
    >
      {/* Card header */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {icon && <span style={{ color: "var(--accent)" }}>{icon}</span>}
        <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
          {title}
        </span>
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

import SystemInfoCard from "../components/dashboard/SystemInfoCard";
import NetworkSummaryCard from "../components/dashboard/NetworkSummaryCard";
import InternetStatusCard from "../components/dashboard/InternetStatusCard";
import TrafficCard from "../components/dashboard/TrafficCard";
import { useAdapters } from "../hooks/useAdapters";
import { mockAdapters } from "../mock/adapters";

export default function DashboardPage() {
  const { data: adapterData } = useAdapters();
  const adapters = adapterData ?? mockAdapters;
  const connectedAdapters = adapters.filter((a) => a.state === "connected");

  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        minHeight: 0,
      }}
    >
      {/* Cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
        }}
      >
        <SystemInfoCard />
        <NetworkSummaryCard />
        <InternetStatusCard />
        <TrafficCard />
      </div>

      {/* Active adapters section */}
      <div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
            marginBottom: "8px",
          }}
        >
          Active Adapters ({connectedAdapters.length})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {connectedAdapters.map((adapter) => (
            <div
              key={adapter.name}
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "var(--color-success)",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>
                    {adapter.display_name}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                    {adapter.name}
                  </span>
                </div>
                {adapter.ipv4 && (
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                    {adapter.ipv4}/{adapter.ipv4_prefix}
                  </span>
                )}
              </div>
              {adapter.gateway && (
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  GW: {adapter.gateway}
                </span>
              )}
            </div>
          ))}
          {connectedAdapters.length === 0 && (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "10px 0" }}>
              No active adapters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

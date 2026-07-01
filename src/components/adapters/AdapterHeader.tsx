import { useState } from "react";
import {
  Wifi, Monitor, Shield, Container, Settings, Stethoscope, Network,
} from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import AdapterPropertiesDialog from "./AdapterPropertiesDialog";
import type { NetworkAdapter, AdapterType } from "../../types/network";

interface AdapterHeaderProps {
  adapter: NetworkAdapter;
}

function getLargeIcon(adapter: NetworkAdapter) {
  const size = 28;
  if (adapter.name.startsWith("docker") || adapter.name.startsWith("br-")) {
    return <Container size={size} />;
  }
  switch (adapter.adapter_type as AdapterType) {
    case "wifi":     return <Wifi size={size} />;
    case "vpn":      return <Shield size={size} />;
    case "loopback":
    case "virtual":  return <Monitor size={size} />;
    default:         return <Network size={size} />;
  }
}

function getSpeedLabel(adapter: NetworkAdapter): string {
  if (adapter.speed) return `${adapter.speed} Mbps`;
  const typeMap: Partial<Record<AdapterType, string>> = {
    ethernet: "Ethernet",
    wifi:     "Wi-Fi",
    vpn:      "VPN Tunnel",
    virtual:  "Virtual",
    loopback: "Loopback",
  };
  return typeMap[adapter.adapter_type as AdapterType] ?? adapter.adapter_type;
}

export default function AdapterHeader({ adapter }: AdapterHeaderProps) {
  const isConnected = adapter.state === "connected";
  const { openDiagnostics } = useUIStore();
  const [showProperties, setShowProperties] = useState(false);

  const handleProperties = () => {
    setShowProperties(true);
  };

  return (
    <>
    <div
      style={{
        padding: "16px 20px",
        background: "var(--surface-1)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        flexShrink: 0,
      }}
    >
      {/* Icon box */}
      <div
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "var(--radius-lg)",
          background: "rgba(0, 103, 184, 0.08)",
          border: "1px solid rgba(0, 103, 184, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--accent)",
          flexShrink: 0,
        }}
      >
        {getLargeIcon(adapter)}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
          {adapter.display_name}
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
          {adapter.name} · {adapter.adapter_type}
        </div>
        <div style={{ marginTop: "6px" }}>
          <StatusBadge connected={isConnected} />
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", flexShrink: 0 }}>
        <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
          {getSpeedLabel(adapter)}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <ActionButton primary label="Properties" icon={<Settings size={12} />} onClick={handleProperties} />
          <ActionButton label="Diagnose" icon={<Stethoscope size={12} />} onClick={() => openDiagnostics("ping")} />
        </div>
      </div>
    </div>

    {showProperties && (
      <AdapterPropertiesDialog
        adapter={adapter}
        onClose={() => setShowProperties(false)}
      />
    )}
  </>
  );
}

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        borderRadius: "var(--radius-sm)",
        fontSize: "11px",
        fontWeight: 500,
        background: connected ? "rgba(16, 124, 16, 0.08)" : "var(--surface-3)",
        color: connected ? "var(--color-success)" : "var(--text-muted)",
        border: `1px solid ${connected ? "rgba(16, 124, 16, 0.25)" : "var(--border)"}`,
      }}
    >
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: connected ? "var(--color-success)" : "var(--text-muted)" }} />
      {connected ? "Connected" : "Disconnected"}
    </span>
  );
}

interface ActionButtonProps {
  label: string;
  icon: React.ReactNode;
  primary?: boolean;
  onClick?: () => void;
}

function ActionButton({ label, icon, primary, onClick }: ActionButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick ?? (() => {})}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 10px",
        borderRadius: "var(--radius-sm)",
        fontSize: "11px",
        cursor: "pointer",
        background: primary
          ? hovered ? "var(--accent-hover)" : "var(--accent)"
          : hovered ? "var(--surface-3)" : "transparent",
        color: primary ? "var(--on-accent)" : "var(--text-secondary)",
        border: primary ? "none" : "1px solid var(--border-strong)",
        transition: "background 0.1s",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

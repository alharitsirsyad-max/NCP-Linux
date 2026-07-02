import { useState } from "react";
import {
  Wifi, Monitor, Shield, Container,
  Stethoscope, Route, Table, DoorOpen,
  Loader, AlertCircle, Network, Settings, Terminal, Zap, ScanSearch, BarChart2, PowerOff,
} from "lucide-react";
import { useAdapters } from "../../hooks/useAdapters";
import { mockAdapters } from "../../mock/adapters";
import { useUIStore, type SelectedPage } from "../../stores/uiStore";
import type { NetworkAdapter, AdapterType } from "../../types/network";
import AdapterContextMenu from "../adapters/AdapterContextMenu";

function AdapterIcon({ adapter }: { adapter: NetworkAdapter }) {
  const size = 14;
  if (adapter.name.startsWith("docker") || adapter.name.startsWith("br-")) return <Container size={size} />;
  switch (adapter.adapter_type as AdapterType) {
    case "wifi":    return <Wifi size={size} />;
    case "vpn":     return <Shield size={size} />;
    case "loopback":
    case "virtual": return <Monitor size={size} />;
    default:        return <Network size={size} />;
  }
}

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: connected ? "var(--color-success)" : "var(--text-muted)", flexShrink: 0, display: "inline-block" }} />
  );
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 14px 4px", fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
      {children}
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  active: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  rightElement?: React.ReactNode;
}

function NavItem({ icon, label, sublabel, active, onClick, onContextMenu, rightElement }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 14px",
        background: active ? "rgba(0, 103, 184, 0.08)" : "transparent",
        borderLeftWidth: "2px",
        borderLeftStyle: "solid",
        borderLeftColor: active ? "var(--accent)" : "transparent",
        borderTop: "none",
        borderRight: "none",
        borderBottom: "none",
        cursor: "pointer",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        textAlign: "left",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >
      <span style={{ flexShrink: 0, color: active ? "var(--accent)" : "var(--text-muted)" }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        {sublabel && <div style={{ fontSize: "10px", color: "var(--text-muted)", lineHeight: 1.2 }}>{sublabel}</div>}
      </div>
      {rightElement}
    </button>
  );
}

const TOOLS: { id: SelectedPage; icon: React.ReactNode; label: string }[] = [
  { id: "diagnostics",  icon: <Stethoscope size={14} />, label: "Diagnostics" },
  { id: "routing",      icon: <Route size={14} />,       label: "Routing Table" },
  { id: "arp",          icon: <Table size={14} />,        label: "ARP Table" },
  { id: "ports",        icon: <DoorOpen size={14} />,     label: "Open Ports" },
  { id: "ssh",          icon: <Terminal size={14} />,     label: "SSH Connect" },
  { id: "speedtest",    icon: <Zap size={14} />,          label: "Speed Test" },
  { id: "lan_scanner",   icon: <ScanSearch size={14} />,  label: "LAN Scanner" },
  { id: "dns_benchmark", icon: <BarChart2 size={14} />,   label: "DNS Benchmark" },
  { id: "wol",           icon: <PowerOff size={14} />,    label: "Wake-on-LAN" },
  { id: "settings",      icon: <Settings size={14} />,    label: "Settings" },
];

interface ContextMenuState {
  adapter: NetworkAdapter;
  x: number;
  y: number;
}

export default function Sidebar() {
  const { selectedAdapter, selectedPage, setSelectedAdapter, setSelectedPage } = useUIStore();
  const { data, isLoading, isError } = useAdapters();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const adapters = data ?? mockAdapters;

  const handleContextMenu = (e: React.MouseEvent, adapter: NetworkAdapter) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ adapter, x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div
        style={{
          width: "var(--sidebar-width)",
          minWidth: "var(--sidebar-width)",
          background: "var(--surface-2)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          <SectionLabel>Network Adapters</SectionLabel>

          {isLoading && (
            <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "11px" }}>
              <Loader size={12} style={{ animation: "spin 1s linear infinite" }} />
              Loading adapters...
            </div>
          )}

          {isError && !isLoading && (
            <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px", color: "var(--color-warning)", fontSize: "11px" }}>
              <AlertCircle size={12} />
              Using offline data
            </div>
          )}

          {adapters.map((adapter) => {
            const isActive = selectedPage === "adapters" && selectedAdapter === adapter.name;
            return (
              <NavItem
                key={adapter.name}
                icon={<AdapterIcon adapter={adapter} />}
                label={adapter.display_name}
                sublabel={adapter.name}
                active={isActive}
                onClick={() => setSelectedAdapter(adapter.name)}
                onContextMenu={(e) => handleContextMenu(e, adapter)}
                rightElement={<StatusDot connected={adapter.state === "connected"} />}
              />
            );
          })}

          <div style={{ height: "1px", background: "var(--border)", margin: "6px 0" }} />

          <SectionLabel>Tools</SectionLabel>
          {TOOLS.map((tool) => (
            <NavItem
              key={tool.id}
              icon={tool.icon}
              label={tool.label}
              active={selectedPage === tool.id}
              onClick={() => setSelectedPage(tool.id)}
            />
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--border)", padding: "6px 10px", fontSize: "10px", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "3px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <StatusDot connected={true} />
            <span>Internet: OK</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <StatusDot connected={true} />
            <span>NetworkManager: active</span>
          </div>
        </div>
      </div>

      {/* Context menu portal */}
      {contextMenu && (
        <AdapterContextMenu
          adapter={contextMenu.adapter}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}

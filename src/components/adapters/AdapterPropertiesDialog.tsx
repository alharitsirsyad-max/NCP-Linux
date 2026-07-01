import { X } from "lucide-react";
import CopyButton from "../shared/CopyButton";
import type { NetworkAdapter } from "../../types/network";

interface AdapterPropertiesDialogProps {
  adapter: NetworkAdapter;
  onClose: () => void;
}

function prefixToMask(prefix: number): string {
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return [(mask >>> 24) & 0xff, (mask >>> 16) & 0xff, (mask >>> 8) & 0xff, mask & 0xff].join(".");
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1024)          return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function Section({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.08em", color: "var(--accent)",
      padding: "12px 0 6px",
      borderBottom: "1px solid var(--border)",
      marginBottom: "4px",
    }}>
      {title}
    </div>
  );
}

interface PropRowProps {
  label: string;
  value: string | null;
  mono?: boolean;
  copyable?: boolean;
}

function PropRow({ label, value, mono, copyable }: PropRowProps) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: "12px", color: "var(--text-muted)", minWidth: "140px", flexShrink: 0 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, justifyContent: "flex-end", minWidth: 0 }}>
        <span style={{
          fontSize: "12px",
          color: value ? "var(--text-primary)" : "var(--text-muted)",
          fontFamily: mono ? "var(--font-mono)" : undefined,
          textAlign: "right",
          wordBreak: "break-all",
        }}>
          {value ?? "—"}
        </span>
        {copyable && value && <CopyButton text={value} />}
      </div>
    </div>
  );
}

export default function AdapterPropertiesDialog({ adapter, onClose }: AdapterPropertiesDialogProps) {
  const subnetMask = adapter.ipv4_prefix ? prefixToMask(adapter.ipv4_prefix) : null;

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 2000,
      }}
    >
      {/* Dialog */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-lg)",
          width: "480px",
          maxWidth: "95vw",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
              Properties: {adapter.display_name}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              {adapter.name} · {adapter.adapter_type}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "28px", height: "28px",
              background: "transparent", border: "none",
              borderRadius: "var(--radius-sm)", cursor: "pointer",
              color: "var(--text-muted)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "4px 18px 18px", overflowY: "auto" }}>

          <Section title="General" />
          <PropRow label="Interface name" value={adapter.name} mono />
          <PropRow label="Display name" value={adapter.display_name} />
          <PropRow label="Type" value={adapter.adapter_type} />
          <PropRow label="State" value={adapter.state} />

          <Section title="Addressing" />
          <PropRow label="IPv4 Address" value={adapter.ipv4 ? `${adapter.ipv4}/${adapter.ipv4_prefix ?? ""}` : null} mono copyable />
          <PropRow label="Subnet Mask" value={subnetMask} mono />
          <PropRow label="Default Gateway" value={adapter.gateway} mono copyable />
          <PropRow label="IPv6 Address" value={adapter.ipv6} mono copyable />

          <Section title="DNS" />
          {adapter.dns.length === 0 ? (
            <PropRow label="DNS Servers" value={null} />
          ) : (
            adapter.dns.map((server, i) => (
              <PropRow
                key={server}
                label={i === 0 ? "Preferred DNS" : `Alternate DNS ${i}`}
                value={server}
                mono
                copyable
              />
            ))
          )}

          <Section title="Hardware" />
          <PropRow label="MAC Address" value={adapter.mac} mono copyable />
          <PropRow label="MTU" value={adapter.mtu ? `${adapter.mtu} bytes` : null} />
          <PropRow label="Speed" value={adapter.speed ? `${adapter.speed} Mbps` : null} />
          <PropRow label="Driver" value={adapter.driver} mono />

          <Section title="Traffic" />
          <PropRow label="Bytes received" value={formatBytes(adapter.bytes_rx)} />
          <PropRow label="Bytes sent" value={formatBytes(adapter.bytes_tx)} />
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ padding: "6px 20px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

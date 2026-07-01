import CopyButton from "../../shared/CopyButton";
import type { NetworkAdapter } from "../../../types/network";

interface GeneralTabProps {
  adapter: NetworkAdapter;
}

function InfoCard({ label, value }: { label: string; value: string | null }) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "10px 14px",
      }}
    >
      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-primary)", fontWeight: 500 }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string | null;
  mono?: boolean;
  copyable?: boolean;
}

function DetailRow({ label, value, mono, copyable }: DetailRowProps) {
  return (
    <tr>
      <td
        style={{
          padding: "5px 0",
          fontSize: "12px",
          color: "var(--text-muted)",
          width: "140px",
          verticalAlign: "top",
          paddingRight: "16px",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </td>
      <td style={{ padding: "5px 0", fontSize: "12px", color: "var(--text-primary)", fontFamily: mono ? "var(--font-mono)" : undefined, verticalAlign: "top" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span>{value ?? "—"}</span>
          {copyable && value && <CopyButton text={value} />}
        </div>
      </td>
    </tr>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatUptime(isoString: string): string {
  const since = new Date(isoString);
  const now = new Date();
  const diff = Math.floor((now.getTime() - since.getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return `${h}h ${m}m`;
}

function prefixToMask(prefix: number): string {
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return [(mask >>> 24) & 0xff, (mask >>> 16) & 0xff, (mask >>> 8) & 0xff, mask & 0xff].join(".");
}

export default function GeneralTab({ adapter }: GeneralTabProps) {
  const subnetMask = adapter.ipv4_prefix ? prefixToMask(adapter.ipv4_prefix) : null;

  return (
    <div style={{ padding: "20px", overflowY: "auto", height: "100%" }}>
      {/* Quick info cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
        <InfoCard label="IPv4 Address" value={adapter.ipv4} />
        <InfoCard label="Default Gateway" value={adapter.gateway} />
        <InfoCard
          label="Subnet Mask"
          value={subnetMask ? `${subnetMask} (/${adapter.ipv4_prefix})` : null}
        />
        <InfoCard
          label="DNS Servers"
          value={adapter.dns.length ? adapter.dns.join(", ") : null}
        />
      </div>

      {/* Details table */}
      <div
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "14px 16px",
        }}
      >
        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
          Adapter Details
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <DetailRow label="MAC Address" value={adapter.mac} mono copyable />
            <DetailRow label="MTU" value={String(adapter.mtu)} />
            <DetailRow label="Driver" value={adapter.driver} />
            <DetailRow label="DHCP" value={adapter.gateway ? "Enabled" : "Disabled / Static"} />
            <DetailRow
              label="Connected since"
              value={
                adapter.connected_since
                  ? `${new Date(adapter.connected_since).toLocaleTimeString()} (${formatUptime(adapter.connected_since)} ago)`
                  : null
              }
            />
            <DetailRow label="IPv6 Address" value={adapter.ipv6} mono copyable />
            <DetailRow label="Bytes received" value={formatBytes(adapter.bytes_rx)} />
            <DetailRow label="Bytes sent" value={formatBytes(adapter.bytes_tx)} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

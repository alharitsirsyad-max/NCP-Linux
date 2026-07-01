import type { NetworkAdapter } from "../../../types/network";

interface StatisticsTabProps {
  adapter: NetworkAdapter;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1024)          return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function InfoCard({ label, value, sub }: { label: string; value: string | null; sub?: string }) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", color: "var(--text-primary)", fontWeight: 600 }}>
        {value ?? "—"}
      </div>
      {sub && (
        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>{sub}</div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <tr>
      <td style={{ padding: "5px 0", fontSize: "12px", color: "var(--text-muted)", width: "140px", verticalAlign: "top", paddingRight: "16px", whiteSpace: "nowrap" }}>
        {label}
      </td>
      <td style={{ padding: "5px 0", fontSize: "12px", color: "var(--text-primary)", fontFamily: mono ? "var(--font-mono)" : undefined, verticalAlign: "top" }}>
        {value ?? "—"}
      </td>
    </tr>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
      {children}
    </div>
  );
}

function formatConnectedSince(isoString: string): string {
  const since = new Date(isoString);
  const now = new Date();
  const diff = Math.floor((now.getTime() - since.getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return `${since.toLocaleTimeString()} (${h}h ${m}m ago)`;
}

export default function StatisticsTab({ adapter }: StatisticsTabProps) {
  return (
    <div style={{ padding: "20px", overflowY: "auto", height: "100%" }}>
      {/* Traffic cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
        <InfoCard
          label="Bytes Received"
          value={formatBytes(adapter.bytes_rx)}
          sub={`${adapter.bytes_rx.toLocaleString()} bytes`}
        />
        <InfoCard
          label="Bytes Sent"
          value={formatBytes(adapter.bytes_tx)}
          sub={`${adapter.bytes_tx.toLocaleString()} bytes`}
        />
      </div>

      {/* Interface details */}
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
        <SectionHeader>Interface Details</SectionHeader>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <DetailRow label="MTU" value={`${adapter.mtu} bytes`} />
            <DetailRow
              label="Link Speed"
              value={adapter.speed ? `${adapter.speed} Mbps` : "Unknown"}
            />
            <DetailRow label="Duplex" value="Unknown" />
            <DetailRow label="Driver" value={adapter.driver} />
            <DetailRow
              label="Connected since"
              value={adapter.connected_since ? formatConnectedSince(adapter.connected_since) : null}
            />
            <DetailRow label="State" value={adapter.state} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

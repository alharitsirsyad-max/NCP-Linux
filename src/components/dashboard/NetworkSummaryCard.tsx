import { Globe } from "lucide-react";
import DashboardCard from "./DashboardCard";
import { useAdapters } from "../../hooks/useAdapters";
import { mockAdapters } from "../../mock/adapters";

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px", padding: "3px 0" }}>
      <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: "12px", color: value ? "var(--text-primary)" : "var(--text-muted)", fontFamily: "var(--font-mono)", textAlign: "right" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export default function NetworkSummaryCard() {
  const { data } = useAdapters();
  const adapters = data ?? mockAdapters;

  // Primary adapter = first connected non-loopback
  const primary = adapters.find(
    (a) => a.state === "connected" && a.adapter_type !== "loopback"
  );

  const connectedCount = adapters.filter((a) => a.state === "connected").length;

  return (
    <DashboardCard title="Network Summary" icon={<Globe size={13} />}>
      <InfoRow label="Active interfaces" value={`${connectedCount} / ${adapters.length}`} />
      <InfoRow label="Primary interface" value={primary?.name ?? null} />
      <InfoRow label="Local IP" value={primary?.ipv4 ?? null} />
      <InfoRow label="Gateway" value={primary?.gateway ?? null} />
      <InfoRow
        label="DNS"
        value={primary?.dns?.length ? primary.dns.slice(0, 2).join(", ") : null}
      />
    </DashboardCard>
  );
}

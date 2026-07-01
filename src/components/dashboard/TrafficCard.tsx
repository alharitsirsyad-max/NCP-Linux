import { Activity } from "lucide-react";
import DashboardCard from "./DashboardCard";
import BandwidthGraph from "./BandwidthGraph";
import { useAdapters } from "../../hooks/useAdapters";
import { mockAdapters } from "../../mock/adapters";

export default function TrafficCard() {
  const { data: adapterData } = useAdapters();
  const adapters = adapterData ?? mockAdapters;
  const primary = adapters.find((a) => a.state === "connected" && a.adapter_type !== "loopback");

  return (
    <DashboardCard title={`Traffic — ${primary?.name ?? "N/A"}`} icon={<Activity size={13} />} minHeight="140px">
      {primary ? (
        <BandwidthGraph iface={primary.name} height={72} />
      ) : (
        <div style={{ fontSize: "12px", color: "var(--text-muted)", paddingTop: "8px" }}>
          No active adapter detected.
        </div>
      )}
    </DashboardCard>
  );
}

import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Wifi, WifiOff } from "lucide-react";
import DashboardCard from "./DashboardCard";

interface InternetStatus {
  online: boolean;
  latency_ms: number | null;
}

interface SystemInfo {
  nm_status: string;
}

export default function InternetStatusCard() {
  const { data: internet } = useQuery<InternetStatus>({
    queryKey: ["internetStatus"],
    queryFn: () => invoke<InternetStatus>("check_internet"),
    refetchInterval: 30000,
  });

  const { data: sysInfo } = useQuery<SystemInfo>({
    queryKey: ["systemInfo"],
    queryFn: () => invoke<SystemInfo>("get_system_info"),
    refetchInterval: 30000,
  });

  const online = internet?.online ?? null;
  const nmActive = sysInfo?.nm_status === "active";

  return (
    <DashboardCard title="Internet & NM Status" icon={online ? <Wifi size={13} /> : <WifiOff size={13} />}>
      {/* Internet status */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: online === null ? "var(--text-muted)" : online ? "var(--color-success)" : "var(--color-error)",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: "13px", fontWeight: 500, color: online ? "var(--color-success)" : online === false ? "var(--color-error)" : "var(--text-muted)" }}>
          {online === null ? "Checking..." : online ? "Internet: Online" : "Internet: Offline"}
        </span>
        {internet?.latency_ms && (
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {internet.latency_ms.toFixed(1)} ms
          </span>
        )}
      </div>

      {/* NM status */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: nmActive ? "var(--color-success)" : "var(--color-warning)", flexShrink: 0 }} />
        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
          NetworkManager: {sysInfo?.nm_status ?? "checking..."}
        </span>
      </div>
    </DashboardCard>
  );
}

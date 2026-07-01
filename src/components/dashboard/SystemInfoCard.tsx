import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Monitor } from "lucide-react";
import DashboardCard from "./DashboardCard";

interface SystemInfo {
  hostname: string;
  username: string;
  distro: string;
  kernel: string;
  uptime_seconds: number;
  nm_status: string;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px", padding: "3px 0" }}>
      <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: "12px", color: "var(--text-primary)", fontFamily: "var(--font-mono)", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </span>
    </div>
  );
}

export default function SystemInfoCard() {
  const { data, isLoading } = useQuery<SystemInfo>({
    queryKey: ["systemInfo"],
    queryFn: () => invoke<SystemInfo>("get_system_info"),
    refetchInterval: 10000,
  });

  return (
    <DashboardCard title="System Info" icon={<Monitor size={13} />}>
      {isLoading || !data ? (
        <SkeletonRows count={4} />
      ) : (
        <>
          <InfoRow label="Hostname" value={data.hostname} />
          <InfoRow label="User" value={data.username} />
          <InfoRow label="Distro" value={data.distro} />
          <InfoRow label="Kernel" value={data.kernel} />
          <InfoRow label="Uptime" value={formatUptime(data.uptime_seconds)} />
        </>
      )}
    </DashboardCard>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ height: "16px", background: "var(--surface-3)", borderRadius: "var(--radius-sm)", marginBottom: "6px", opacity: 0.6 }} />
      ))}
    </>
  );
}

import { useState, useEffect } from "react";
import PingPanel from "../components/diagnostics/PingPanel";
import TraceroutePanel from "../components/diagnostics/TraceroutePanel";
import DnsLookupPanel from "../components/diagnostics/DnsLookupPanel";
import IpCalculatorPanel from "../components/diagnostics/IpCalculatorPanel";
import MtrPanel from "../components/diagnostics/MtrPanel";
import WhoisPanel from "../components/diagnostics/WhoisPanel";
import { useUIStore, type DiagnosticsTab } from "../stores/uiStore";

const TABS: { id: DiagnosticsTab; label: string }[] = [
  { id: "ping",       label: "Ping" },
  { id: "traceroute", label: "Traceroute" },
  { id: "mtr",        label: "MTR" },
  { id: "dns",        label: "DNS Lookup" },
  { id: "whois",      label: "Whois" },
  { id: "calculator", label: "IP Calculator" },
];

interface DiagnosticsPageProps {
  initialPingTarget?: string;
}

export default function DiagnosticsPage({ initialPingTarget }: DiagnosticsPageProps) {
  const { diagnosticsTab, pingTarget } = useUIStore();
  const [activeTab, setActiveTab] = useState<DiagnosticsTab>(diagnosticsTab);
  // Use store's pingTarget if no prop provided
  const resolvedPingTarget = initialPingTarget ?? pingTarget ?? undefined;

  useEffect(() => {
    setActiveTab(diagnosticsTab);
  }, [diagnosticsTab]);

  useEffect(() => {
    if (initialPingTarget || pingTarget) setActiveTab("ping");
  }, [initialPingTarget, pingTarget]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
          paddingLeft: "16px",
          flexShrink: 0,
        }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "8px 16px",
                fontSize: "12px",
                border: "none",
                borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                background: "transparent",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                cursor: "pointer",
                fontWeight: isActive ? 500 : 400,
                marginBottom: "-1px",
                transition: "color 0.1s",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "ping"       && <PingPanel initialTarget={resolvedPingTarget} />}
        {activeTab === "traceroute" && <TraceroutePanel />}
        {activeTab === "mtr"        && <MtrPanel />}
        {activeTab === "dns"        && <DnsLookupPanel />}
        {activeTab === "whois"      && <WhoisPanel />}
        {activeTab === "calculator" && <IpCalculatorPanel />}
      </div>
    </div>
  );
}

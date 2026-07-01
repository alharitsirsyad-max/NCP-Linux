import { useState } from "react";
import AdapterHeader from "../components/adapters/AdapterHeader";
import AdapterTabs, { type AdapterTab } from "../components/adapters/AdapterTabs";
import GeneralTab from "../components/adapters/tabs/GeneralTab";
import Ipv4Tab from "../components/adapters/tabs/Ipv4Tab";
import Ipv6Tab from "../components/adapters/tabs/Ipv6Tab";
import DnsTab from "../components/adapters/tabs/DnsTab";
import StatisticsTab from "../components/adapters/tabs/StatisticsTab";
import { useUIStore } from "../stores/uiStore";
import { useAdapters } from "../hooks/useAdapters";
import { mockAdapters } from "../mock/adapters";

export default function AdaptersPage() {
  const [activeTab, setActiveTab] = useState<AdapterTab>("general");
  const { selectedAdapter } = useUIStore();
  const { data } = useAdapters();

  const adapters = data ?? mockAdapters;
  const adapter = adapters.find((a) => a.name === selectedAdapter);

  if (!selectedAdapter || !adapter) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: "13px",
        }}
      >
        Select an adapter from the sidebar.
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      <AdapterHeader adapter={adapter} />
      <AdapterTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {activeTab === "general"    && <GeneralTab adapter={adapter} />}
        {activeTab === "ipv4"       && <Ipv4Tab adapter={adapter} />}
        {activeTab === "ipv6"       && <Ipv6Tab adapter={adapter} />}
        {activeTab === "dns"        && <DnsTab adapter={adapter} />}
        {activeTab === "statistics" && <StatisticsTab adapter={adapter} />}
      </div>
    </div>
  );
}

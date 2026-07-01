import { useState } from "react";

export type AdapterTab = "general" | "ipv4" | "ipv6" | "dns" | "statistics";

const TABS: { id: AdapterTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "ipv4", label: "IPv4" },
  { id: "ipv6", label: "IPv6" },
  { id: "dns", label: "DNS" },
  { id: "statistics", label: "Statistics" },
];

interface AdapterTabsProps {
  activeTab: AdapterTab;
  onTabChange: (tab: AdapterTab) => void;
}

export default function AdapterTabs({ activeTab, onTabChange }: AdapterTabsProps) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "flex-end",
        paddingLeft: "20px",
        flexShrink: 0,
        gap: "2px",
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <Tab
            key={tab.id}
            label={tab.label}
            active={isActive}
            onClick={() => onTabChange(tab.id)}
          />
        );
      })}
    </div>
  );
}

interface TabProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function Tab({ label, active, onClick }: TabProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "7px 14px",
        fontSize: "12px",
        border: "none",
        borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
        background:
          active
            ? "transparent"
            : hovered
            ? "var(--surface-3)"
            : "transparent",
        color: active ? "var(--accent)" : "var(--text-secondary)",
        cursor: "pointer",
        fontWeight: active ? 500 : 400,
        transition: "color 0.1s, background 0.1s",
        marginBottom: "-1px",
      }}
    >
      {label}
    </button>
  );
}

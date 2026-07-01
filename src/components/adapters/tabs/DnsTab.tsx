import { useState } from "react";
import { Search, Edit2, Save, X } from "lucide-react";
import CopyButton from "../../shared/CopyButton";
import { useUIStore } from "../../../stores/uiStore";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "../../../stores/toastStore";
import type { NetworkAdapter } from "../../../types/network";

interface DnsTabProps {
  adapter: NetworkAdapter;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
      {children}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "5px 8px",
  background: "var(--surface-1)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  fontSize: "12px",
  fontFamily: "var(--font-mono)",
  outline: "none",
  boxSizing: "border-box",
};

export default function DnsTab({ adapter }: DnsTabProps) {
  const { openDiagnostics } = useUIStore();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dnsServers, setDnsServers] = useState<string[]>(
    adapter.dns.length > 0 ? [...adapter.dns] : ["", ""]
  );

  const handleSave = async () => {
    const filtered = dnsServers.filter((d) => d.trim().length > 0);
    if (filtered.length === 0) {
      toast.warn("Please enter at least one DNS server.");
      return;
    }
    setSaving(true);
    try {
      await invoke("apply_dns_config", { iface: adapter.name, dns: filtered });
      await queryClient.invalidateQueries({ queryKey: ["adapters"] });
      toast.success("DNS configuration applied.");
      setEditing(false);
    } catch (e) {
      toast.error(`Failed to apply DNS: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDnsServers(adapter.dns.length > 0 ? [...adapter.dns] : ["", ""]);
    setEditing(false);
  };

  return (
    <div style={{ padding: "20px", overflowY: "auto", height: "100%" }}>
      {/* DNS servers */}
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "14px 16px", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <SectionHeader>DNS Servers</SectionHeader>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "3px 10px", background: "transparent", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", fontSize: "11px", color: "var(--accent)", cursor: "pointer" }}
            >
              <Edit2 size={11} /> Edit
            </button>
          ) : (
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "var(--accent)", border: "none", borderRadius: "var(--radius-sm)", fontSize: "11px", color: "white", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                <Save size={11} /> {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleCancel}
                style={{ display: "flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "transparent", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", fontSize: "11px", color: "var(--text-secondary)", cursor: "pointer" }}
              >
                <X size={11} /> Cancel
              </button>
            </div>
          )}
        </div>

        {!editing ? (
          adapter.dns.length === 0 ? (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "4px 0" }}>
              No DNS servers configured.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {adapter.dns.map((server, i) => (
                <div
                  key={server}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--surface-3)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "var(--radius-sm)", background: i === 0 ? "rgba(0,103,184,0.08)" : "var(--surface-3)", color: i === 0 ? "var(--accent)" : "var(--text-muted)" }}>
                      {i === 0 ? "Preferred" : `Alternate ${i}`}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-primary)" }}>{server}</span>
                  </div>
                  <CopyButton text={server} />
                </div>
              ))}
            </div>
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {dnsServers.map((server, i) => (
              <div key={i}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "3px" }}>
                  {i === 0 ? "Preferred DNS" : `Alternate DNS ${i}`}
                </div>
                <input
                  value={server}
                  onChange={(e) => {
                    const updated = [...dnsServers];
                    updated[i] = e.target.value;
                    setDnsServers(updated);
                  }}
                  style={fieldStyle}
                  placeholder={i === 0 ? "e.g. 8.8.8.8" : "e.g. 8.8.4.4"}
                />
              </div>
            ))}
            {dnsServers.length < 4 && (
              <button
                onClick={() => setDnsServers([...dnsServers, ""])}
                style={{ alignSelf: "flex-start", fontSize: "11px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
              >
                + Add another DNS server
              </button>
            )}
            <div style={{ fontSize: "11px", color: "var(--text-muted)", paddingTop: "6px", borderTop: "1px solid var(--border)" }}>
              Changes applied via NetworkManager.
            </div>
          </div>
        )}
      </div>

      {/* Search Domains */}
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "14px 16px", marginBottom: "16px" }}>
        <SectionHeader>Search Domains</SectionHeader>
        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>None configured.</div>
      </div>

      {/* Open DNS Lookup */}
      <button
        onClick={() => openDiagnostics("dns")}
        style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)", color: "var(--accent)", fontSize: "12px", cursor: "pointer", fontWeight: 500 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)"; }}
      >
        <Search size={14} />
        Open DNS Lookup
      </button>
    </div>
  );
}

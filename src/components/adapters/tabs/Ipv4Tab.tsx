import { useState, useEffect } from "react";
import { Edit2, Save, X, RefreshCw } from "lucide-react";
import CopyButton from "../../shared/CopyButton";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "../../../stores/toastStore";
import type { NetworkAdapter } from "../../../types/network";

interface Ipv4TabProps {
  adapter: NetworkAdapter;
}

interface Ipv4Config {
  method: "auto" | "manual";
  address: string | null;
  prefix: number | null;
  gateway: string | null;
  dns: string[];
}

function prefixToMask(prefix: number): string {
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return [(mask >>> 24) & 0xff, (mask >>> 16) & 0xff, (mask >>> 8) & 0xff, mask & 0xff].join(".");
}

function InfoCard({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-primary)", fontWeight: 500 }}>{value ?? "—"}</div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
      {children}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  padding: "5px 8px",
  background: "var(--surface-1)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  fontSize: "12px",
  fontFamily: "var(--font-mono)",
  outline: "none",
  boxSizing: "border-box",
  width: "100%",
};

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
      <div style={{ fontSize: "11px", color: "var(--text-muted)", width: "120px", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

export default function Ipv4Tab({ adapter }: Ipv4TabProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // NM config (fetched from backend)
  const [nmConfig, setNmConfig] = useState<Ipv4Config | null>(null);
  const [nmError, setNmError] = useState<string | null>(null);

  // Edit form state
  const [editMethod, setEditMethod] = useState<"auto" | "manual">("auto");
  const [editAddress, setEditAddress] = useState("");
  const [editPrefix, setEditPrefix] = useState("24");
  const [editGateway, setEditGateway] = useState("");
  const [editDns1, setEditDns1] = useState("");
  const [editDns2, setEditDns2] = useState("");

  const fetchConfig = async () => {
    setLoadingConfig(true);
    setNmError(null);
    try {
      const config = await invoke<Ipv4Config>("get_ipv4_config", { iface: adapter.name });
      setNmConfig(config);
    } catch (e) {
      setNmError(String(e));
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [adapter.name]);

  const startEdit = () => {
    // Pre-fill form from nmConfig or adapter data
    const m = nmConfig?.method ?? (adapter.gateway ? "auto" : "manual");
    setEditMethod(m as "auto" | "manual");
    setEditAddress(nmConfig?.address ?? adapter.ipv4 ?? "");
    setEditPrefix(String(nmConfig?.prefix ?? adapter.ipv4_prefix ?? 24));
    setEditGateway(nmConfig?.gateway ?? adapter.gateway ?? "");
    setEditDns1(nmConfig?.dns[0] ?? adapter.dns[0] ?? "");
    setEditDns2(nmConfig?.dns[1] ?? adapter.dns[1] ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const config: Ipv4Config = {
        method: editMethod,
        address: editMethod === "manual" ? editAddress || null : null,
        prefix: editMethod === "manual" ? Number(editPrefix) || 24 : null,
        gateway: editMethod === "manual" ? editGateway || null : null,
        dns: editMethod === "manual"
          ? [editDns1, editDns2].filter((d) => d.trim().length > 0)
          : [],
      };

      await invoke("apply_ipv4_config", { iface: adapter.name, config });
      await queryClient.invalidateQueries({ queryKey: ["adapters"] });
      toast.success(`IPv4 configuration applied to ${adapter.name}.`);
      setEditing(false);
      // Reload NM config
      setTimeout(fetchConfig, 1500);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => setEditing(false);

  const isManaged = !nmError;
  const isStatic = nmConfig?.method === "manual";
  const canEdit = isManaged && !loadingConfig;

  const subnetMask = adapter.ipv4_prefix ? prefixToMask(adapter.ipv4_prefix) : null;

  return (
    <div style={{ padding: "20px", overflowY: "auto", height: "100%" }}>

      {/* Status bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {loadingConfig ? (
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Loading NM config...</span>
          ) : nmError ? (
            <span
              style={{ fontSize: "11px", color: "var(--color-warning)", display: "flex", alignItems: "center", gap: "4px" }}
              title={nmError}
            >
              ⚠ Not managed by NetworkManager — read-only
            </span>
          ) : (
            <span
              style={{
                display: "inline-block", padding: "2px 10px", borderRadius: "var(--radius-sm)",
                fontSize: "11px", fontWeight: 500,
                background: isStatic ? "rgba(157,93,0,0.08)" : "rgba(0,103,184,0.08)",
                color: isStatic ? "var(--color-warning)" : "var(--accent)",
                border: `1px solid ${isStatic ? "rgba(157,93,0,0.2)" : "rgba(0,103,184,0.2)"}`,
              }}
            >
              {isStatic ? "Static / Manual" : "Automatic (DHCP)"}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          {!editing ? (
            <>
              <button
                onClick={fetchConfig}
                disabled={loadingConfig}
                title="Refresh from NetworkManager"
                style={{ display: "flex", alignItems: "center", padding: "4px 6px", background: "transparent", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <RefreshCw size={11} style={{ animation: loadingConfig ? "spin 1s linear infinite" : "none" }} />
              </button>
              <button
                onClick={startEdit}
                disabled={!canEdit}
                title={!canEdit ? (nmError ?? "Loading...") : "Edit IPv4 Configuration"}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "4px 12px",
                  background: canEdit ? "transparent" : "var(--surface-3)",
                  border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)",
                  fontSize: "11px", fontWeight: 500,
                  color: canEdit ? "var(--accent)" : "var(--text-muted)",
                  cursor: canEdit ? "pointer" : "not-allowed",
                  opacity: canEdit ? 1 : 0.6,
                }}
              >
                <Edit2 size={12} /> Edit
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 12px", background: "var(--accent)", border: "none", borderRadius: "var(--radius-sm)", fontSize: "11px", fontWeight: 500, color: "white", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                <Save size={12} /> {saving ? "Applying..." : "Apply"}
              </button>
              <button
                onClick={handleCancel}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 12px", background: "transparent", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", fontSize: "11px", color: "var(--text-secondary)", cursor: "pointer" }}
              >
                <X size={12} /> Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* View mode */}
      {!editing && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            <InfoCard label="IPv4 Address" value={adapter.ipv4} />
            <InfoCard label="Subnet Mask" value={subnetMask} />
            <InfoCard label="Prefix Length" value={adapter.ipv4_prefix ? `/${adapter.ipv4_prefix}` : null} />
            <InfoCard label="Default Gateway" value={adapter.gateway} />
          </div>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
            <SectionHeader>DNS Servers</SectionHeader>
            {adapter.dns.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>No DNS servers configured.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {adapter.dns.map((server, i) => (
                  <div key={server} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "var(--surface-3)", borderRadius: "var(--radius-sm)" }}>
                    <div>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", marginRight: "8px" }}>
                        {i === 0 ? "Preferred" : `Alternate ${i}`}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-primary)" }}>{server}</span>
                    </div>
                    <CopyButton text={server} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Edit mode */}
      {editing && (
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "16px" }}>
          <SectionHeader>Edit IPv4 Configuration</SectionHeader>

          {/* DHCP / Static toggle */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            {(["auto", "manual"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setEditMethod(m)}
                style={{
                  padding: "5px 14px", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: 500,
                  cursor: "pointer", border: "1px solid var(--border-strong)",
                  background: editMethod === m ? "var(--accent)" : "var(--surface-3)",
                  color: editMethod === m ? "white" : "var(--text-secondary)",
                }}
              >
                {m === "auto" ? "DHCP (Automatic)" : "Static (Manual)"}
              </button>
            ))}
          </div>

          {editMethod === "auto" ? (
            <div style={{ padding: "12px", background: "var(--surface-3)", borderRadius: "var(--radius-sm)", fontSize: "12px", color: "var(--text-secondary)" }}>
              Address, gateway and DNS will be obtained automatically from the DHCP server.
              <br />
              <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>Click Apply to switch to DHCP mode.</span>
            </div>
          ) : (
            <div>
              <FormRow label="IP Address">
                <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} style={fieldStyle} placeholder="e.g. 192.168.1.100" />
              </FormRow>
              <FormRow label="Prefix / Mask">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    value={editPrefix}
                    onChange={(e) => setEditPrefix(e.target.value)}
                    style={{ ...fieldStyle, width: "60px" }}
                    placeholder="24"
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {editPrefix && !isNaN(Number(editPrefix)) ? `= ${prefixToMask(Number(editPrefix))}` : ""}
                  </span>
                </div>
              </FormRow>
              <FormRow label="Gateway">
                <input value={editGateway} onChange={(e) => setEditGateway(e.target.value)} style={fieldStyle} placeholder="e.g. 192.168.1.1" />
              </FormRow>
              <div style={{ height: "1px", background: "var(--border)", margin: "8px 0" }} />
              <FormRow label="Preferred DNS">
                <input value={editDns1} onChange={(e) => setEditDns1(e.target.value)} style={fieldStyle} placeholder="e.g. 8.8.8.8" />
              </FormRow>
              <FormRow label="Alternate DNS">
                <input value={editDns2} onChange={(e) => setEditDns2(e.target.value)} style={fieldStyle} placeholder="e.g. 8.8.4.4" />
              </FormRow>
            </div>
          )}

          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "12px", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
            Uses: <code style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}>nmcli connection modify &lt;conn&gt; ipv4.method {editMethod} ...</code>
          </div>
        </div>
      )}
    </div>
  );
}

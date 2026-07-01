import { useState, useEffect } from "react";
import { Edit2, Save, X, RefreshCw } from "lucide-react";
import CopyButton from "../../shared/CopyButton";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "../../../stores/toastStore";
import type { NetworkAdapter } from "../../../types/network";

interface Ipv6TabProps {
  adapter: NetworkAdapter;
}

interface Ipv6Config {
  method: string;
  address: string | null;
  prefix: number | null;
  gateway: string | null;
  dns: string[];
}

type Ipv6Method = "auto" | "manual" | "disabled";

function isLinkLocal(addr: string) {
  return addr.toLowerCase().startsWith("fe80");
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

export default function Ipv6Tab({ adapter }: Ipv6TabProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [nmConfig, setNmConfig] = useState<Ipv6Config | null>(null);
  const [nmError, setNmError] = useState<string | null>(null);

  const [editMethod, setEditMethod] = useState<Ipv6Method>("auto");
  const [editAddress, setEditAddress] = useState("");
  const [editPrefix, setEditPrefix] = useState("64");
  const [editGateway, setEditGateway] = useState("");
  const [editDns, setEditDns] = useState("");

  const fetchConfig = async () => {
    setLoadingConfig(true);
    setNmError(null);
    try {
      const config = await invoke<Ipv6Config>("get_ipv6_config", { iface: adapter.name });
      setNmConfig(config);
    } catch (e) {
      setNmError(String(e));
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => { fetchConfig(); }, [adapter.name]);

  const startEdit = () => {
    const m = (nmConfig?.method ?? "auto") as Ipv6Method;
    setEditMethod(["auto", "manual", "disabled"].includes(m) ? m : "auto");
    setEditAddress(nmConfig?.address ?? adapter.ipv6 ?? "");
    setEditPrefix(String(nmConfig?.prefix ?? 64));
    setEditGateway(nmConfig?.gateway ?? "");
    setEditDns(nmConfig?.dns.join(", ") ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const config: Ipv6Config = {
        method: editMethod,
        address: editMethod === "manual" ? editAddress || null : null,
        prefix: editMethod === "manual" ? Number(editPrefix) || 64 : null,
        gateway: editMethod === "manual" ? editGateway || null : null,
        dns: editMethod === "manual"
          ? editDns.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      };
      await invoke("apply_ipv6_config", { iface: adapter.name, config });
      await queryClient.invalidateQueries({ queryKey: ["adapters"] });
      toast.success(`IPv6 configuration applied to ${adapter.name}.`);
      setEditing(false);
      setTimeout(fetchConfig, 1500);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const scope = adapter.ipv6 ? (isLinkLocal(adapter.ipv6) ? "Link-local" : "Global") : null;
  const canEdit = !nmError && !loadingConfig;
  const currentMethod = nmConfig?.method ?? "auto";

  return (
    <div style={{ padding: "20px", overflowY: "auto", height: "100%" }}>
      {/* Status bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div>
          {loadingConfig ? (
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Loading...</span>
          ) : nmError ? (
            <span style={{ fontSize: "11px", color: "var(--color-warning)" }}>⚠ Not managed by NM — read-only</span>
          ) : (
            <span style={{
              display: "inline-block", padding: "2px 10px", borderRadius: "var(--radius-sm)",
              fontSize: "11px", fontWeight: 500,
              background: currentMethod === "manual" ? "rgba(157,93,0,0.08)" : currentMethod === "disabled" ? "var(--surface-3)" : "rgba(0,103,184,0.08)",
              color: currentMethod === "manual" ? "var(--color-warning)" : currentMethod === "disabled" ? "var(--text-muted)" : "var(--accent)",
              border: "1px solid var(--border)",
            }}>
              {currentMethod === "auto" ? "Auto (SLAAC/DHCPv6)" : currentMethod === "manual" ? "Static" : "Disabled"}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {!editing ? (
            <>
              <button onClick={fetchConfig} disabled={loadingConfig} style={{ display: "flex", alignItems: "center", padding: "4px 6px", background: "transparent", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-muted)" }}>
                <RefreshCw size={11} style={{ animation: loadingConfig ? "spin 1s linear infinite" : "none" }} />
              </button>
              <button
                onClick={startEdit}
                disabled={!canEdit}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 12px", background: canEdit ? "transparent" : "var(--surface-3)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", fontSize: "11px", fontWeight: 500, color: canEdit ? "var(--accent)" : "var(--text-muted)", cursor: canEdit ? "pointer" : "not-allowed", opacity: canEdit ? 1 : 0.6 }}
              >
                <Edit2 size={12} /> Edit
              </button>
            </>
          ) : (
            <>
              <button onClick={handleSave} disabled={saving} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 12px", background: "var(--accent)", border: "none", borderRadius: "var(--radius-sm)", fontSize: "11px", fontWeight: 500, color: "white", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                <Save size={12} /> {saving ? "Applying..." : "Apply"}
              </button>
              <button onClick={() => setEditing(false)} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 12px", background: "transparent", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", fontSize: "11px", color: "var(--text-secondary)", cursor: "pointer" }}>
                <X size={12} /> Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* View mode */}
      {!editing && (
        <>
          {!adapter.ipv6 ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
              No IPv6 address assigned.
            </div>
          ) : (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "10px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", marginBottom: "8px" }}>
                <div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{scope} Address</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-primary)", wordBreak: "break-all" }}>{adapter.ipv6}</div>
                </div>
                <CopyButton text={adapter.ipv6} />
              </div>
            </div>
          )}
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
            <SectionHeader>IPv6 Details</SectionHeader>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["Scope", scope],
                  ["Method", currentMethod === "auto" ? "Auto (SLAAC / DHCPv6)" : currentMethod === "manual" ? "Static" : "Disabled"],
                  ["NM DNS", nmConfig?.dns.join(", ") || null],
                ].map(([label, value]) => (
                  <tr key={String(label)}>
                    <td style={{ padding: "5px 0", fontSize: "12px", color: "var(--text-muted)", width: "140px", paddingRight: "16px" }}>{label}</td>
                    <td style={{ padding: "5px 0", fontSize: "12px", color: "var(--text-primary)" }}>{value ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Edit mode */}
      {editing && (
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "16px" }}>
          <SectionHeader>Edit IPv6 Configuration</SectionHeader>
          <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
            {(["auto", "manual", "disabled"] as Ipv6Method[]).map((m) => (
              <button key={m} onClick={() => setEditMethod(m)}
                style={{ padding: "4px 12px", borderRadius: "var(--radius-sm)", fontSize: "11px", fontWeight: 500, cursor: "pointer", border: "1px solid var(--border-strong)", background: editMethod === m ? "var(--accent)" : "var(--surface-3)", color: editMethod === m ? "white" : "var(--text-secondary)" }}>
                {m === "auto" ? "Auto" : m === "manual" ? "Static" : "Disabled"}
              </button>
            ))}
          </div>
          {editMethod === "auto" && (
            <div style={{ padding: "10px", background: "var(--surface-3)", borderRadius: "var(--radius-sm)", fontSize: "12px", color: "var(--text-secondary)" }}>
              IPv6 address obtained automatically (SLAAC / DHCPv6).
            </div>
          )}
          {editMethod === "disabled" && (
            <div style={{ padding: "10px", background: "var(--surface-3)", borderRadius: "var(--radius-sm)", fontSize: "12px", color: "var(--text-secondary)" }}>
              IPv6 will be disabled on this connection.
            </div>
          )}
          {editMethod === "manual" && (
            <>
              <FormRow label="IPv6 Address">
                <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} style={fieldStyle} placeholder="e.g. 2001:db8::1" />
              </FormRow>
              <FormRow label="Prefix Length">
                <input value={editPrefix} onChange={(e) => setEditPrefix(e.target.value)} style={{ ...fieldStyle, width: "70px" }} placeholder="64" />
              </FormRow>
              <FormRow label="Gateway">
                <input value={editGateway} onChange={(e) => setEditGateway(e.target.value)} style={fieldStyle} placeholder="e.g. fe80::1" />
              </FormRow>
              <FormRow label="DNS (comma-sep)">
                <input value={editDns} onChange={(e) => setEditDns(e.target.value)} style={fieldStyle} placeholder="e.g. 2606:4700:4700::1111" />
              </FormRow>
            </>
          )}
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "10px", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
            Uses: <code style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}>nmcli connection modify &lt;conn&gt; ipv6.method {editMethod} ...</code>
          </div>
        </div>
      )}
    </div>
  );
}

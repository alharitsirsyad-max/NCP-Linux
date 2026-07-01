import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Terminal, Plus, Trash2, X } from "lucide-react";
import { useSshStore, type SshHost } from "../stores/sshStore";
import { toast } from "../stores/toastStore";

const inputStyle: React.CSSProperties = {
  padding: "5px 8px",
  background: "var(--surface-0)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  fontSize: "12px",
  fontFamily: "var(--font-mono)",
  outline: "none",
};

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function doSsh(user: string, host: string, port: number, addRecent: (e: { user: string; host: string; port: number }) => void) {
  if (!user.trim() || !host.trim()) {
    toast.warn("Username and host are required.");
    return;
  }
  try {
    await invoke("ssh_connect", { user: user.trim(), host: host.trim(), port });
    addRecent({ user: user.trim(), host: host.trim(), port });
    toast.success(`Opening SSH: ${user.trim()}@${host.trim()}`);
  } catch (e) {
    toast.error(String(e));
  }
}

interface AddHostDialogProps {
  onAdd: (host: Omit<SshHost, "id">) => void;
  onClose: () => void;
}

function AddHostDialog({ onAdd, onClose }: AddHostDialogProps) {
  const [name, setName] = useState("");
  const [user, setUser] = useState("admin");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");

  const handleSave = () => {
    if (!host.trim()) { toast.warn("Host is required."); return; }
    onAdd({ name: name || host, user: user || "root", host: host.trim(), port: Number(port) || 22 });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--surface-1)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", width: "360px", boxShadow: "rgba(0,0,0,0.13) 0 3px 7px" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
          <span style={{ fontSize: "13px", fontWeight: 600 }}>Add SSH Host</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={14} /></button>
        </div>

        {/* Form */}
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            { label: "Display Name", value: name, onChange: setName, placeholder: "e.g. Router Lab 1", mono: false },
            { label: "Username",     value: user, onChange: setUser, placeholder: "admin", mono: true },
            { label: "Host / IP",    value: host, onChange: setHost, placeholder: "192.168.1.1", mono: true },
            { label: "Port",         value: port, onChange: setPort, placeholder: "22", mono: true },
          ].map(({ label, value, onChange, placeholder, mono }) => (
            <div key={label}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "3px" }}>{label}</div>
              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                style={{ ...inputStyle, width: "100%", fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)" }}
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} style={{ padding: "5px 14px", background: "transparent", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", fontSize: "12px", cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: "5px 14px", background: "var(--accent)", border: "none", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: 500, cursor: "pointer", color: "white" }}>Save Host</button>
        </div>
      </div>
    </div>
  );
}

export default function SSHPage() {
  const { saved, recent, addSaved, removeSaved, addRecent, clearRecent } = useSshStore();
  const [quickUser, setQuickUser] = useState("admin");
  const [quickHost, setQuickHost] = useState("");
  const [quickPort, setQuickPort] = useState("22");
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
      <div style={{ maxWidth: "680px" }}>

        {/* Page title */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>SSH Quick Connect</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Open an SSH connection in your terminal emulator.</div>
        </div>

        {/* Quick Connect */}
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "16px", marginBottom: "20px", boxShadow: "rgba(0,0,0,0.06) 0 1px 3px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "10px" }}>Quick Connect</div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>User</span>
              <input value={quickUser} onChange={(e) => setQuickUser(e.target.value)} style={{ ...inputStyle, width: "100px" }} placeholder="admin" />
            </div>
            <div style={{ fontSize: "16px", color: "var(--text-muted)", alignSelf: "flex-end", paddingBottom: "6px" }}>@</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: "160px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Host / IP</span>
              <input
                value={quickHost}
                onChange={(e) => setQuickHost(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSsh(quickUser, quickHost, Number(quickPort), addRecent)}
                style={{ ...inputStyle, width: "100%" }}
                placeholder="192.168.1.1"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Port</span>
              <input value={quickPort} onChange={(e) => setQuickPort(e.target.value)} style={{ ...inputStyle, width: "60px" }} placeholder="22" />
            </div>
            <button
              onClick={() => doSsh(quickUser, quickHost, Number(quickPort), addRecent)}
              style={{ alignSelf: "flex-end", display: "flex", alignItems: "center", gap: "6px", padding: "5px 14px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}
            >
              <Terminal size={13} /> Connect
            </button>
          </div>
        </div>

        {/* Saved Hosts */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>Saved Hosts</span>
            <button
              onClick={() => setShowAdd(true)}
              style={{ display: "flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "transparent", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", fontSize: "11px", color: "var(--accent)", cursor: "pointer" }}
            >
              <Plus size={11} /> Add Host
            </button>
          </div>

          {saved.length === 0 ? (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
              No saved hosts. Click "Add Host" to save a connection.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {saved.map((h) => (
                <div
                  key={h.id}
                  style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
                >
                  <Terminal size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>{h.name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      {h.user}@{h.host}:{h.port}
                    </div>
                  </div>
                  <button
                    onClick={() => doSsh(h.user, h.host, h.port, addRecent)}
                    style={{ display: "flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--radius-sm)", fontSize: "11px", cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    <Terminal size={11} /> SSH
                  </button>
                  <button
                    onClick={() => removeSaved(h.id)}
                    title="Remove"
                    style={{ padding: "3px 6px", background: "transparent", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-muted)" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent */}
        {recent.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>Recent</span>
              <button
                onClick={clearRecent}
                style={{ fontSize: "11px", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
              >
                Clear
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {recent.map((r, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 12px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)", flex: 1 }}>
                    {r.user}@{r.host}:{r.port}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{relativeTime(r.connectedAt)}</span>
                  <button
                    onClick={() => doSsh(r.user, r.host, r.port, addRecent)}
                    style={{ display: "flex", alignItems: "center", gap: "4px", padding: "2px 8px", background: "transparent", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", fontSize: "11px", color: "var(--accent)", cursor: "pointer" }}
                  >
                    <Terminal size={11} /> SSH
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <AddHostDialog
          onAdd={addSaved}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

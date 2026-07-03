import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Shield, Plus, Trash2, RefreshCw, AlertTriangle, Power } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FirewallBackend = "ufw" | "nftables" | "iptables" | "none";

interface UfwStatus {
  active: boolean;
  default_incoming: string;
  default_outgoing: string;
  logging: string;
}

interface UfwRule {
  number: number;
  to: string;
  action: string;
  from: string;
  protocol: string | null;
  comment: string | null;
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 24,
          width: 360,
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <AlertTriangle size={18} color={danger ? "#dc3545" : "var(--color-warning)"} />
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
          {message}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              padding: "6px 14px",
              fontSize: 12,
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              background: danger ? "#dc3545" : "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Rule Form ────────────────────────────────────────────────────────────

function AddRuleForm({
  onAdd,
  onClose,
  busy,
}: {
  onAdd: (rule: string, action: "allow" | "deny") => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [port, setPort] = useState("");
  const [proto, setProto] = useState("tcp");
  const [action, setAction] = useState<"allow" | "deny">("allow");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const p = port.trim();
    if (!p) { setError("Port is required"); return; }
    const num = parseInt(p, 10);
    if (isNaN(num) || num < 1 || num > 65535) { setError("Port must be 1–65535"); return; }
    const rule = proto === "any" ? p : `${p}/${proto}`;
    onAdd(rule, action);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 24,
          width: 340,
          boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>
          Add Firewall Rule
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Port</label>
            <input
              autoFocus
              type="number"
              min={1}
              max={65535}
              placeholder="e.g. 80"
              value={port}
              onChange={(e) => { setPort(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={inputStyle}
            />
            {error && <span style={{ fontSize: 10, color: "#dc3545" }}>{error}</span>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Protocol</label>
            <select
              value={proto}
              onChange={(e) => setProto(e.target.value)}
              style={inputStyle}
            >
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="any">Any</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Action</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["allow", "deny"] as const).map((a) => (
                <label key={a} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer" }}>
                  <input type="radio" checked={action === a} onChange={() => setAction(a)} />
                  <span style={{
                    fontWeight: 600,
                    color: a === "allow" ? "var(--color-success)" : "#dc3545",
                  }}>
                    {a.toUpperCase()}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={btnSecStyle}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            style={{
              ...btnPriStyle,
              background: action === "allow" ? "var(--color-success)" : "#dc3545",
            }}
          >
            <Plus size={12} /> Add {action.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FirewallPage() {
  const [backend, setBackend] = useState<FirewallBackend | null>(null);
  const [ufwStatus, setUfwStatus] = useState<UfwStatus | null>(null);
  const [rules, setRules] = useState<UfwRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Confirm dialog state
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    label: string;
    danger: boolean;
    action: () => Promise<void>;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const b = await invoke<FirewallBackend>("detect_firewall");
      setBackend(b);
      if (b === "ufw") {
        const [status, rulesData] = await Promise.all([
          invoke<UfwStatus>("get_ufw_status"),
          invoke<UfwRule[]>("get_ufw_rules"),
        ]);
        setUfwStatus(status);
        setRules(rulesData);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function requireConfirm(
    title: string,
    message: string,
    label: string,
    danger: boolean,
    action: () => Promise<void>
  ) {
    setConfirm({ title, message, label, danger, action });
  }

  async function execConfirmed() {
    if (!confirm) return;
    setConfirm(null);
    setBusy(true);
    setError(null);
    try {
      await confirm.action();
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleFirewall() {
    const isActive = ufwStatus?.active;
    requireConfirm(
      isActive ? "Disable Firewall" : "Enable Firewall",
      isActive
        ? "Disabling the firewall will allow all incoming connections. This may expose your system to threats."
        : "Enable UFW firewall with current rules?",
      isActive ? "Disable" : "Enable",
      !!isActive,
      async () => {
        if (isActive) {
          await invoke("ufw_disable");
        } else {
          await invoke("ufw_enable");
        }
      }
    );
  }

  async function handleDeleteRule(rule: UfwRule) {
    requireConfirm(
      "Delete Rule",
      `Delete rule #${rule.number}: ${rule.action} ${rule.to} from ${rule.from}?\n\nThis change is permanent.`,
      "Delete Rule",
      true,
      async () => { await invoke("ufw_delete_rule", { ruleNumber: rule.number }); }
    );
  }

  async function handleAddRule(ruleStr: string, action: "allow" | "deny") {
    setShowAddForm(false);
    setBusy(true);
    setError(null);
    try {
      if (action === "allow") {
        await invoke("ufw_allow", { rule: ruleStr });
      } else {
        await invoke("ufw_deny", { rule: ruleStr });
      }
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
        Detecting firewall...
      </div>
    );
  }

  // ── No firewall ──────────────────────────────────────────────────────────
  if (backend === "none" || backend === null) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
        <Shield size={40} color="var(--text-muted)" />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>No firewall detected</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 360, textAlign: "center" }}>
          No supported firewall (UFW, nftables, iptables) found. Install UFW with:
        </div>
        <code style={{ background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 14px", fontSize: 12 }}>
          sudo pacman -S ufw
        </code>
      </div>
    );
  }

  // ── Non-UFW backend ──────────────────────────────────────────────────────
  if (backend !== "ufw") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
        <Shield size={40} color="var(--accent)" />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          {backend === "nftables" ? "nftables" : "iptables"} detected
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 380, textAlign: "center" }}>
          Full GUI management is currently implemented for UFW only. For {backend}, use the terminal.
          Install UFW for a full management experience.
        </div>
        <code style={{ background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 14px", fontSize: 12 }}>
          sudo pacman -S ufw &amp;&amp; sudo ufw enable
        </code>
      </div>
    );
  }

  // ── UFW UI ───────────────────────────────────────────────────────────────
  const isActive = ufwStatus?.active ?? false;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <Shield size={14} color={isActive ? "var(--color-success)" : "#dc3545"} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
          Firewall Manager
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "1px 8px",
            borderRadius: 3,
            background: isActive ? "rgba(0,180,80,0.12)" : "rgba(220,53,69,0.12)",
            color: isActive ? "var(--color-success)" : "#dc3545",
          }}
        >
          {isActive ? "ACTIVE" : "INACTIVE"}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Backend: UFW</span>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={load}
            disabled={busy}
            style={{ ...btnSecStyle, display: "flex", alignItems: "center", gap: 5 }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            disabled={busy || !isActive}
            style={{ ...btnPriStyle, display: "flex", alignItems: "center", gap: 5 }}
          >
            <Plus size={12} /> Add Rule
          </button>
          <button
            onClick={handleToggleFirewall}
            disabled={busy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 12px",
              fontSize: 11,
              fontWeight: 600,
              background: isActive ? "#dc3545" : "var(--color-success)",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            <Power size={12} />
            {isActive ? "Disable" : "Enable"}
          </button>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: "7px 16px", background: "rgba(220,53,69,0.08)", borderBottom: "1px solid rgba(220,53,69,0.2)", fontSize: 11, color: "#dc3545", flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* ── Status bar ────────────────────────────────────────────── */}
      {ufwStatus && (
        <div
          style={{
            display: "flex",
            gap: 20,
            padding: "5px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-1)",
            fontSize: 10,
            color: "var(--text-muted)",
            flexShrink: 0,
          }}
        >
          <span>Default incoming: <strong style={{ color: "var(--text-secondary)" }}>{ufwStatus.default_incoming}</strong></span>
          <span>Default outgoing: <strong style={{ color: "var(--text-secondary)" }}>{ufwStatus.default_outgoing}</strong></span>
          <span>Logging: <strong style={{ color: "var(--text-secondary)" }}>{ufwStatus.logging}</strong></span>
        </div>
      )}

      {/* ── Rules table ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", position: "sticky", top: 0, zIndex: 1 }}>
              {["#", "To (Port/Service)", "Action", "From", "Protocol", ""].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "7px 12px",
                    textAlign: h === "" ? "center" : "left",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 11,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-muted)", fontSize: 12 }}>
                  {isActive ? "No rules configured. Click \"Add Rule\" to add one." : "Firewall is inactive."}
                </td>
              </tr>
            )}
            {rules.map((rule, i) => (
              <RuleRow
                key={rule.number}
                rule={rule}
                index={i}
                onDelete={() => handleDeleteRule(rule)}
                disabled={busy}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Warning banner ────────────────────────────────────────── */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "7px 16px",
          background: "rgba(255,140,0,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          color: "#a05000",
          flexShrink: 0,
        }}
      >
        <AlertTriangle size={12} color="#c87000" />
        <span>
          <strong>Peringatan:</strong> Perubahan firewall bersifat permanen dan dapat mempengaruhi koneksi aktif. Pastikan port SSH (22) tetap ALLOW sebelum melakukan perubahan.
        </span>
      </div>

      {/* ── Modals ────────────────────────────────────────────────── */}
      {showAddForm && (
        <AddRuleForm
          onAdd={handleAddRule}
          onClose={() => setShowAddForm(false)}
          busy={busy}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.label}
          danger={confirm.danger}
          onConfirm={execConfirmed}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ─── Rule Row ─────────────────────────────────────────────────────────────────

function RuleRow({
  rule,
  index,
  onDelete,
  disabled,
}: {
  rule: UfwRule;
  index: number;
  onDelete: () => void;
  disabled: boolean;
}) {
  const isAllow = rule.action === "ALLOW";
  const rowBg = index % 2 === 0 ? "transparent" : "var(--surface-1)";

  return (
    <tr
      style={{ background: rowBg }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "var(--surface-3)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = rowBg)}
    >
      <td style={{ ...cellStyle, color: "var(--text-muted)", fontFamily: "monospace" }}>{rule.number}</td>
      <td style={{ ...cellStyle, fontFamily: "monospace", fontWeight: 600 }}>{rule.to}</td>
      <td style={cellStyle}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          padding: "1px 7px",
          borderRadius: 3,
          background: isAllow ? "rgba(0,180,80,0.12)" : "rgba(220,53,69,0.12)",
          color: isAllow ? "var(--color-success)" : "#dc3545",
        }}>
          {rule.action}
        </span>
      </td>
      <td style={cellStyle}>{rule.from}</td>
      <td style={{ ...cellStyle, color: "var(--text-muted)", fontSize: 11 }}>
        {rule.protocol ?? "—"}
      </td>
      <td style={{ ...cellStyle, textAlign: "center" }}>
        <button
          onClick={onDelete}
          disabled={disabled}
          title="Delete rule"
          style={{
            background: "transparent",
            border: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            padding: 4,
            borderRadius: 3,
          }}
          onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.color = "#dc3545"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: "5px 9px",
  fontSize: 12,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--surface-0)",
  color: "var(--text-primary)",
  outline: "none",
  width: "100%",
};

const btnPriStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 12px",
  fontSize: 11,
  fontWeight: 600,
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
};

const btnSecStyle: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: 11,
  background: "var(--surface-3)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  cursor: "pointer",
  color: "var(--text-secondary)",
};

const cellStyle: React.CSSProperties = {
  padding: "7px 12px",
  borderBottom: "1px solid var(--border)",
  color: "var(--text-primary)",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};

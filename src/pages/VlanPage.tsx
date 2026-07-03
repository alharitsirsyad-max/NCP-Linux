import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw, Network, Info } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VlanInterface {
  name: string;
  vlan_id: number;
  parent_interface: string;
  state: string;
  ipv4: string | null;
  mac: string | null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VlanPage() {
  const [vlans, setVlans] = useState<VlanInterface[]>([]);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const data = await invoke<VlanInterface[]>("get_vlan_info");
      setVlans(data);
      setStatus("done");
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Empty state ───────────────────────────────────────────────────────────
  const isEmpty = status === "done" && vlans.length === 0;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
      }}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
          flexShrink: 0,
        }}
      >
        <Network size={14} color="var(--accent)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
          VLAN Interfaces
        </span>
        <button
          onClick={load}
          disabled={status === "loading"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 12px",
            fontSize: 11,
            fontWeight: 600,
            background: status === "loading" ? "var(--surface-3)" : "var(--accent)",
            color: status === "loading" ? "var(--text-muted)" : "#fff",
            border: "none",
            borderRadius: 4,
            cursor: status === "loading" ? "not-allowed" : "pointer",
          }}
        >
          <RefreshCw
            size={12}
            style={{ animation: status === "loading" ? "spin 1s linear infinite" : "none" }}
          />
          Refresh
        </button>
      </div>

      {/* ── Error ───────────────────────────────────────────────────── */}
      {status === "error" && (
        <div
          style={{
            padding: "8px 16px",
            background: "rgba(220,53,69,0.08)",
            borderBottom: "1px solid rgba(220,53,69,0.2)",
            fontSize: 11,
            color: "#dc3545",
            flexShrink: 0,
          }}
        >
          {error}
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {isEmpty ? (
          <EmptyState />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr
                style={{
                  background: "var(--surface-2)",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                {["Interface", "VLAN ID", "Parent", "IP Address", "MAC", "Status"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "7px 12px",
                      textAlign: "left",
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
              {vlans.map((vlan, i) => (
                <VlanRow key={vlan.name} vlan={vlan} index={i} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      {!isEmpty && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "4px 16px",
            fontSize: 10,
            color: "var(--text-muted)",
            background: "var(--surface-2)",
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <span>{vlans.length} VLAN interface{vlans.length !== 1 ? "s" : ""} found</span>
          <span style={{ marginLeft: "auto", fontStyle: "italic" }}>
            Untuk membuat VLAN baru, gunakan nm-connection-editor atau ip link add
          </span>
        </div>
      )}
    </div>
  );
}

// ─── VLAN Row ─────────────────────────────────────────────────────────────────

function VlanRow({ vlan, index }: { vlan: VlanInterface; index: number }) {
  const isUp = vlan.state === "UP";
  const rowBg = index % 2 === 0 ? "transparent" : "var(--surface-1)";

  return (
    <tr
      style={{ background: rowBg }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLTableRowElement).style.background = "var(--surface-3)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLTableRowElement).style.background = rowBg)
      }
    >
      {/* Interface name */}
      <td style={cellStyle}>
        <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--accent)" }}>
          {vlan.name}
        </span>
      </td>

      {/* VLAN ID */}
      <td style={cellStyle}>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            fontWeight: 700,
            padding: "1px 6px",
            borderRadius: 3,
            background: "rgba(0,103,184,0.1)",
            color: "var(--accent)",
          }}
        >
          {vlan.vlan_id}
        </span>
      </td>

      {/* Parent interface */}
      <td style={cellStyle}>
        <span style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
          {vlan.parent_interface || "—"}
        </span>
      </td>

      {/* IP */}
      <td style={cellStyle}>
        {vlan.ipv4 ? (
          <span style={{ fontFamily: "monospace" }}>{vlan.ipv4}</span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>—</span>
        )}
      </td>

      {/* MAC */}
      <td style={cellStyle}>
        {vlan.mac ? (
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>
            {vlan.mac}
          </span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>—</span>
        )}
      </td>

      {/* Status */}
      <td style={cellStyle}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "1px 7px",
            borderRadius: 3,
            background: isUp
              ? "rgba(0,180,80,0.12)"
              : "rgba(150,150,150,0.12)",
            color: isUp ? "var(--color-success)" : "var(--text-muted)",
          }}
        >
          {vlan.state}
        </span>
      </td>
    </tr>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "48px 32px",
        color: "var(--text-secondary)",
        textAlign: "center",
      }}
    >
      <Network size={40} color="var(--text-muted)" />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
          Tidak ada VLAN terkonfigurasi
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 440, lineHeight: 1.6 }}>
          VLAN (Virtual LAN) memungkinkan satu adapter fisik dibagi menjadi beberapa jaringan
          virtual yang terisolasi secara logis. Biasanya digunakan di lingkungan enterprise,
          lab jaringan, dan router MikroTik/Cisco.
        </div>
      </div>

      <div
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "14px 20px",
          fontSize: 11,
          color: "var(--text-secondary)",
          textAlign: "left",
          maxWidth: 420,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          <Info size={13} color="var(--accent)" />
          Cara membuat VLAN interface
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, lineHeight: 1.5 }}>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Via NetworkManager:</span>
            <code
              style={{
                display: "block",
                marginTop: 3,
                padding: "4px 8px",
                background: "var(--surface-3)",
                borderRadius: 3,
                fontFamily: "monospace",
                fontSize: 11,
                color: "var(--text-primary)",
              }}
            >
              nmcli con add type vlan con-name vlan10 dev eth0 id 10
            </code>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Via ip link:</span>
            <code
              style={{
                display: "block",
                marginTop: 3,
                padding: "4px 8px",
                background: "var(--surface-3)",
                borderRadius: 3,
                fontFamily: "monospace",
                fontSize: 11,
                color: "var(--text-primary)",
              }}
            >
              ip link add link eth0 name eth0.10 type vlan id 10
            </code>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Via GUI:</span>{" "}
            <span>buka nm-connection-editor → Add → VLAN</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cellStyle: React.CSSProperties = {
  padding: "7px 12px",
  borderBottom: "1px solid var(--border)",
  color: "var(--text-primary)",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};

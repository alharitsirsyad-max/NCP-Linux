import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw, Wifi, WifiOff, AlertTriangle, CheckCircle2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WifiNetwork {
  ssid: string;
  bssid: string;
  signal_strength: number; // dBm
  signal_percent: number;  // 0-100
  channel: number;
  frequency_mhz: number;
  band: string;
  security: string;
  mode: string;
  in_use: boolean;
}

// ─── Signal Bar ───────────────────────────────────────────────────────────────

function SignalBar({ percent }: { percent: number }) {
  const bars = 5;
  const filled = Math.round((percent / 100) * bars);

  const color =
    percent >= 70
      ? "var(--color-success)"
      : percent >= 40
      ? "var(--color-warning)"
      : "#dc3545";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ display: "flex", gap: 2 }}>
        {Array.from({ length: bars }, (_, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6 + i * 2,
              borderRadius: 1,
              background: i < filled ? color : "var(--surface-3)",
              border: `1px solid ${i < filled ? color : "var(--border)"}`,
              alignSelf: "flex-end",
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontSize: 11,
          fontFamily: "monospace",
          color,
          minWidth: 34,
        }}
      >
        {percent}%
      </span>
    </div>
  );
}

// ─── Security Badge ───────────────────────────────────────────────────────────

function SecurityBadge({ security }: { security: string }) {
  const isOpen = security === "Open";
  const isWeak = security === "WEP";

  let bg = "rgba(0, 103, 184, 0.1)";
  let color = "var(--accent)";
  if (isOpen) { bg = "rgba(220, 53, 69, 0.12)"; color = "#dc3545"; }
  else if (isWeak) { bg = "rgba(255, 165, 0, 0.15)"; color = "#cc7000"; }
  else if (security === "WPA3") { bg = "rgba(0, 180, 80, 0.12)"; color = "var(--color-success)"; }

  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: "1px 6px",
        borderRadius: 3,
        background: bg,
        color,
        letterSpacing: "0.03em",
      }}
    >
      {isOpen && "⚠ "}
      {security}
    </span>
  );
}

// ─── Channel Usage Chart ──────────────────────────────────────────────────────

function ChannelUsageChart({
  networks,
  band,
}: {
  networks: WifiNetwork[];
  band: "2.4 GHz" | "5 GHz";
}) {
  const bandNetworks = networks.filter((n) => n.band === band);
  if (bandNetworks.length === 0) return null;

  // Count networks per channel
  const channelMap = new Map<number, WifiNetwork[]>();
  for (const n of bandNetworks) {
    const ch = n.channel;
    if (!channelMap.has(ch)) channelMap.set(ch, []);
    channelMap.get(ch)!.push(n);
  }

  // Sort channels
  const channels = Array.from(channelMap.keys()).sort((a, b) => a - b);
  const maxCount = Math.max(...Array.from(channelMap.values()).map((v) => v.length));

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-secondary)",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Channel Usage — {band}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {channels.map((ch) => {
          const nets = channelMap.get(ch)!;
          const count = nets.length;
          const isCrowded = count >= 2;
          const barPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          const barColor = isCrowded ? "#dc3545" : "var(--accent)";

          return (
            <div key={ch} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: "var(--text-muted)",
                  minWidth: 36,
                  textAlign: "right",
                }}
              >
                CH{ch}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 12,
                  background: "var(--surface-3)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${barPct}%`,
                    background: barColor,
                    borderRadius: 3,
                    transition: "width 0.4s ease",
                    minWidth: count > 0 ? 12 : 0,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: isCrowded ? "#dc3545" : "var(--text-secondary)",
                  minWidth: 100,
                  fontWeight: isCrowded ? 600 : 400,
                }}
              >
                {count} network{count !== 1 ? "s" : ""}
                {isCrowded && " ⚠ crowded!"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WifiAnalyzerPage() {
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [status, setStatus] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [hasWifi, setHasWifi] = useState<boolean | null>(null);
  const [lastScan, setLastScan] = useState<Date | null>(null);

  const scan = useCallback(async () => {
    setStatus("scanning");
    setError(null);
    try {
      const result = await invoke<WifiNetwork[]>("scan_wifi_networks");
      setNetworks(result);
      setStatus("done");
      setLastScan(new Date());
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }, []);

  // Check Wi-Fi availability and auto-scan on mount
  useEffect(() => {
    async function init() {
      const wifi = await invoke<boolean>("check_wifi_available").catch(() => false);
      setHasWifi(wifi);
      if (wifi) {
        scan();
      }
    }
    init();
  }, [scan]);

  // ── No Wi-Fi adapter ─────────────────────────────────────────────────────
  if (hasWifi === false) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 32,
          color: "var(--text-secondary)",
        }}
      >
        <WifiOff size={40} color="var(--text-muted)" />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          No Wi-Fi adapter detected
        </div>
        <div style={{ fontSize: 12, textAlign: "center", maxWidth: 360, color: "var(--text-muted)" }}>
          Wi-Fi Analyzer requires a wireless adapter. If you have one, ensure it is enabled and
          recognized by NetworkManager.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8,
            padding: "5px 14px",
            fontSize: 12,
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Loading check ─────────────────────────────────────────────────────────
  if (hasWifi === null) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: 12,
        }}
      >
        Checking Wi-Fi adapter...
      </div>
    );
  }

  const has24 = networks.some((n) => n.band === "2.4 GHz");
  const has5  = networks.some((n) => n.band === "5 GHz");

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
        <Wifi size={14} color="var(--accent)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
          Wi-Fi Analyzer
        </span>

        {lastScan && (
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Last scan: {lastScan.toLocaleTimeString()}
          </span>
        )}

        <button
          onClick={scan}
          disabled={status === "scanning"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 12px",
            fontSize: 11,
            fontWeight: 600,
            background: status === "scanning" ? "var(--surface-3)" : "var(--accent)",
            color: status === "scanning" ? "var(--text-muted)" : "#fff",
            border: "none",
            borderRadius: 4,
            cursor: status === "scanning" ? "not-allowed" : "pointer",
          }}
        >
          <RefreshCw
            size={12}
            style={{
              animation: status === "scanning" ? "spin 1s linear infinite" : "none",
            }}
          />
          {status === "scanning" ? "Scanning..." : "Scan"}
        </button>
      </div>

      {/* ── Error state ────────────────────────────────────────────── */}
      {status === "error" && (
        <div
          style={{
            padding: "8px 16px",
            background: "rgba(220, 53, 69, 0.08)",
            borderBottom: "1px solid rgba(220, 53, 69, 0.25)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            color: "#dc3545",
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={13} />
          {error}
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>

        {/* Networks table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          <thead>
            <tr
              style={{
                background: "var(--surface-2)",
                position: "sticky",
                top: 0,
                zIndex: 1,
              }}
            >
              {["SSID", "Signal", "Channel", "Band", "Security", "BSSID"].map((h) => (
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
            {networks.length === 0 && status !== "scanning" && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: "center",
                    padding: "40px 16px",
                    color: "var(--text-muted)",
                    fontSize: 12,
                  }}
                >
                  {status === "idle"
                    ? "Click Scan to detect Wi-Fi networks"
                    : "No Wi-Fi networks found"}
                </td>
              </tr>
            )}

            {status === "scanning" && networks.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: "center",
                    padding: "40px 16px",
                    color: "var(--text-muted)",
                    fontSize: 12,
                  }}
                >
                  Scanning for Wi-Fi networks...
                </td>
              </tr>
            )}

            {networks.map((net, i) => (
              <NetworkRow key={`${net.bssid}-${i}`} network={net} index={i} />
            ))}
          </tbody>
        </table>

        {/* ── Channel Usage ───────────────────────────────────────── */}
        {networks.length > 0 && (
          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid var(--border)",
              background: "var(--surface-1)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 14,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Channel Overview
            </div>
            <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
              {has24 && <ChannelUsageChart networks={networks} band="2.4 GHz" />}
              {has5  && <ChannelUsageChart networks={networks} band="5 GHz" />}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
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
        <span>{networks.length} network(s) found</span>
        {networks.filter((n) => n.in_use).map((n) => (
          <span key={n.bssid} style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--color-success)" }}>
            <CheckCircle2 size={10} /> Connected: {n.ssid}
          </span>
        ))}
        {status === "scanning" && (
          <span style={{ color: "var(--accent)" }}>Scanning...</span>
        )}
      </div>
    </div>
  );
}

// ─── Network Row ──────────────────────────────────────────────────────────────

function NetworkRow({ network, index }: { network: WifiNetwork; index: number }) {
  const rowBg = network.in_use
    ? "rgba(0, 180, 80, 0.06)"
    : index % 2 === 0
    ? "transparent"
    : "var(--surface-1)";

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
      {/* SSID */}
      <td style={cellStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {network.in_use && (
            <span title="Currently connected" style={{ color: "var(--color-success)", display: "flex" }}>
              <CheckCircle2 size={12} />
            </span>
          )}
          <span
            style={{
              fontWeight: network.in_use ? 700 : 400,
              color: network.in_use ? "var(--text-primary)" : "var(--text-primary)",
              maxWidth: 200,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
          >
            {network.ssid}
          </span>
        </div>
      </td>

      {/* Signal */}
      <td style={cellStyle}>
        <SignalBar percent={network.signal_percent} />
      </td>

      {/* Channel */}
      <td style={cellStyle}>
        <span style={{ fontFamily: "monospace", fontSize: 12 }}>
          CH {network.channel}
        </span>
      </td>

      {/* Band */}
      <td style={cellStyle}>
        <span
          style={{
            fontSize: 11,
            padding: "1px 6px",
            borderRadius: 3,
            background: network.band === "5 GHz"
              ? "rgba(0, 103, 184, 0.1)"
              : network.band === "6 GHz"
              ? "rgba(120, 0, 200, 0.1)"
              : "rgba(255, 140, 0, 0.1)",
            color: network.band === "5 GHz"
              ? "var(--accent)"
              : network.band === "6 GHz"
              ? "#7800c8"
              : "#c86000",
            fontWeight: 600,
          }}
        >
          {network.band}
        </span>
      </td>

      {/* Security */}
      <td style={cellStyle}>
        <SecurityBadge security={network.security} />
      </td>

      {/* BSSID */}
      <td style={cellStyle}>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--text-muted)" }}>
          {network.bssid}
        </span>
      </td>
    </tr>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "7px 12px",
  borderBottom: "1px solid var(--border)",
  color: "var(--text-primary)",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};

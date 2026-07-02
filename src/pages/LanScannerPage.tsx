import { useState, useRef, useEffect } from "react";
import {
  Scan,
  StopCircle,
  Copy,
  Terminal,
  Route,
  AlertTriangle,
  Wifi,
  Download,
  RefreshCw,
  Power,
} from "lucide-react";
import { useLanScanner, type LanDevice } from "../hooks/useLanScanner";
import { useUIStore } from "../stores/uiStore";
import { invoke } from "@tauri-apps/api/core";

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface CtxMenu {
  device: LanDevice;
  x: number;
  y: number;
}

function DeviceContextMenu({
  device,
  x,
  y,
  onClose,
}: {
  device: LanDevice;
  x: number;
  y: number;
  onClose: () => void;
}) {
  const { openDiagnostics, setSelectedPage } = useUIStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [onClose]);

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    onClose();
  }

  function pingDevice() {
    openDiagnostics("ping", device.ip);
    onClose();
  }

  function tracerouteDevice() {
    openDiagnostics("traceroute", device.ip);
    onClose();
  }

  function sshDevice() {
    setSelectedPage("ssh");
    onClose();
  }

  function addToWol() {
    // Navigate to WoL page — the page will handle pre-fill via uiStore state
    // We use sessionStorage as a lightweight cross-page signal
    if (device.mac) {
      sessionStorage.setItem("wol_prefill_mac", device.mac);
    }
    setSelectedPage("wol");
    onClose();
  }

  const items: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }[] = [
    {
      label: "Copy IP",
      icon: <Copy size={12} />,
      onClick: () => copyText(device.ip),
    },
    {
      label: "Copy MAC",
      icon: <Copy size={12} />,
      onClick: () => copyText(device.mac ?? ""),
      disabled: !device.mac,
    },
    { label: "─", icon: null, onClick: () => {} },
    { label: "Ping device", icon: <Wifi size={12} />, onClick: pingDevice },
    {
      label: "Traceroute",
      icon: <Route size={12} />,
      onClick: tracerouteDevice,
    },
    {
      label: "SSH to device",
      icon: <Terminal size={12} />,
      onClick: sshDevice,
    },
    { label: "─", icon: null, onClick: () => {} },
    {
      label: "Add to Wake-on-LAN",
      icon: <Power size={12} />,
      onClick: addToWol,
      disabled: !device.mac,
    },
  ];

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: y,
        left: x,
        zIndex: 9999,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        minWidth: 180,
        padding: "3px 0",
        fontSize: 12,
      }}
    >
      {items.map((item, i) => {
        if (item.label === "─") {
          return (
            <div
              key={i}
              style={{ height: 1, background: "var(--border)", margin: "3px 0" }}
            />
          );
        }
        return (
          <button
            key={i}
            disabled={item.disabled}
            onClick={item.onClick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "5px 12px",
              background: "transparent",
              border: "none",
              cursor: item.disabled ? "not-allowed" : "pointer",
              color: item.disabled ? "var(--text-muted)" : "var(--text-primary)",
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              if (!item.disabled)
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--surface-3)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>{item.icon}</span>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ScanProgressBar({
  percent,
  message,
}: {
  percent: number;
  message: string;
}) {
  return (
    <div
      style={{
        padding: "8px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-1)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          marginBottom: 4,
        }}
      >
        {message}
      </div>
      <div
        style={{
          height: 6,
          background: "var(--surface-3)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percent}%`,
            background: "var(--accent)",
            borderRadius: 3,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          marginTop: 2,
          textAlign: "right",
        }}
      >
        {percent}%
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LanScannerPage() {
  const scanner = useLanScanner();
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  function handleRowContextMenu(e: React.MouseEvent, device: LanDevice) {
    e.preventDefault();
    setCtxMenu({ device, x: e.clientX, y: e.clientY });
  }

  function handleStartStop() {
    if (scanner.status === "running") {
      scanner.stop();
    } else {
      if (scanner.selectedNetwork) {
        scanner.start(scanner.selectedNetwork);
      }
    }
  }

  async function handleExport() {
    if (scanner.devices.length === 0) return;

    const lines = [
      "LAN Scanner Results",
      "===================",
      `Network : ${scanner.selectedNetwork ?? ""}`,
      `Date    : ${new Date().toLocaleString()}`,
      `Devices : ${scanner.devices.length}`,
      "",
      "IP Address".padEnd(18) +
        "MAC Address".padEnd(20) +
        "Vendor".padEnd(22) +
        "Hostname".padEnd(30) +
        "Latency",
      "-".repeat(90),
      ...scanner.devices.map((d) =>
        (d.ip ?? "").padEnd(18) +
        (d.mac ?? "—").padEnd(20) +
        (d.vendor ?? "—").padEnd(22) +
        (d.hostname ?? "—").padEnd(30) +
        (d.latency_ms != null ? `${d.latency_ms.toFixed(1)} ms` : "—")
      ),
    ];

    try {
      const path = `${Date.now()}_lan_scan.txt`;
      await invoke("save_report", { content: lines.join("\n"), filename: path });
      setExportMsg(`Saved to ~/Downloads/${path}`);
      setTimeout(() => setExportMsg(null), 4000);
    } catch {
      setExportMsg("Export failed");
      setTimeout(() => setExportMsg(null), 3000);
    }
  }

  // ── No nmap ──────────────────────────────────────────────────────────────
  if (scanner.hasNmap === false) {
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
        <AlertTriangle size={32} color="var(--color-warning)" />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          nmap tidak ditemukan
        </div>
        <div style={{ fontSize: 12, textAlign: "center", maxWidth: 360 }}>
          LAN Scanner membutuhkan nmap. Install dengan:
        </div>
        <code
          style={{
            background: "var(--surface-3)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "6px 14px",
            fontSize: 12,
            color: "var(--text-primary)",
          }}
        >
          sudo pacman -S nmap
        </code>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          atau: sudo apt install nmap / sudo dnf install nmap
        </div>
      </div>
    );
  }

  // ── Loading state (null = not checked yet) ────────────────────────────────
  if (scanner.hasNmap === null) {
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
        Checking dependencies...
      </div>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────
  const isRunning = scanner.status === "running";
  const isDone = scanner.status === "done";

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
      {/* Disclaimer banner */}
      <div
        style={{
          background: "#fff3cd",
          borderBottom: "1px solid #ffc107",
          padding: "6px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          color: "#664d03",
          flexShrink: 0,
        }}
      >
        <AlertTriangle size={13} color="#856404" />
        <strong>Peringatan:</strong> Gunakan fitur ini hanya di jaringan milik
        sendiri. Scanning jaringan orang lain tanpa izin adalah ilegal.
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        {/* Network selector */}
        <select
          value={scanner.selectedNetwork ?? ""}
          onChange={(e) => scanner.setSelectedNetwork(e.target.value)}
          disabled={isRunning}
          style={{
            padding: "4px 8px",
            fontSize: 12,
            border: "1px solid var(--border)",
            borderRadius: 4,
            background: "var(--surface-0)",
            color: "var(--text-primary)",
            minWidth: 180,
          }}
        >
          {scanner.networks.length === 0 && (
            <option value="">No networks detected</option>
          )}
          {scanner.networks.map((n) => (
            <option key={n.network} value={n.network}>
              {n.interface} — {n.network}
            </option>
          ))}
        </select>

        {/* Start / Stop */}
        <button
          onClick={handleStartStop}
          disabled={!scanner.selectedNetwork && !isRunning}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 14px",
            fontSize: 12,
            fontWeight: 600,
            background: isRunning ? "#dc3545" : "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {isRunning ? (
            <>
              <StopCircle size={13} /> Stop
            </>
          ) : (
            <>
              <Scan size={13} /> Start Scan
            </>
          )}
        </button>

        {/* Refresh networks */}
        <button
          onClick={() => window.location.reload()}
          disabled={isRunning}
          title="Refresh network list"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            fontSize: 11,
            background: "var(--surface-3)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            cursor: "pointer",
            color: "var(--text-secondary)",
          }}
        >
          <RefreshCw size={12} />
        </button>

        {/* Export */}
        {isDone && scanner.devices.length > 0 && (
          <button
            onClick={handleExport}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              fontSize: 11,
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            <Download size={12} /> Export
          </button>
        )}

        {exportMsg && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {exportMsg}
          </span>
        )}

        {/* No-sudo note */}
        {isDone && scanner.devices.some((d) => !d.mac) && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}
          >
            ⚠ MAC tidak tersedia — jalankan dengan sudo untuk info lengkap
          </span>
        )}
      </div>

      {/* Progress bar */}
      {isRunning && scanner.progress && (
        <ScanProgressBar
          percent={scanner.progress.percent}
          message={scanner.progress.message}
        />
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
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
              {["IP Address", "MAC Address", "Vendor", "Hostname", "Latency"].map(
                (h) => (
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
                )
              )}
            </tr>
          </thead>
          <tbody>
            {scanner.devices.length === 0 && !isRunning && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: "center",
                    padding: "40px 16px",
                    color: "var(--text-muted)",
                    fontSize: 12,
                  }}
                >
                  {scanner.status === "idle"
                    ? "Select a network and click Start Scan"
                    : scanner.status === "error"
                    ? `Error: ${scanner.error}`
                    : "No devices found"}
                </td>
              </tr>
            )}
            {scanner.devices.map((device, i) => (
              <DeviceRow
                key={device.ip}
                device={device}
                index={i}
                onContextMenu={(e) => handleRowContextMenu(e, device)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer status bar */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "4px 16px",
          fontSize: 10,
          color: "var(--text-muted)",
          background: "var(--surface-2)",
          display: "flex",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <span>{scanner.devices.length} device(s) found</span>
        {isDone && scanner.progress && (
          <span>{scanner.progress.message}</span>
        )}
        {isRunning && <span style={{ color: "var(--accent)" }}>Scanning...</span>}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <DeviceContextMenu
          device={ctxMenu.device}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

// ─── Device Row ───────────────────────────────────────────────────────────────

function DeviceRow({
  device,
  index,
  onContextMenu,
}: {
  device: LanDevice;
  index: number;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <tr
      onContextMenu={onContextMenu}
      style={{
        background: index % 2 === 0 ? "transparent" : "var(--surface-1)",
        cursor: "context-menu",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLTableRowElement).style.background =
          "var(--surface-3)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLTableRowElement).style.background =
          index % 2 === 0 ? "transparent" : "var(--surface-1)")
      }
    >
      <td style={cellStyle}>
        <span
          style={{
            fontFamily: "monospace",
            color: "var(--accent)",
            fontWeight: 600,
          }}
        >
          {device.ip}
        </span>
      </td>
      <td style={cellStyle}>
        <span style={{ fontFamily: "monospace", fontSize: 11 }}>
          {device.mac ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
        </span>
      </td>
      <td style={cellStyle}>
        {device.vendor ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
      </td>
      <td style={cellStyle}>
        {device.hostname ?? (
          <span style={{ color: "var(--text-muted)" }}>—</span>
        )}
      </td>
      <td style={cellStyle}>
        {device.latency_ms != null ? (
          <span style={{ fontFamily: "monospace" }}>
            {device.latency_ms.toFixed(1)} ms
          </span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>—</span>
        )}
      </td>
    </tr>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderBottom: "1px solid var(--border)",
  fontSize: 12,
  color: "var(--text-primary)",
  whiteSpace: "nowrap",
};

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw } from "lucide-react";

interface PortEntry {
  protocol: string;
  local_address: string;
  local_port: number;
  state: string;
  pid: number | null;
  process: string | null;
}

type ProtoFilter = "all" | "tcp" | "udp";

export default function PortsPage() {
  const [protoFilter, setProtoFilter] = useState<ProtoFilter>("all");
  const [listenOnly, setListenOnly] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<PortEntry[]>({
    queryKey: ["openPorts"],
    queryFn: () => invoke<PortEntry[]>("get_open_ports"),
    staleTime: 0,
  });

  const entries = data ?? [];
  const filtered = entries.filter((e) => {
    if (protoFilter !== "all" && e.protocol !== protoFilter) return false;
    if (listenOnly && e.state.toUpperCase() !== "LISTEN") return false;
    return true;
  });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, background: "var(--surface-2)", flexWrap: "wrap" }}>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 12px", background: "var(--surface-3)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "11px", cursor: "pointer" }}
        >
          <RefreshCw size={12} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>

        {/* Protocol filter */}
        <div style={{ display: "flex", gap: "4px" }}>
          {(["all", "tcp", "udp"] as ProtoFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setProtoFilter(p)}
              style={{
                padding: "3px 10px",
                borderRadius: "var(--radius-sm)",
                fontSize: "11px",
                cursor: "pointer",
                border: "1px solid var(--border-strong)",
                background: protoFilter === p ? "var(--accent)" : "var(--surface-3)",
                color: protoFilter === p ? "white" : "var(--text-secondary)",
                fontWeight: protoFilter === p ? 600 : 400,
              }}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Listening only toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-secondary)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={listenOnly}
            onChange={(e) => setListenOnly(e.target.checked)}
            style={{ accentColor: "var(--accent)" }}
          />
          Listening only
        </label>

        <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-muted)" }}>
          {filtered.length} ports
        </span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {isLoading && <LoadingRows />}
        {isError && (
          <div style={{ padding: "20px", color: "var(--color-error)", fontSize: "12px" }}>
            Error: {String(error)}
          </div>
        )}
        {!isLoading && !isError && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                {["Protocol", "Address", "Port", "State", "PID", "Process"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface-3)" }}>
                  <td style={{ padding: "7px 12px" }}>
                    <span style={{ padding: "2px 7px", borderRadius: "var(--radius-sm)", fontSize: "10px", fontWeight: 600, background: entry.protocol === "tcp" ? "rgba(0,103,184,0.12)" : "rgba(157,93,0,0.1)", color: entry.protocol === "tcp" ? "var(--accent)" : "var(--color-warning)" }}>
                      {entry.protocol.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: "7px 12px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{entry.local_address}</td>
                  <td style={{ padding: "7px 12px", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)" }}>{entry.local_port}</td>
                  <td style={{ padding: "7px 12px" }}>
                    <span style={{ padding: "2px 6px", borderRadius: "var(--radius-sm)", fontSize: "10px", background: "var(--surface-3)", color: entry.state.toUpperCase() === "LISTEN" ? "var(--color-success)" : "var(--text-muted)" }}>
                      {entry.state}
                    </span>
                  </td>
                  <td style={{ padding: "7px 12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{entry.pid ?? "—"}</td>
                  <td style={{ padding: "7px 12px", color: "var(--text-secondary)" }}>{entry.process ?? "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>No ports found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function LoadingRows() {
  return (
    <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "6px" }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ height: "28px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", opacity: 0.5 }} />
      ))}
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw } from "lucide-react";

interface RouteEntry {
  destination: string;
  gateway: string | null;
  interface: string;
  metric: number;
  protocol: string;
  scope: string;
}

function stateColor(protocol: string): string {
  switch (protocol) {
    case "kernel": return "var(--text-muted)";
    case "static": return "var(--accent)";
    case "dhcp":   return "var(--color-success)";
    default:       return "var(--text-secondary)";
  }
}

export default function RoutingPage() {
  const [ifaceFilter, setIfaceFilter] = useState<string>("all");

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<RouteEntry[]>({
    queryKey: ["routingTable"],
    queryFn: () => invoke<RouteEntry[]>("get_routing_table"),
    staleTime: 0,
  });

  const routes = data ?? [];
  const interfaces = Array.from(new Set(routes.map((r) => r.interface))).sort();
  const filtered = ifaceFilter === "all" ? routes : routes.filter((r) => r.interface === ifaceFilter);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, background: "var(--surface-2)" }}>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 12px", background: "var(--surface-3)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "11px", cursor: "pointer" }}
        >
          <RefreshCw size={12} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>

        <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Interface:</label>
        <select
          value={ifaceFilter}
          onChange={(e) => setIfaceFilter(e.target.value)}
          style={{ padding: "3px 8px", background: "var(--surface-0)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "11px" }}
        >
          <option value="all">All</option>
          {interfaces.map((iface) => (
            <option key={iface} value={iface}>{iface}</option>
          ))}
        </select>

        <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-muted)" }}>
          {filtered.length} routes
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
                {["Destination", "Gateway", "Interface", "Metric", "Protocol"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((route, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface-3)" }}>
                  <td style={{ padding: "7px 12px", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{route.destination}</td>
                  <td style={{ padding: "7px 12px", fontFamily: "var(--font-mono)", color: route.gateway ? "var(--text-primary)" : "var(--text-muted)" }}>{route.gateway ?? "—"}</td>
                  <td style={{ padding: "7px 12px", color: "var(--accent)" }}>{route.interface}</td>
                  <td style={{ padding: "7px 12px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{route.metric}</td>
                  <td style={{ padding: "7px 12px" }}>
                    <span style={{ padding: "2px 7px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.05)", color: stateColor(route.protocol), fontSize: "11px" }}>
                      {route.protocol}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>No routes found.</td></tr>
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
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ height: "28px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", opacity: 0.5 }} />
      ))}
    </div>
  );
}

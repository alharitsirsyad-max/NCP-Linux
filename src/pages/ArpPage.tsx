import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw } from "lucide-react";

interface ArpEntry {
  ip: string;
  mac: string;
  interface: string;
  state: string;
}

function stateStyle(state: string): React.CSSProperties {
  switch (state.toUpperCase()) {
    case "REACHABLE":            return { color: "var(--color-success)" };
    case "STALE": case "DELAY":  return { color: "var(--color-warning)" };
    case "FAILED": case "INCOMPLETE": return { color: "var(--color-error)" };
    default:                     return { color: "var(--text-muted)" };
  }
}

// Per-MAC vendor cache
const vendorCache = new Map<string, string>();

function useVendor(mac: string) {
  const [vendor, setVendor] = useState<string | null>(vendorCache.get(mac) ?? null);

  useEffect(() => {
    if (!mac || vendorCache.has(mac)) return;
    invoke<string>("lookup_mac_vendor", { mac })
      .then((v) => {
        vendorCache.set(mac, v);
        setVendor(v);
      })
      .catch(() => {});
  }, [mac]);

  return vendor;
}

function VendorCell({ mac }: { mac: string }) {
  const vendor = useVendor(mac);
  if (!vendor) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  // Show only the vendor name part (before parenthesis)
  const display = vendor.split("(")[0].trim();
  return <span title={vendor} style={{ color: "var(--text-secondary)", fontSize: "11px" }}>{display}</span>;
}

export default function ArpPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ArpEntry[]>({
    queryKey: ["arpTable"],
    queryFn: () => invoke<ArpEntry[]>("get_arp_table"),
    staleTime: 0,
  });

  const entries = data ?? [];

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
        <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-muted)" }}>
          {entries.length} entries
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
                {["IP Address", "MAC Address", "Vendor", "Interface", "State"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface-3)" }}>
                  <td style={{ padding: "7px 12px", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{entry.ip}</td>
                  <td style={{ padding: "7px 12px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{entry.mac || "—"}</td>
                  <td style={{ padding: "7px 12px" }}>
                    {entry.mac ? <VendorCell mac={entry.mac} /> : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td style={{ padding: "7px 12px", color: "var(--accent)" }}>{entry.interface}</td>
                  <td style={{ padding: "7px 12px" }}>
                    <span style={{ padding: "2px 7px", borderRadius: "var(--radius-sm)", background: "var(--surface-3)", fontSize: "11px", ...stateStyle(entry.state) }}>
                      {entry.state}
                    </span>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>No ARP entries found.</td></tr>
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

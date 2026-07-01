import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search } from "lucide-react";
import CopyButton from "../shared/CopyButton";

type RecordType = "A" | "AAAA" | "MX" | "CNAME" | "TXT" | "NS" | "PTR";
const RECORD_TYPES: RecordType[] = ["A", "AAAA", "MX", "CNAME", "TXT", "NS", "PTR"];

interface DnsResult {
  records: string[];
  record_type: string;
  host: string;
}

export default function DnsLookupPanel() {
  const [host, setHost] = useState("");
  const [recordType, setRecordType] = useState<RecordType>("A");
  const [result, setResult] = useState<DnsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    if (!host.trim()) { setError("Please enter a hostname."); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await invoke<DnsResult>("run_dns_lookup", { host: host.trim(), recordType });
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px" }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <input
          type="text"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && handleLookup()}
          placeholder="Hostname (e.g. google.com)"
          disabled={loading}
          style={{ flex: 1, padding: "5px 10px", background: "var(--surface-3)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "12px", fontFamily: "var(--font-mono)", outline: "none" }}
        />
        <select
          value={recordType}
          onChange={(e) => setRecordType(e.target.value as RecordType)}
          disabled={loading}
          style={{ padding: "5px 8px", background: "var(--surface-0)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "12px" }}
        >
          {RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={handleLookup}
          disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 14px", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: 500, background: "var(--accent)", color: "white", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
        >
          <Search size={12} />
          {loading ? "Looking up..." : "Lookup"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ fontSize: "11px", color: "var(--color-error)", padding: "8px 12px", background: "rgba(196,43,28,0.1)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(196,43,28,0.3)" }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ background: "var(--surface-0)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", flex: 1, overflow: "auto" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {result.record_type} records for <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{result.host}</span> — {result.records.length} result{result.records.length !== 1 ? "s" : ""}
            </span>
            {result.records.length > 0 && (
              <CopyButton text={result.records.join("\n")} />
            )}
          </div>
          <div style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: "12px", lineHeight: 1.8 }}>
            {result.records.length === 0 ? (
              <span style={{ color: "var(--text-muted)" }}>No records found.</span>
            ) : (
              result.records.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "10px", minWidth: "20px", textAlign: "right" }}>{i + 1}</span>
                  <span style={{ flex: 1 }}>{r}</span>
                  <CopyButton text={r} />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {!result && !error && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "12px" }}>
          Enter a hostname and select a record type, then press Lookup.
        </div>
      )}
    </div>
  );
}

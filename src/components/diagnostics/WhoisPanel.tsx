import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search } from "lucide-react";
import CopyButton from "../shared/CopyButton";

export default function WhoisPanel() {
  const [target, setTarget] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    if (!target.trim()) { setError("Please enter a domain or IP."); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const output = await invoke<string>("run_whois", { target: target.trim() });
      setResult(output);
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
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && handleLookup()}
          placeholder="Domain or IP (e.g. google.com, 8.8.8.8)"
          disabled={loading}
          style={{
            flex: 1,
            padding: "5px 10px",
            background: "var(--surface-0)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
            outline: "none",
          }}
        />
        <button
          onClick={handleLookup}
          disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 14px", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: 500, background: "var(--accent)", color: "white", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
        >
          <Search size={12} /> {loading ? "Looking up..." : "Whois"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ fontSize: "11px", color: "var(--color-error)", padding: "8px 12px", background: "rgba(196,43,28,0.08)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(196,43,28,0.25)" }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Whois result for <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{target}</span>
            </span>
            <CopyButton text={result} />
          </div>

          <div
            style={{
              flex: 1,
              background: "var(--surface-0)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "12px",
              overflow: "auto",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              lineHeight: 1.6,
              color: "var(--text-secondary)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {result
              .split("\n")
              .filter((l) => l.trim())
              .map((line, i) => {
                const isComment = line.trim().startsWith("%") || line.trim().startsWith("#");
                const colonIdx = line.indexOf(":");
                const hasKey = colonIdx > 0 && colonIdx < 30;

                if (isComment) {
                  return (
                    <div key={i} style={{ color: "var(--text-muted)" }}>{line}</div>
                  );
                }

                if (hasKey) {
                  const key = line.slice(0, colonIdx + 1);
                  const val = line.slice(colonIdx + 1);
                  return (
                    <div key={i}>
                      <span style={{ color: "var(--accent)", fontWeight: 500 }}>{key}</span>
                      <span>{val}</span>
                    </div>
                  );
                }

                return <div key={i}>{line}</div>;
              })}
          </div>
        </div>
      )}

      {!result && !error && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "12px" }}>
          Enter a domain name or IP address and press Whois.
        </div>
      )}
    </div>
  );
}

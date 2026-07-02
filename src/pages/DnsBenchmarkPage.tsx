import { useState } from "react";
import {
  Play,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  BarChart2,
} from "lucide-react";
import { useDnsBenchmark, type DnsBenchmarkResult, type DnsServer } from "../hooks/useDnsBenchmark";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rankEmoji(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

/**
 * HSL color interpolation: green (hue 120) → yellow (hue 60) → red (hue 0)
 * based on 0-indexed rank position out of total.
 */
function rankColor(index: number, total: number): string {
  if (total <= 1) return "hsl(120, 60%, 45%)";
  const t = index / (total - 1); // 0 = best (green), 1 = worst (red)
  const hue = Math.round(120 - t * 120); // 120 → 0
  const sat = 55;
  const lig = 42;
  return `hsl(${hue}, ${sat}%, ${lig}%)`;
}

function formatMs(ms: number): string {
  if (!isFinite(ms) || ms < 0) return "—";
  return `${ms.toFixed(1)} ms`;
}

function successRateColor(rate: number): string {
  if (rate >= 1.0) return "var(--color-success)";
  if (rate >= 0.5) return "var(--color-warning)";
  return "#dc3545";
}

// ─── Progress Row ─────────────────────────────────────────────────────────────

function ProgressRow({ serverName, queryIndex, totalQueries }: {
  serverName: string;
  queryIndex: number;
  totalQueries: number;
}) {
  return (
    <div
      style={{
        padding: "8px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-1)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "var(--accent)",
          animation: "spin 1s linear infinite",
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
        Testing <strong style={{ color: "var(--text-primary)" }}>{serverName}</strong>...
      </span>
      <span
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          fontFamily: "monospace",
        }}
      >
        {queryIndex + 1}/{totalQueries}
      </span>
      <div
        style={{
          flex: 1,
          height: 4,
          background: "var(--surface-3)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${((queryIndex + 1) / totalQueries) * 100}%`,
            background: "var(--accent)",
            borderRadius: 2,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

// ─── Result Row ───────────────────────────────────────────────────────────────

function ResultRow({
  result,
  rank,
  totalResults,
  maxAvg,
}: {
  result: DnsBenchmarkResult;
  rank: number;
  totalResults: number;
  maxAvg: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isFailed = result.status === "error";
  const barWidth = isFailed ? 0 : maxAvg > 0 ? Math.max(4, (result.avg_ms / maxAvg) * 100) : 0;
  const barColor = rankColor(rank - 1, totalResults);

  return (
    <>
      <tr
        onClick={() => setExpanded((v) => !v)}
        style={{
          cursor: "pointer",
          borderBottom: "1px solid var(--border)",
          background: expanded ? "var(--surface-2)" : "transparent",
        }}
        onMouseEnter={(e) => {
          if (!expanded)
            (e.currentTarget as HTMLTableRowElement).style.background = "var(--surface-1)";
        }}
        onMouseLeave={(e) => {
          if (!expanded)
            (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
        }}
      >
        {/* Expand chevron */}
        <td style={cellStyle}>
          <span style={{ color: "var(--text-muted)" }}>
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </span>
        </td>

        {/* Rank */}
        <td style={{ ...cellStyle, textAlign: "center", fontSize: 14, minWidth: 36 }}>
          {rankEmoji(rank)}
        </td>

        {/* Server name */}
        <td style={cellStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 12 }}>
              {result.server.name}
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                background: "var(--surface-3)",
                borderRadius: 3,
                padding: "1px 5px",
                display: "inline-block",
                width: "fit-content",
              }}
            >
              {result.server.category}
            </span>
          </div>
        </td>

        {/* IP */}
        <td style={cellStyle}>
          <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--accent)" }}>
            {result.server.ip}
          </span>
        </td>

        {/* Avg latency */}
        <td style={{ ...cellStyle, minWidth: 80 }}>
          {isFailed ? (
            <span style={{ fontSize: 11, color: "#dc3545" }}>Error</span>
          ) : (
            <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: barColor }}>
              {formatMs(result.avg_ms)}
            </span>
          )}
        </td>

        {/* Success rate */}
        <td style={{ ...cellStyle, minWidth: 52 }}>
          <span
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              color: successRateColor(result.success_rate),
            }}
          >
            {(result.success_rate * 100).toFixed(0)}%
          </span>
        </td>

        {/* Bar */}
        <td style={{ ...cellStyle, width: "30%", minWidth: 120 }}>
          {!isFailed && (
            <div
              style={{
                height: 8,
                background: "var(--surface-3)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${barWidth}%`,
                  background: barColor,
                  borderRadius: 4,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          )}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr style={{ background: "var(--surface-2)" }}>
          <td colSpan={7} style={{ padding: "10px 24px 14px 48px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Min / Max / Avg stats */}
              <div style={{ display: "flex", gap: 24, fontSize: 11 }}>
                <span>
                  <span style={{ color: "var(--text-muted)" }}>Min: </span>
                  <span style={{ color: "var(--color-success)", fontFamily: "monospace" }}>
                    {formatMs(result.min_ms)}
                  </span>
                </span>
                <span>
                  <span style={{ color: "var(--text-muted)" }}>Avg: </span>
                  <span style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>
                    {formatMs(result.avg_ms)}
                  </span>
                </span>
                <span>
                  <span style={{ color: "var(--text-muted)" }}>Max: </span>
                  <span style={{ color: "var(--color-warning)", fontFamily: "monospace" }}>
                    {formatMs(result.max_ms)}
                  </span>
                </span>
                <span>
                  <span style={{ color: "var(--text-muted)" }}>Packet loss: </span>
                  <span style={{ fontFamily: "monospace", color: successRateColor(result.success_rate) }}>
                    {((1 - result.success_rate) * 100).toFixed(0)}%
                  </span>
                </span>
              </div>

              {/* Individual query results */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {result.latency_ms.map((ms, i) => (
                  <span
                    key={i}
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      padding: "2px 7px",
                      borderRadius: 3,
                      background: ms < 0 ? "rgba(220,53,69,0.12)" : "var(--surface-3)",
                      border: "1px solid var(--border)",
                      color: ms < 0 ? "#dc3545" : "var(--text-secondary)",
                    }}
                  >
                    {ms < 0 ? "timeout" : `${ms.toFixed(1)} ms`}
                  </span>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Custom Server Form ───────────────────────────────────────────────────────

function CustomServerForm({ onAdd }: { onAdd: (server: DnsServer) => void }) {
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    const trimmedName = name.trim();
    const trimmedIp = ip.trim();
    if (!trimmedName) { setError("Name is required"); return; }
    if (!trimmedIp) { setError("IP is required"); return; }
    // Basic IP validation
    const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    if (!ipRegex.test(trimmedIp)) { setError("Invalid IP address"); return; }
    onAdd({ name: trimmedName, ip: trimmedIp, category: "Custom" });
    setName("");
    setIp("");
    setError(null);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={inputStyle}
      />
      <input
        type="text"
        placeholder="IP Address"
        value={ip}
        onChange={(e) => setIp(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        style={{ ...inputStyle, fontFamily: "monospace" }}
      />
      <button
        onClick={handleAdd}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 10px",
          fontSize: 11,
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <Plus size={12} /> Add
      </button>
      {error && (
        <span style={{ fontSize: 10, color: "#dc3545" }}>{error}</span>
      )}
    </div>
  );
}

// ─── Server List Manager ──────────────────────────────────────────────────────

function ServerListManager({
  servers,
  onAdd,
  onRemove,
}: {
  servers: DnsServer[];
  onAdd: (s: DnsServer) => void;
  onRemove: (ip: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-1)",
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
        DNS Servers to test ({servers.length})
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {servers.map((s) => (
          <div
            key={s.ip}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 8px",
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              fontSize: 11,
            }}
          >
            <span style={{ fontFamily: "monospace", color: "var(--accent)" }}>{s.ip}</span>
            <span style={{ color: "var(--text-muted)" }}>({s.name})</span>
            {s.category === "Custom" && (
              <button
                onClick={() => onRemove(s.ip)}
                title="Remove custom server"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  color: "var(--text-muted)",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#dc3545")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)")}
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        ))}
      </div>

      <CustomServerForm onAdd={onAdd} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DnsBenchmarkPage() {
  const benchmark = useDnsBenchmark();
  const [domain, setDomain] = useState("google.com");
  const [queryCount, setQueryCount] = useState(5);
  const [showServers, setShowServers] = useState(false);

  const isRunning = benchmark.status === "running";
  const isDone = benchmark.status === "done";

  function handleRun() {
    if (isRunning) return;
    benchmark.start(benchmark.servers, domain, queryCount);
  }

  // Best result (first after sorting) for recommendation
  const bestResult = isDone && benchmark.results.length > 0 && benchmark.results[0].status !== "error"
    ? benchmark.results[0]
    : null;

  // Max avg for bar scaling — only among successful
  const successfulResults = benchmark.results.filter((r) => r.status !== "error");
  const maxAvg = successfulResults.length > 0
    ? Math.max(...successfulResults.map((r) => r.avg_ms))
    : 1;

  // ── Dig not available: we can't detect until first run fails, but show error state
  if (benchmark.status === "error" && benchmark.error?.includes("No such file")) {
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
          dig tidak ditemukan
        </div>
        <div style={{ fontSize: 12, textAlign: "center", maxWidth: 360 }}>
          DNS Benchmark membutuhkan <code>dig</code> (dnsutils). Install dengan:
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
          sudo pacman -S bind-tools
        </code>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          atau: sudo apt install dnsutils / sudo dnf install bind-utils
        </div>
        <button
          onClick={() => benchmark.reset()}
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
          Reset
        </button>
      </div>
    );
  }

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
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
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
        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
          Test domain:
        </span>
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          disabled={isRunning}
          style={{ ...inputStyle, minWidth: 140 }}
          onKeyDown={(e) => e.key === "Enter" && handleRun()}
        />

        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
          Queries:
        </span>
        <select
          value={queryCount}
          onChange={(e) => setQueryCount(Number(e.target.value))}
          disabled={isRunning}
          style={{
            padding: "4px 8px",
            fontSize: 12,
            border: "1px solid var(--border)",
            borderRadius: 4,
            background: "var(--surface-0)",
            color: "var(--text-primary)",
          }}
        >
          <option value={3}>3</option>
          <option value={5}>5</option>
          <option value={10}>10</option>
        </select>

        <button
          onClick={handleRun}
          disabled={isRunning || benchmark.servers.length === 0}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 14px",
            fontSize: 12,
            fontWeight: 600,
            background: isRunning ? "var(--surface-3)" : "var(--accent)",
            color: isRunning ? "var(--text-muted)" : "#fff",
            border: "none",
            borderRadius: 4,
            cursor: isRunning ? "not-allowed" : "pointer",
          }}
        >
          <Play size={12} /> Run Test
        </button>

        {(isDone || benchmark.status === "error") && (
          <button
            onClick={() => benchmark.reset()}
            style={{
              padding: "5px 10px",
              fontSize: 11,
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            Reset
          </button>
        )}

        <button
          onClick={() => setShowServers((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginLeft: "auto",
            padding: "4px 10px",
            fontSize: 11,
            background: showServers ? "var(--surface-3)" : "transparent",
            border: "1px solid var(--border)",
            borderRadius: 4,
            cursor: "pointer",
            color: "var(--text-secondary)",
          }}
        >
          <BarChart2 size={12} />
          Manage Servers
          {showServers ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
      </div>

      {/* ── Server Manager (collapsible) ──────────────────────────────── */}
      {showServers && (
        <ServerListManager
          servers={benchmark.servers}
          onAdd={benchmark.addCustomServer}
          onRemove={benchmark.removeCustomServer}
        />
      )}

      {/* ── Progress row ─────────────────────────────────────────────── */}
      {isRunning && benchmark.currentProgress && (
        <ProgressRow
          serverName={benchmark.currentProgress.server_name}
          queryIndex={benchmark.currentProgress.query_index}
          totalQueries={benchmark.currentProgress.total_queries}
        />
      )}

      {/* ── Results table ────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto" }}>
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
              <th style={headerCellStyle} /> {/* expand chevron */}
              <th style={{ ...headerCellStyle, textAlign: "center" }}>Rank</th>
              <th style={headerCellStyle}>Server</th>
              <th style={headerCellStyle}>IP Address</th>
              <th style={headerCellStyle}>Avg Latency</th>
              <th style={headerCellStyle}>Success</th>
              <th style={headerCellStyle}>Bar</th>
            </tr>
          </thead>
          <tbody>
            {benchmark.results.length === 0 && !isRunning && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    textAlign: "center",
                    padding: "48px 16px",
                    color: "var(--text-muted)",
                    fontSize: 12,
                  }}
                >
                  {benchmark.status === "idle" && "Configure domain and click Run Test to start"}
                  {benchmark.status === "error" && (
                    <span style={{ color: "#dc3545" }}>
                      Error: {benchmark.error}
                    </span>
                  )}
                </td>
              </tr>
            )}

            {benchmark.results.map((result, index) => (
              <ResultRow
                key={result.server.ip}
                result={result}
                rank={index + 1}
                totalResults={benchmark.results.length}
                maxAvg={maxAvg}
              />
            ))}

            {/* Placeholder rows while running — for servers not yet done */}
            {isRunning && benchmark.currentProgress && (() => {
              const doneCount = benchmark.results.length;
              const totalCount = benchmark.currentProgress.total_servers;
              const pendingCount = totalCount - doneCount - 1; // -1 for in-progress server
              return pendingCount > 0
                ? Array.from({ length: pendingCount }, (_, i) => (
                    <tr key={`pending-${i}`} style={{ opacity: 0.35 }}>
                      <td colSpan={7} style={{ ...cellStyle, padding: "10px 16px" }}>
                        <div
                          style={{
                            height: 12,
                            borderRadius: 6,
                            background: "var(--surface-3)",
                            width: `${60 - i * 8}%`,
                          }}
                        />
                      </td>
                    </tr>
                  ))
                : null;
            })()}
          </tbody>
        </table>
      </div>

      {/* ── Recommendation banner ─────────────────────────────────────── */}
      {isDone && bestResult && (
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid var(--border)",
            background: "rgba(0, 200, 83, 0.07)",
            borderBottom: "1px solid rgba(0, 200, 83, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
            fontSize: 12,
          }}
        >
          <span style={{ fontSize: 16 }}>✅</span>
          <span>
            <strong style={{ color: "var(--text-primary)" }}>Rekomendasi:</strong>{" "}
            <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
              {bestResult.server.name} ({bestResult.server.ip})
            </span>{" "}
            <span style={{ color: "var(--text-secondary)" }}>
              — latency terendah ({formatMs(bestResult.avg_ms)}, success rate{" "}
              {(bestResult.success_rate * 100).toFixed(0)}%)
            </span>
          </span>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────── */}
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
          alignItems: "center",
        }}
      >
        <span>{benchmark.servers.length} server(s) configured</span>
        {benchmark.results.length > 0 && (
          <span>{benchmark.results.length} tested</span>
        )}
        {isRunning && benchmark.currentProgress && (
          <span style={{ color: "var(--accent)" }}>
            Testing {benchmark.currentProgress.server_index + 1}/{benchmark.currentProgress.total_servers}...
          </span>
        )}
        {isDone && <span style={{ color: "var(--color-success)" }}>Benchmark complete</span>}
      </div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const cellStyle: React.CSSProperties = {
  padding: "7px 10px",
  color: "var(--text-primary)",
  verticalAlign: "middle",
};

const headerCellStyle: React.CSSProperties = {
  padding: "7px 10px",
  textAlign: "left",
  fontWeight: 600,
  color: "var(--text-secondary)",
  borderBottom: "1px solid var(--border)",
  fontSize: 11,
  whiteSpace: "nowrap",
};

const inputStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 12,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--surface-0)",
  color: "var(--text-primary)",
  outline: "none",
};

import { useState } from "react";
import { Calculator } from "lucide-react";
import CopyButton from "../shared/CopyButton";

interface CidrResult {
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalHosts: number;
  subnetMask: string;
  prefix: number;
}

function ipToNum(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    throw new Error("Invalid IP");
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function numToIp(n: number): string {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join(".");
}

function maskToPrefix(mask: string): number {
  const num = ipToNum(mask);
  // Count leading 1-bits
  let count = 0;
  let n = num;
  while (n & 0x80000000) { count++; n = (n << 1) >>> 0; }
  // Validate: remaining bits must be 0
  const expected = count === 0 ? 0 : ((0xffffffff << (32 - count)) >>> 0);
  if (expected !== num) throw new Error("Invalid subnet mask");
  return count;
}

function calculate(input: string): CidrResult {
  let ip: string, prefix: number;

  if (input.includes("/")) {
    const [ipPart, prefixPart] = input.split("/");
    ip = ipPart.trim();
    prefix = parseInt(prefixPart.trim(), 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 32) throw new Error("Prefix must be 0–32");
  } else if (input.includes(" ")) {
    // "192.168.1.0 255.255.255.0" format
    const [ipPart, maskPart] = input.trim().split(/\s+/);
    ip = ipPart;
    prefix = maskToPrefix(maskPart);
  } else {
    throw new Error("Enter CIDR (e.g. 192.168.1.0/24) or IP + mask");
  }

  const ipNum = ipToNum(ip);
  const maskNum = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  const networkNum = (ipNum & maskNum) >>> 0;
  const broadcastNum = (networkNum | (~maskNum >>> 0)) >>> 0;

  const totalHosts = prefix >= 31 ? Math.pow(2, 32 - prefix) : Math.pow(2, 32 - prefix) - 2;
  const firstHost = prefix >= 31 ? networkNum : networkNum + 1;
  const lastHost = prefix >= 31 ? broadcastNum : broadcastNum - 1;

  return {
    network: numToIp(networkNum),
    broadcast: numToIp(broadcastNum),
    firstHost: numToIp(firstHost),
    lastHost: numToIp(lastHost),
    totalHosts: Math.max(0, totalHosts),
    subnetMask: numToIp(maskNum),
    prefix,
  };
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-primary)" }}>{value}</span>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

export default function IpCalculatorPanel() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<CidrResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = () => {
    setError(null);
    setResult(null);
    try {
      setResult(calculate(input.trim()));
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px" }}>
      {/* Input */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCalculate()}
          placeholder="CIDR notation, e.g. 192.168.1.0/24"
          style={{ flex: 1, padding: "5px 10px", background: "var(--surface-3)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "12px", fontFamily: "var(--font-mono)", outline: "none" }}
        />
        <button
          onClick={handleCalculate}
          style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 14px", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: 500, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}
        >
          <Calculator size={12} />
          Calculate
        </button>
      </div>

      {error && (
        <div style={{ fontSize: "11px", color: "var(--color-error)", padding: "6px 10px", background: "rgba(196,43,28,0.1)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(196,43,28,0.3)" }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "12px 16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
            /{result.prefix} — {result.subnetMask}
          </div>
          <ResultRow label="Network Address"  value={result.network} />
          <ResultRow label="Broadcast Address" value={result.broadcast} />
          <ResultRow label="First Host"        value={result.firstHost} />
          <ResultRow label="Last Host"         value={result.lastHost} />
          <ResultRow label="Subnet Mask"       value={result.subnetMask} />
          <ResultRow label="Total Hosts"       value={result.totalHosts.toLocaleString()} />
        </div>
      )}

      {!result && !error && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "12px" }}>
          Enter a CIDR address like <code style={{ fontFamily: "var(--font-mono)", margin: "0 4px", color: "var(--text-secondary)" }}>192.168.1.0/24</code> and press Calculate.
        </div>
      )}
    </div>
  );
}

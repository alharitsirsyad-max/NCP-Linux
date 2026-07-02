import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Power, Plus, Trash2, Zap, Info, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WolTarget {
  name: string;
  mac: string;
  broadcast: string;
  port: number;
}

// ─── Toast (lightweight — reuse existing toast system isn't wired here) ───────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--text-primary)",
        color: "var(--surface-0)",
        padding: "8px 18px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        zIndex: 9999,
        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        maxWidth: 420,
        pointerEvents: "none",
      }}
    >
      {message}
    </div>
  );
}

// ─── MAC Validation ───────────────────────────────────────────────────────────

function isMacValid(mac: string): boolean {
  const clean = mac.replace(/[:\-\.]/g, "");
  return /^[0-9a-fA-F]{12}$/.test(clean);
}

function isIpValid(ip: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);
}

// ─── Add Device Modal ─────────────────────────────────────────────────────────

interface AddModalProps {
  initialMac?: string;
  onSave: (target: WolTarget) => void;
  onClose: () => void;
}

function AddDeviceModal({ initialMac = "", onSave, onClose }: AddModalProps) {
  const [name, setName] = useState("");
  const [mac, setMac] = useState(initialMac);
  const [broadcast, setBroadcast] = useState("255.255.255.255");
  const [port, setPort] = useState("9");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const overlayRef = useRef<HTMLDivElement>(null);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!isMacValid(mac)) errs.mac = "Invalid MAC address format";
    if (!isIpValid(broadcast)) errs.broadcast = "Invalid IP address";
    const p = Number(port);
    if (!port || isNaN(p) || p < 1 || p > 65535) errs.port = "Port must be 1–65535";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ name: name.trim(), mac: mac.trim(), broadcast: broadcast.trim(), port: Number(port) });
  }

  // Close on backdrop click
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9000,
      }}
    >
      <div
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 24,
          width: 360,
          boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            Add Device
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
            <X size={14} />
          </button>
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Device Name" error={errors.name}>
            <input
              autoFocus
              type="text"
              placeholder="e.g. PC Lab 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="MAC Address" error={errors.mac} hint="Format: aa:bb:cc:dd:ee:ff">
            <input
              type="text"
              placeholder="e4:5f:01:ab:cd:12"
              value={mac}
              onChange={(e) => setMac(e.target.value)}
              style={{ ...inputStyle, fontFamily: "monospace" }}
            />
          </Field>
          <Field label="Broadcast IP" error={errors.broadcast} hint="Usually 255.255.255.255 or your subnet broadcast">
            <input
              type="text"
              placeholder="255.255.255.255"
              value={broadcast}
              onChange={(e) => setBroadcast(e.target.value)}
              style={{ ...inputStyle, fontFamily: "monospace" }}
            />
          </Field>
          <Field label="Port" error={errors.port} hint="Default is 9">
            <input
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              style={{ ...inputStyle, width: 80 }}
            />
          </Field>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={btnSecondaryStyle}>Cancel</button>
          <button onClick={handleSave} style={btnPrimaryStyle}>
            <Plus size={12} /> Add Device
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>
        {label}
      </label>
      {children}
      {error && <span style={{ fontSize: 10, color: "#dc3545" }}>{error}</span>}
      {!error && hint && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{hint}</span>}
    </div>
  );
}

// ─── Device Card ──────────────────────────────────────────────────────────────

interface DeviceCardProps {
  target: WolTarget;
  onWake: (t: WolTarget) => void;
  onDelete: (mac: string) => void;
  waking: boolean;
}

function DeviceCard({ target, onWake, onDelete, waking }: DeviceCardProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)")
      }
    >
      {/* Device icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: "var(--surface-3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 16,
        }}
      >
        💻
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {target.name}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
          {target.mac}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
          Broadcast: {target.broadcast}:{target.port}
        </div>
      </div>

      {/* Wake button */}
      <button
        onClick={() => onWake(target)}
        disabled={waking}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 12px",
          fontSize: 11,
          fontWeight: 600,
          background: waking ? "var(--surface-3)" : "var(--accent)",
          color: waking ? "var(--text-muted)" : "#fff",
          border: "none",
          borderRadius: 4,
          cursor: waking ? "not-allowed" : "pointer",
          flexShrink: 0,
        }}
      >
        <Power size={12} />
        {waking ? "Sending..." : "Wake"}
      </button>

      {/* Delete button */}
      <button
        onClick={() => onDelete(target.mac)}
        title="Remove device"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          padding: 4,
          borderRadius: 4,
          flexShrink: 0,
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color = "#dc3545")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)")
        }
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WolPage() {
  const [targets, setTargets] = useState<WolTarget[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addInitialMac, setAddInitialMac] = useState("");
  const [wakingMac, setWakingMac] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Quick Wake state
  const [quickMac, setQuickMac] = useState("");
  const [quickMacError, setQuickMacError] = useState<string | null>(null);
  const [quickWaking, setQuickWaking] = useState(false);

  // Load saved targets on mount
  useEffect(() => {
    invoke<WolTarget[]>("load_wol_targets")
      .then((data) => setTargets(data))
      .catch(() => {}); // silently ignore if file doesn't exist

    // Check if LAN Scanner pre-filled a MAC via sessionStorage
    const prefill = sessionStorage.getItem("wol_prefill_mac");
    if (prefill) {
      sessionStorage.removeItem("wol_prefill_mac");
      setAddInitialMac(prefill);
      setShowAddModal(true);
    }
  }, []);

  // If parent pre-fills a MAC (from LAN Scanner context menu)
  useEffect(() => {
    if (prefillMac) {
      setAddInitialMac(prefillMac);
      setShowAddModal(true);
    }
  }, [prefillMac]);

  async function persistTargets(updated: WolTarget[]) {
    setTargets(updated);
    await invoke("save_wol_targets", { targets: updated }).catch(() => {});
  }

  function handleAddDevice(target: WolTarget) {
    const updated = [...targets, target];
    persistTargets(updated);
    setShowAddModal(false);
    showToast(`Device "${target.name}" added`);
  }

  function handleDelete(mac: string) {
    const updated = targets.filter((t) => t.mac !== mac);
    persistTargets(updated);
  }

  async function handleWake(target: WolTarget) {
    setWakingMac(target.mac);
    try {
      const msg = await invoke<string>("send_wol", { target });
      showToast(`⚡ ${msg}`);
    } catch (err) {
      showToast(`Error: ${String(err)}`);
    } finally {
      setWakingMac(null);
    }
  }

  async function handleQuickWake() {
    if (!isMacValid(quickMac)) {
      setQuickMacError("Invalid MAC address format");
      return;
    }
    setQuickMacError(null);
    setQuickWaking(true);
    try {
      const msg = await invoke<string>("send_wol", {
        target: {
          name: "Quick Wake",
          mac: quickMac.trim(),
          broadcast: "255.255.255.255",
          port: 9,
        },
      });
      showToast(`⚡ ${msg}`);
      setQuickMac("");
    } catch (err) {
      showToast(`Error: ${String(err)}`);
    } finally {
      setQuickWaking(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
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
      {/* ── Main content area ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── Saved Devices ───────────────────────────────────────────────── */}
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Saved Devices
            </div>
            <button
              onClick={() => { setAddInitialMac(""); setShowAddModal(true); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 12px",
                fontSize: 11,
                fontWeight: 600,
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              <Plus size={12} /> Add Device
            </button>
          </div>

          {targets.length === 0 ? (
            <div
              style={{
                padding: "28px 16px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 12,
                background: "var(--surface-1)",
                border: "1px dashed var(--border)",
                borderRadius: 6,
              }}
            >
              No saved devices yet. Click "Add Device" to add one.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {targets.map((t) => (
                <DeviceCard
                  key={t.mac}
                  target={t}
                  onWake={handleWake}
                  onDelete={handleDelete}
                  waking={wakingMac === t.mac}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Quick Wake ───────────────────────────────────────────────────── */}
        <section>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
            Quick Wake (tanpa simpan)
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <input
                type="text"
                placeholder="MAC address  e.g. e4:5f:01:ab:cd:12"
                value={quickMac}
                onChange={(e) => { setQuickMac(e.target.value); setQuickMacError(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleQuickWake()}
                style={{
                  ...inputStyle,
                  fontFamily: "monospace",
                  width: 260,
                  borderColor: quickMacError ? "#dc3545" : undefined,
                }}
              />
              {quickMacError && (
                <span style={{ fontSize: 10, color: "#dc3545" }}>{quickMacError}</span>
              )}
            </div>
            <button
              onClick={handleQuickWake}
              disabled={quickWaking || !quickMac}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 600,
                background: quickWaking ? "var(--surface-3)" : "var(--accent)",
                color: quickWaking ? "var(--text-muted)" : "#fff",
                border: "none",
                borderRadius: 4,
                cursor: quickWaking ? "not-allowed" : "pointer",
              }}
            >
              <Zap size={12} />
              {quickWaking ? "Sending..." : "Send Magic Packet"}
            </button>
          </div>
        </section>

        {/* ── Info banner ─────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "12px 16px",
            background: "rgba(0, 103, 184, 0.06)",
            border: "1px solid rgba(0, 103, 184, 0.2)",
            borderRadius: 6,
            fontSize: 11,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}
        >
          <Info size={14} style={{ flexShrink: 0, marginTop: 1, color: "var(--accent)" }} />
          <div>
            <strong style={{ color: "var(--text-primary)" }}>Syarat Wake-on-LAN:</strong>
            <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
              <li>Perangkat harus mendukung fitur Wake-on-LAN di BIOS/UEFI</li>
              <li>Perangkat harus terhubung ke jaringan yang sama (kabel, bukan Wi-Fi)</li>
              <li>WoL harus diaktifkan di pengaturan OS/NIC (ethtool -s eth0 wol g)</li>
              <li>Magic packet dikirim via UDP broadcast — tidak ada konfirmasi berhasil/gagal</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Add Device Modal ─────────────────────────────────────────────── */}
      {showAddModal && (
        <AddDeviceModal
          initialMac={addInitialMac}
          onSave={handleAddDevice}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: "5px 9px",
  fontSize: 12,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--surface-0)",
  color: "var(--text-primary)",
  outline: "none",
};

const btnPrimaryStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "6px 14px",
  fontSize: 12,
  fontWeight: 600,
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
};

const btnSecondaryStyle: React.CSSProperties = {
  padding: "6px 14px",
  fontSize: 12,
  background: "var(--surface-3)",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  cursor: "pointer",
};

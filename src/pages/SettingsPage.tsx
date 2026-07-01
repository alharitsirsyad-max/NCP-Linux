import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore, DEFAULT_SETTINGS, type TerminalEmulator } from "../stores/settingsStore";
import { toast } from "../stores/toastStore";
import { Save, RotateCcw, ExternalLink } from "lucide-react";

const TERMINAL_OPTIONS: { value: TerminalEmulator; label: string }[] = [
  { value: "auto",          label: "Auto-detect" },
  { value: "kitty",         label: "Kitty" },
  { value: "alacritty",     label: "Alacritty" },
  { value: "gnome-terminal", label: "GNOME Terminal" },
  { value: "xterm",         label: "XTerm" },
];

interface FieldProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function Field({ label, description, children }: FieldProps) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "4px" }}>{label}</div>
      {description && (
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>{description}</div>
      )}
      {children}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "12px", marginTop: "20px", paddingBottom: "6px", borderBottom: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  background: "var(--surface-3)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  fontSize: "12px",
  fontFamily: "var(--font-mono)",
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: "var(--font-sans)",
  cursor: "pointer",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-strong)",
};

export default function SettingsPage() {
  const { settings, setSettings, resetSettings } = useSettingsStore();

  // Local state to track unsaved changes
  const [local, setLocal] = useState({ ...settings });
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const patch = (key: keyof typeof local, value: string | number) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // Validate refresh interval
    const interval = Number(local.adapterRefreshInterval);
    if (!Number.isInteger(interval) || interval < 1 || interval > 60) {
      setRefreshError("Interval must be 1–60 seconds.");
      return;
    }
    setRefreshError(null);
    setSettings(local);
    toast.success("Settings saved.");
  };

  const handleReset = () => {
    resetSettings();
    setLocal({ ...DEFAULT_SETTINGS });
    toast.info("Settings reset to defaults.");
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", maxWidth: "560px" }}>
      <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Settings</div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px" }}>Configure Network Control Panel preferences.</div>

      {/* External Tools */}
      <SectionHeader>External Tools</SectionHeader>

      <Field label="WinBox Binary Path" description="Full path to the WinBox executable (optional).">
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={local.winboxPath}
            onChange={(e) => patch("winboxPath", e.target.value)}
            placeholder="/opt/winbox/winbox"
            style={inputStyle}
          />
          <button
            onClick={async () => {
              try { await invoke("launch_winbox", { path: local.winboxPath }); toast.success("WinBox launched."); }
              catch (e) { toast.error(String(e)); }
            }}
            disabled={!local.winboxPath}
            title="Launch WinBox"
            style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 12px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--radius-sm)", fontSize: "11px", cursor: local.winboxPath ? "pointer" : "not-allowed", opacity: local.winboxPath ? 1 : 0.5, whiteSpace: "nowrap" }}
          >
            <ExternalLink size={11} /> Launch
          </button>
        </div>
      </Field>

      <Field label="Cisco Packet Tracer Binary Path" description="Full path to the Packet Tracer executable (optional).">
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={local.packetTracerPath}
            onChange={(e) => patch("packetTracerPath", e.target.value)}
            placeholder="/opt/pt/bin/PacketTracer"
            style={inputStyle}
          />
          <button
            onClick={async () => {
              try { await invoke("launch_packet_tracer", { path: local.packetTracerPath }); toast.success("Packet Tracer launched."); }
              catch (e) { toast.error(String(e)); }
            }}
            disabled={!local.packetTracerPath}
            title="Launch Cisco Packet Tracer"
            style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 12px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--radius-sm)", fontSize: "11px", cursor: local.packetTracerPath ? "pointer" : "not-allowed", opacity: local.packetTracerPath ? 1 : 0.5, whiteSpace: "nowrap" }}
          >
            <ExternalLink size={11} /> Launch
          </button>
        </div>
      </Field>

      <Field label="Terminal Emulator" description="Terminal used by 'Open Terminal' actions.">
        <select
          value={local.terminalEmulator}
          onChange={(e) => patch("terminalEmulator", e.target.value as TerminalEmulator)}
          style={selectStyle}
        >
          {TERMINAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>

      {/* Behaviour */}
      <SectionHeader>Behaviour</SectionHeader>

      <Field
        label="Adapter List Refresh Interval"
        description="How often the adapter list refreshes. Value: 1–60 seconds."
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="number"
            min={1}
            max={60}
            value={local.adapterRefreshInterval}
            onChange={(e) => { patch("adapterRefreshInterval", Number(e.target.value)); setRefreshError(null); }}
            style={{ ...inputStyle, width: "80px" }}
          />
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>seconds</span>
        </div>
        {refreshError && <div style={{ fontSize: "11px", color: "var(--color-error)", marginTop: "4px" }}>{refreshError}</div>}
      </Field>

      {/* Keyboard shortcuts reference */}
      <SectionHeader>Keyboard Shortcuts</SectionHeader>
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
        {[
          ["Ctrl+R / F5", "Refresh current page"],
          ["Ctrl+D",      "Open Diagnostics"],
          ["Ctrl+,",      "Open Settings"],
        ].map(([key, desc]) => (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "7px 12px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent)" }}>{key}</span>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{desc}</span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "8px", marginTop: "24px" }}>
        <button
          onClick={handleSave}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 18px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}
        >
          <Save size={13} /> Save Settings
        </button>
        <button
          onClick={handleReset}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", fontSize: "12px", cursor: "pointer" }}
        >
          <RotateCcw size={13} /> Reset Defaults
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";
import {
  Settings, Plug, PlugZap, RefreshCw, Terminal,
  Stethoscope, LayoutDashboard, Loader,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "../../stores/uiStore";
import { useAdapters } from "../../hooks/useAdapters";
import { mockAdapters } from "../../mock/adapters";
import ConfirmDialog from "../shared/ConfirmDialog";
import AdapterPropertiesDialog from "../adapters/AdapterPropertiesDialog";
import { toast } from "../../stores/toastStore";

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  onClick?: () => void;
}

function ToolButton({ icon, label, danger, disabled, loading, title, onClick }: ToolButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick ?? (() => {})}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      title={title ?? label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2px",
        padding: "0 10px",
        height: "100%",
        background: hovered && !disabled ? "var(--surface-3)" : "transparent",
        border: hovered && !disabled ? "1px solid var(--border-strong)" : "1px solid transparent",
        borderRadius: "var(--radius-sm)",
        cursor: disabled ? "not-allowed" : "pointer",
        color: disabled
          ? "var(--text-muted)"
          : danger
          ? "var(--color-error)"
          : "var(--text-primary)",
        opacity: disabled ? 0.45 : 1,
        transition: "background 0.1s, border 0.1s",
        minWidth: "52px",
      }}
    >
      <span style={{ lineHeight: 1 }}>
        {loading ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : icon}
      </span>
      <span style={{ fontSize: "10px", lineHeight: 1, whiteSpace: "nowrap" }}>{label}</span>
    </button>
  );
}

function Separator() {
  return (
    <div style={{ width: "1px", height: "24px", background: "var(--border-strong)", margin: "0 4px", flexShrink: 0 }} />
  );
}

export default function ToolBar() {
  const { selectedAdapter, setSelectedPage } = useUIStore();
  const queryClient = useQueryClient();
  const { data } = useAdapters();
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const adapters = data ?? mockAdapters;
  const currentAdapter = adapters.find((a) => a.name === selectedAdapter);
  const adapterState = currentAdapter?.state ?? null;
  const isLoopback = currentAdapter?.adapter_type === "loopback";

  // State-aware button logic
  const isConnected    = adapterState === "connected";
  const isDisconnected = adapterState === "disconnected";

  // Enable: only clickable if currently disconnected and not loopback
  const canEnable  = isDisconnected && !isLoopback && loadingAction === null;
  // Disable: only clickable if currently connected and not loopback
  const canDisable = isConnected   && !isLoopback && loadingAction === null;
  // Properties & Renew: need any adapter selected
  const hasAdapter = !!selectedAdapter && !isLoopback;

  const enableTitle = !selectedAdapter
    ? "Select an adapter first"
    : isLoopback
    ? "Cannot enable/disable loopback"
    : isConnected
    ? "Adapter is already enabled"
    : "Enable adapter";

  const disableTitle = !selectedAdapter
    ? "Select an adapter first"
    : isLoopback
    ? "Cannot enable/disable loopback"
    : isDisconnected
    ? "Adapter is already disabled"
    : "Disable adapter";

  const handleEnable = async () => {
    if (!selectedAdapter || !canEnable) return;
    setLoadingAction("enable");
    try {
      await invoke("enable_adapter", { iface: selectedAdapter });
      await queryClient.invalidateQueries({ queryKey: ["adapters"] });
      toast.success(`${selectedAdapter} enabled.`);
    } catch (e) {
      toast.error(`Enable failed: ${e}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDisableConfirmed = async () => {
    setShowDisableConfirm(false);
    if (!selectedAdapter || !canDisable) return;
    setLoadingAction("disable");
    try {
      await invoke("disable_adapter", { iface: selectedAdapter });
      await queryClient.invalidateQueries({ queryKey: ["adapters"] });
      toast.success(`${selectedAdapter} disabled.`);
    } catch (e) {
      toast.error(`Disable failed: ${e}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRenewDhcp = async () => {
    if (!hasAdapter) return;
    setLoadingAction("renew");
    try {
      await invoke("renew_dhcp", { iface: selectedAdapter });
      await queryClient.invalidateQueries({ queryKey: ["adapters"] });
      toast.success(`DHCP renewed for ${selectedAdapter}.`);
    } catch (e) {
      toast.error(`Renew DHCP failed: ${e}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleOpenTerminal = async () => {
    try { await invoke("open_terminal"); }
    catch (e) { toast.error(String(e)); }
  };

  return (
    <>
      <div
        style={{
          height: "var(--toolbar-height)",
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          padding: "0 6px",
          gap: "2px",
          flexShrink: 0,
        }}
      >
        {/* Properties — opens dialog */}
        <ToolButton
          icon={<Settings size={14} />}
          label="Properties"
          disabled={!currentAdapter}
          title={currentAdapter ? `Properties: ${currentAdapter.display_name}` : "Select an adapter first"}
          onClick={() => currentAdapter && setShowProperties(true)}
        />

        {/* Enable — only active when adapter is disconnected */}
        <ToolButton
          icon={<Plug size={14} />}
          label="Enable"
          disabled={!canEnable}
          loading={loadingAction === "enable"}
          title={enableTitle}
          onClick={handleEnable}
        />

        {/* Disable — only active when adapter is connected */}
        <ToolButton
          icon={<PlugZap size={14} />}
          label="Disable"
          danger={canDisable}
          disabled={!canDisable}
          loading={loadingAction === "disable"}
          title={disableTitle}
          onClick={() => canDisable && setShowDisableConfirm(true)}
        />

        <Separator />

        <ToolButton
          icon={<RefreshCw size={14} />}
          label="Renew DHCP"
          disabled={!hasAdapter || !isConnected || loadingAction !== null}
          loading={loadingAction === "renew"}
          onClick={handleRenewDhcp}
        />
        <ToolButton
          icon={<Terminal size={14} />}
          label="Terminal"
          onClick={handleOpenTerminal}
        />

        <Separator />

        <ToolButton
          icon={<Stethoscope size={14} />}
          label="Diagnostics"
          onClick={() => setSelectedPage("diagnostics")}
        />
        <ToolButton
          icon={<LayoutDashboard size={14} />}
          label="Dashboard"
          onClick={() => setSelectedPage("dashboard")}
        />
      </div>

      {showDisableConfirm && (
        <ConfirmDialog
          title="Disable Adapter"
          message={`Disable "${currentAdapter?.display_name ?? selectedAdapter}"? This will disconnect it from the network.`}
          confirmLabel="Disable"
          dangerous
          onConfirm={handleDisableConfirmed}
          onCancel={() => setShowDisableConfirm(false)}
        />
      )}

      {showProperties && currentAdapter && (
        <AdapterPropertiesDialog
          adapter={currentAdapter}
          onClose={() => setShowProperties(false)}
        />
      )}
    </>
  );
}

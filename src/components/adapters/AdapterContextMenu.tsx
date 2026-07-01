import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "../../stores/uiStore";
import { toast } from "../../stores/toastStore";
import type { NetworkAdapter } from "../../types/network";

interface MenuItem {
  label: string;
  action?: () => void;
  danger?: boolean;
  separator?: false;
}

interface SeparatorItem {
  separator: true;
}

type MenuEntry = MenuItem | SeparatorItem;

interface AdapterContextMenuProps {
  adapter: NetworkAdapter;
  x: number;
  y: number;
  onClose: () => void;
}

export default function AdapterContextMenu({ adapter, x, y, onClose }: AdapterContextMenuProps) {
  const { openDiagnostics } = useUIStore();
  const queryClient = useQueryClient();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const copy = (text: string | null) => {
    if (text) navigator.clipboard.writeText(text);
    onClose();
  };

  // Navigate to Diagnostics ping tab with target pre-filled via store
  const pingTo = (target: string | null) => {
    if (!target) return;
    openDiagnostics("ping", target);
    onClose();
  };

  const runAdapter = async (cmd: string) => {
    onClose();
    try {
      await invoke(cmd, { iface: adapter.name });
      queryClient.invalidateQueries({ queryKey: ["adapters"] });
    } catch (e) {
      toast.error(`${cmd} failed: ${e}`);
    }
  };

  const openTerminal = async () => {
    onClose();
    try { await invoke("open_terminal"); }
    catch (e) { toast.error(String(e)); }
  };

  const isConnected = adapter.state === "connected";

  const items: MenuEntry[] = [
    { label: "Copy IPv4",    action: () => copy(adapter.ipv4) },
    { label: "Copy IPv6",    action: () => copy(adapter.ipv6) },
    { label: "Copy Gateway", action: () => copy(adapter.gateway) },
    { label: "Copy DNS",     action: () => copy(adapter.dns.join(", ")) },
    { label: "Copy MAC",     action: () => copy(adapter.mac) },
    { separator: true },
    { label: isConnected ? "Disable" : "Enable", action: () => runAdapter(isConnected ? "disable_adapter" : "enable_adapter"), danger: isConnected },
    { label: "Renew DHCP",   action: () => runAdapter("renew_dhcp") },
    { separator: true },
    { label: "Ping Gateway",      action: () => pingTo(adapter.gateway) },
    { label: "Ping 8.8.8.8",      action: () => pingTo("8.8.8.8") },
    { label: "Traceroute 8.8.8.8", action: () => { openDiagnostics("traceroute"); onClose(); } },
    { separator: true },
    { label: "Open Terminal", action: openTerminal },
  ];

  const menuWidth = 200;
  const menuHeight = items.length * 28;
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8);

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: clampedY,
        left: clampedX,
        width: menuWidth,
        background: "var(--surface-1)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-sm)",
        boxShadow: "rgba(0,0,0,0.13) 0px 3px 7px, rgba(0,0,0,0.11) 0px 1px 2px",
        zIndex: 9999,
        padding: "4px 0",
        overflow: "hidden",
      }}
    >
      {items.map((item, i) => {
        if ("separator" in item && item.separator) {
          return <div key={i} style={{ height: "1px", background: "var(--border)", margin: "4px 0" }} />;
        }
        const menuItem = item as MenuItem;
        return (
          <button
            key={i}
            onClick={menuItem.action}
            style={{
              width: "100%",
              padding: "5px 14px",
              textAlign: "left",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              color: menuItem.danger ? "var(--color-error)" : "var(--text-secondary)",
              display: "block",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--accent)";
              (e.currentTarget as HTMLButtonElement).style.color = "white";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = menuItem.danger ? "var(--color-error)" : "var(--text-secondary)";
            }}
          >
            {menuItem.label}
          </button>
        );
      })}
    </div>
  );
}

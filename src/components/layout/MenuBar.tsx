import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "../../stores/uiStore";
import { toast } from "../../stores/toastStore";

interface MenuItemDef {
  label: string;
  shortcut?: string;
  separator?: false;
  action: () => void;
}

interface SeparatorDef {
  separator: true;
}

type MenuEntry = MenuItemDef | SeparatorDef;

interface MenuDef {
  label: string;
  items: MenuEntry[];
}

export default function MenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { setSelectedPage, selectedAdapter, openDiagnostics } = useUIStore();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const menus: MenuDef[] = [
    {
      label: "File",
      items: [
        {
          label: "Exit",
          action: () => getCurrentWindow().close(),
        },
      ],
    },
    {
      label: "View",
      items: [
        {
          label: "Refresh",
          shortcut: "Ctrl+R",
          action: () => {
            queryClient.invalidateQueries({ queryKey: ["adapters"] });
            toast.info("Refreshing...");
          },
        },
        {
          label: "Dashboard",
          action: () => { setSelectedPage("dashboard"); setOpenMenu(null); },
        },
        {
          label: "Adapters",
          action: () => { setSelectedPage("adapters"); setOpenMenu(null); },
        },
      ],
    },
    {
      label: "Tools",
      items: [
        {
          label: "Diagnostics",
          shortcut: "Ctrl+D",
          action: () => { openDiagnostics("ping"); setOpenMenu(null); },
        },
        {
          label: "DNS Lookup",
          action: () => { openDiagnostics("dns"); setOpenMenu(null); },
        },
        {
          label: "IP Calculator",
          action: () => { openDiagnostics("calculator"); setOpenMenu(null); },
        },
        { separator: true },
        {
          label: "Routing Table",
          action: () => { setSelectedPage("routing"); setOpenMenu(null); },
        },
        {
          label: "ARP Table",
          action: () => { setSelectedPage("arp"); setOpenMenu(null); },
        },
        {
          label: "Open Ports",
          action: () => { setSelectedPage("ports"); setOpenMenu(null); },
        },
        { separator: true },
        {
          label: "Open Terminal",
          action: async () => {
            setOpenMenu(null);
            try { await invoke("open_terminal"); }
            catch (e) { toast.error(String(e)); }
          },
        },
        {
          label: "SSH Quick Connect",
          action: () => { setSelectedPage("ssh"); setOpenMenu(null); },
        },
        {
          label: "Open Wireshark",
          action: async () => {
            setOpenMenu(null);
            try {
              await invoke("launch_wireshark", { iface: selectedAdapter ?? null });
            } catch (e) {
              toast.error(String(e));
            }
          },
        },
      ],
    },
    {
      label: "Help",
      items: [
        {
          label: "Settings",
          shortcut: "Ctrl+,",
          action: () => { setSelectedPage("settings"); setOpenMenu(null); },
        },
        { separator: true },
        {
          label: "About Network Control Panel",
          action: () => {
            toast.info("Network Control Panel v0.1.0 — Built with Tauri v2 + React");
            setOpenMenu(null);
          },
        },
      ],
    },
  ];

  return (
    <div
      ref={barRef}
      style={{
        height: "var(--menubar-height)",
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        paddingLeft: "4px",
        flexShrink: 0,
        position: "relative",
        zIndex: 100,
      }}
    >
      {menus.map((menu) => (
        <div key={menu.label} style={{ position: "relative" }}>
          {/* Menu trigger */}
          <button
            onMouseDown={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
            onMouseEnter={() => openMenu !== null && setOpenMenu(menu.label)}
            style={{
              height: "var(--menubar-height)",
              padding: "0 10px",
              background: openMenu === menu.label ? "var(--accent)" : "transparent",
              color: openMenu === menu.label ? "var(--on-accent)" : "var(--text-secondary)",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              transition: "background 0.1s",
            }}
          >
            {menu.label}
          </button>

          {/* Dropdown */}
          {openMenu === menu.label && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                minWidth: "200px",
                background: "var(--surface-0)",
                border: "1px solid var(--border-strong)",
                boxShadow: "rgba(0,0,0,0.13) 0px 3px 7px, rgba(0,0,0,0.11) 0px 1px 2px",
                zIndex: 9999,
                padding: "4px 0",
              }}
            >
              {menu.items.map((item, i) => {
                if ("separator" in item && item.separator) {
                  return <div key={i} style={{ height: "1px", background: "var(--border)", margin: "4px 0" }} />;
                }
                const menuItem = item as MenuItemDef;
                return (
                  <DropdownItem
                    key={i}
                    label={menuItem.label}
                    shortcut={menuItem.shortcut}
                    onClick={() => { menuItem.action(); setOpenMenu(null); }}
                  />
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DropdownItem({ label, shortcut, onClick }: { label: string; shortcut?: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "5px 16px",
        background: hovered ? "var(--accent)" : "transparent",
        color: hovered ? "var(--on-accent)" : "var(--text-secondary)",
        border: "none",
        cursor: "pointer",
        fontSize: "12px",
        textAlign: "left",
      }}
    >
      <span>{label}</span>
      {shortcut && (
        <span style={{ fontSize: "10px", opacity: 0.7, marginLeft: "24px" }}>
          {shortcut}
        </span>
      )}
    </button>
  );
}

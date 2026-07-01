import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "../stores/uiStore";

export function useKeyboardShortcuts() {
  const { selectedPage, setSelectedPage } = useUIStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire inside inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+R or F5 — refresh current page
      if ((ctrl && e.key === "r") || e.key === "F5") {
        e.preventDefault();
        switch (selectedPage) {
          case "adapters":    queryClient.invalidateQueries({ queryKey: ["adapters"] }); break;
          case "routing":     queryClient.invalidateQueries({ queryKey: ["routingTable"] }); break;
          case "arp":         queryClient.invalidateQueries({ queryKey: ["arpTable"] }); break;
          case "ports":       queryClient.invalidateQueries({ queryKey: ["openPorts"] }); break;
          case "dashboard":   queryClient.invalidateQueries({ queryKey: ["systemInfo"] }); break;
          default: break;
        }
        return;
      }

      // Ctrl+D — Diagnostics
      if (ctrl && e.key === "d") {
        e.preventDefault();
        setSelectedPage("diagnostics");
        return;
      }

      // Ctrl+, — Settings
      if (ctrl && e.key === ",") {
        e.preventDefault();
        setSelectedPage("settings");
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedPage, setSelectedPage, queryClient]);
}

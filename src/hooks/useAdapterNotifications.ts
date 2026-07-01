import { useEffect, useRef } from "react";
import { useAdapters } from "./useAdapters";
import { toast } from "../stores/toastStore";
import type { NetworkAdapter } from "../types/network";

/**
 * Watches adapter states and emits toast notifications when
 * an adapter connects or disconnects.
 *
 * Must be mounted once — place in AppLayout.
 */
export function useAdapterNotifications() {
  const { data } = useAdapters();
  // Store previous states: Map<name, state>
  const prevStates = useRef<Map<string, string>>(new Map());
  const initialized = useRef(false);

  useEffect(() => {
    if (!data || data.length === 0) return;

    // On first load, just seed the map — don't notify
    if (!initialized.current) {
      for (const adapter of data) {
        prevStates.current.set(adapter.name, adapter.state);
      }
      initialized.current = true;
      return;
    }

    for (const adapter of data) {
      const prev = prevStates.current.get(adapter.name);
      const curr = adapter.state;

      if (prev === undefined) {
        // New adapter appeared
        if (curr === "connected") {
          toast.success(`${adapter.display_name} (${adapter.name}) connected`);
        }
        prevStates.current.set(adapter.name, curr);
        continue;
      }

      if (prev !== curr) {
        if (curr === "connected") {
          toast.success(`${adapter.display_name} (${adapter.name}) connected`);
        } else if (curr === "disconnected") {
          toast.warn(`${adapter.display_name} (${adapter.name}) disconnected`);
        }
        prevStates.current.set(adapter.name, curr);
      }
    }

    // Check for removed adapters
    for (const [name, prevState] of prevStates.current) {
      const stillExists = data.some((a: NetworkAdapter) => a.name === name);
      if (!stillExists && prevState === "connected") {
        toast.warn(`Adapter ${name} removed`);
        prevStates.current.delete(name);
      }
    }
  }, [data]);
}

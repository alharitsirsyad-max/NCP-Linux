import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { NetworkAdapter } from "../types/network";

export function useAdapters() {
  return useQuery<NetworkAdapter[], Error>({
    queryKey: ["adapters"],
    queryFn: () => invoke<NetworkAdapter[]>("list_adapters"),
    refetchInterval: 5000,
    // Fallback ke data mock saat di luar Tauri (browser dev mode)
    retry: false,
  });
}

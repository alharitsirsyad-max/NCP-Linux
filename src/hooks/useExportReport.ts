import { invoke } from "@tauri-apps/api/core";
import { toast } from "../stores/toastStore";

interface SaveResult {
  path: string;
}

/**
 * Generate and save a text report.
 * @param content - Full text content to write
 * @param filename - Filename with extension (e.g. "ping-report.txt")
 */
export async function exportReport(content: string, filename: string): Promise<void> {
  try {
    const result = await invoke<SaveResult>("save_report", { content, filename });
    toast.success(`Report saved to ${result.path}`);
  } catch (e) {
    toast.error(`Export failed: ${e}`);
  }
}

/** Format current datetime for filenames: 2026-07-01_14-30-00 */
export function reportTimestamp(): string {
  return new Date()
    .toISOString()
    .replace("T", "_")
    .replace(/:/g, "-")
    .slice(0, 19);
}

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ProcessBandwidth {
    pub pid: u32,
    pub process_name: String,
    pub program_path: String,
    pub sent_kb_per_sec: f64,
    pub received_kb_per_sec: f64,
    pub total_sent_kb: f64,
    pub total_received_kb: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct BandwidthSnapshot {
    pub processes: Vec<ProcessBandwidth>,
    pub total_sent_kb_per_sec: f64,
    pub total_recv_kb_per_sec: f64,
}

// ─── Global flag ──────────────────────────────────────────────────────────────

static MONITOR_RUNNING: AtomicBool = AtomicBool::new(false);

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Check if nethogs is available.
#[tauri::command]
pub async fn check_nethogs_available() -> bool {
    Command::new("which")
        .arg("nethogs")
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Start nethogs in troff (machine-readable) mode.
/// Emits "bandwidth_update" events with BandwidthSnapshot.
#[tauri::command]
pub async fn start_bandwidth_monitor(
    app: tauri::AppHandle,
    iface: String,
) -> Result<(), String> {
    if MONITOR_RUNNING.load(Ordering::Relaxed) {
        // Already running — stop previous first
        stop_bandwidth_monitor().await?;
    }

    if iface.chars().any(|c| matches!(c, ';' | '&' | '|' | '`' | '$' | '\n')) {
        return Err("Invalid interface name".to_string());
    }

    MONITOR_RUNNING.store(true, Ordering::Relaxed);

    tokio::spawn(async move {
        // nethogs -t = troff (machine-readable) mode, -d 1 = 1s refresh
        let child = Command::new("sudo")
            .args(["-n", "nethogs", "-t", "-d", "1", &iface])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn();

        let mut child = match child {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit(
                    "bandwidth_error",
                    format!("Failed to start nethogs: {}", e),
                );
                MONITOR_RUNNING.store(false, Ordering::Relaxed);
                return;
            }
        };

        let stdout = match child.stdout.take() {
            Some(s) => s,
            None => {
                MONITOR_RUNNING.store(false, Ordering::Relaxed);
                return;
            }
        };

        let mut reader = BufReader::new(stdout).lines();
        let mut current_processes: Vec<ProcessBandwidth> = Vec::new();
        let mut in_block = false;

        loop {
            if !MONITOR_RUNNING.load(Ordering::Relaxed) {
                let _ = child.kill().await;
                break;
            }

            let line = match reader.next_line().await {
                Ok(Some(l)) => l,
                Ok(None) => break, // EOF
                Err(_) => break,
            };

            let line = line.trim().to_string();

            // nethogs troff format:
            // "Refreshing:" → start of new block
            // "/proc/1234/exe\tprocessname\t0.5\t0.1" → process line
            // Empty line → end of block

            if line.starts_with("Refreshing:") {
                // Emit current block and start new one
                if !current_processes.is_empty() {
                    let total_sent = current_processes.iter().map(|p| p.sent_kb_per_sec).sum();
                    let total_recv = current_processes.iter().map(|p| p.received_kb_per_sec).sum();
                    let snapshot = BandwidthSnapshot {
                        processes: current_processes.clone(),
                        total_sent_kb_per_sec: total_sent,
                        total_recv_kb_per_sec: total_recv,
                    };
                    let _ = app.emit("bandwidth_update", snapshot);
                }
                current_processes.clear();
                in_block = true;
                continue;
            }

            if line.is_empty() {
                in_block = false;
                continue;
            }

            if !in_block {
                continue;
            }

            // Parse process line: "path\tname\tsent\trecv"
            // nethogs troff: tab-separated fields
            let parts: Vec<&str> = line.splitn(4, '\t').collect();
            if parts.len() < 4 {
                continue;
            }

            let program_path = parts[0].to_string();
            let process_name = extract_process_name(parts[0], parts[1]);

            // Skip "unknown TCP" and similar meta-entries
            if process_name.contains("unknown") && parts[0].is_empty() {
                continue;
            }

            let sent: f64 = parts[2].trim().parse().unwrap_or(0.0);
            let recv: f64 = parts[3].trim().parse().unwrap_or(0.0);

            // Extract PID from path like /proc/1234/exe
            let pid = extract_pid(&program_path);

            current_processes.push(ProcessBandwidth {
                pid,
                process_name,
                program_path,
                sent_kb_per_sec: sent,
                received_kb_per_sec: recv,
                total_sent_kb: 0.0,    // nethogs troff doesn't give totals
                total_received_kb: 0.0,
            });
        }

        MONITOR_RUNNING.store(false, Ordering::Relaxed);
    });

    Ok(())
}

/// Stop the bandwidth monitor.
#[tauri::command]
pub async fn stop_bandwidth_monitor() -> Result<(), String> {
    MONITOR_RUNNING.store(false, Ordering::Relaxed);
    // Kill any running nethogs process
    let _ = Command::new("sudo")
        .args(["-n", "pkill", "-x", "nethogs"])
        .output()
        .await;
    Ok(())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn extract_pid(path: &str) -> u32 {
    // "/proc/1234/exe" → 1234
    let parts: Vec<&str> = path.split('/').collect();
    for (i, part) in parts.iter().enumerate() {
        if *part == "proc" {
            if let Some(pid_str) = parts.get(i + 1) {
                if let Ok(pid) = pid_str.parse::<u32>() {
                    return pid;
                }
            }
        }
    }
    0
}

fn extract_process_name(path: &str, fallback: &str) -> String {
    // Try to get basename of the path
    if let Some(name) = std::path::Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
    {
        if !name.is_empty() && name != "exe" {
            return name.to_string();
        }
    }
    // Try basename of path component before /exe
    let without_exe = path.trim_end_matches("/exe");
    if let Some(name) = std::path::Path::new(without_exe)
        .file_name()
        .and_then(|s| s.to_str())
    {
        if !name.is_empty() {
            return name.to_string();
        }
    }
    // Fallback to nethogs-provided name
    if !fallback.is_empty() {
        return fallback.to_string();
    }
    "unknown".to_string()
}

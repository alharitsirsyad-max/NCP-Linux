use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::Emitter;
use tokio::process::Command;
use tokio::time::{interval, Duration};

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureConfig {
    pub interface: String,
    pub filter: Option<String>,
    pub packet_count: Option<u32>,
    pub output_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CaptureProgress {
    pub packets_captured: u32,
    pub file_size_bytes: u64,
    pub message: String,
}

// ─── Global State ─────────────────────────────────────────────────────────────

static CAPTURE_OUTPUT_PATH: Mutex<Option<String>> = Mutex::new(None);
static CAPTURE_RUNNING: AtomicBool = AtomicBool::new(false);

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Check if tcpdump is available.
#[tauri::command]
pub async fn check_tcpdump_available() -> bool {
    Command::new("which")
        .arg("tcpdump")
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Check if Wireshark is installed.
#[tauri::command]
pub async fn check_wireshark_available() -> bool {
    Command::new("which")
        .arg("wireshark")
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Start a tcpdump capture. Emits "capture_progress" events every second.
#[tauri::command]
pub async fn start_capture(
    app: tauri::AppHandle,
    config: CaptureConfig,
) -> Result<(), String> {
    if CAPTURE_RUNNING.load(Ordering::Relaxed) {
        return Err("A capture is already running. Stop it first.".to_string());
    }

    // Validate interface name (no shell injection)
    if config.interface.chars().any(|c| matches!(c, ';' | '&' | '|' | '`' | '$' | '\n')) {
        return Err("Invalid interface name".to_string());
    }

    // Build tcpdump args
    let mut args: Vec<String> = vec![
        "-n".to_string(),                    // no DNS resolution
        "-i".to_string(),
        config.interface.clone(),
        "-w".to_string(),
        config.output_path.clone(),
    ];

    if let Some(count) = config.packet_count {
        args.push("-c".to_string());
        args.push(count.to_string());
    }

    if let Some(filter) = &config.filter {
        if !filter.trim().is_empty() {
            // Append BPF filter as trailing args
            args.push(filter.clone());
        }
    }

    // Store output path for stop_capture to return
    {
        let mut guard = CAPTURE_OUTPUT_PATH.lock().unwrap();
        *guard = Some(config.output_path.clone());
    }
    CAPTURE_RUNNING.store(true, Ordering::Relaxed);

    let output_path = config.output_path.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        // Run tcpdump with sudo
        let mut child = match Command::new("sudo")
            .args(["-n", "tcpdump"])
            .args(&args)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                let _ = app_clone.emit(
                    "capture_progress",
                    CaptureProgress {
                        packets_captured: 0,
                        file_size_bytes: 0,
                        message: format!("Failed to start tcpdump: {}", e),
                    },
                );
                CAPTURE_RUNNING.store(false, Ordering::Relaxed);
                return;
            }
        };

        // Spawn a task to drain stderr so the child doesn't block on a full pipe,
        // and capture the first error line to emit if tcpdump exits immediately.
        let stderr_lines = {
            let stderr = child.stderr.take();
            if let Some(s) = stderr {
                use tokio::io::AsyncBufReadExt;
                let mut reader = tokio::io::BufReader::new(s).lines();
                let app_err = app_clone.clone();
                tokio::spawn(async move {
                    // Read lines; if tcpdump errors (e.g. sudo password required), emit it
                    while let Ok(Some(line)) = reader.next_line().await {
                        let line = line.trim().to_string();
                        if !line.is_empty() {
                            let _ = app_err.emit(
                                "capture_progress",
                                CaptureProgress {
                                    packets_captured: 0,
                                    file_size_bytes: 0,
                                    message: format!("tcpdump: {}", line),
                                },
                            );
                        }
                    }
                })
            } else {
                tokio::spawn(async {})
            }
        };
        let _ = stderr_lines;

        // Progress ticker: poll file size every second
        let mut ticker = interval(Duration::from_secs(1));
        let mut elapsed_secs: u32 = 0;

        loop {
            tokio::select! {
                _ = ticker.tick() => {
                    if !CAPTURE_RUNNING.load(Ordering::Relaxed) {
                        let _ = child.kill().await;
                        break;
                    }

                    elapsed_secs += 1;

                    // Try to get file size
                    let file_size = std::fs::metadata(&output_path)
                        .map(|m| m.len())
                        .unwrap_or(0);

                    // Estimate packets from file size (pcap header ~24 bytes, avg packet ~80 bytes)
                    let estimated_packets = if file_size > 24 {
                        ((file_size - 24) / 80) as u32
                    } else {
                        0
                    };

                    let _ = app_clone.emit(
                        "capture_progress",
                        CaptureProgress {
                            packets_captured: estimated_packets,
                            file_size_bytes: file_size,
                            message: format!("Capturing... {}s elapsed", elapsed_secs),
                        },
                    );
                }
                status = child.wait() => {
                    let _ = status; // ignore exit code
                    CAPTURE_RUNNING.store(false, Ordering::Relaxed);

                    let file_size = std::fs::metadata(&output_path)
                        .map(|m| m.len())
                        .unwrap_or(0);

                    let _ = app_clone.emit(
                        "capture_progress",
                        CaptureProgress {
                            packets_captured: if file_size > 24 { ((file_size - 24) / 80) as u32 } else { 0 },
                            file_size_bytes: file_size,
                            message: "Capture complete.".to_string(),
                        },
                    );
                    let _ = app_clone.emit("capture_done", output_path);
                    break;
                }
            }
        }
    });

    Ok(())
}

/// Stop the running capture. Returns the output file path.
#[tauri::command]
pub async fn stop_capture() -> Result<String, String> {
    if !CAPTURE_RUNNING.load(Ordering::Relaxed) {
        return Err("No capture is running.".to_string());
    }

    // Signal the background task to kill tcpdump
    CAPTURE_RUNNING.store(false, Ordering::Relaxed);

    // Also kill any lingering tcpdump processes
    let _ = Command::new("sudo")
        .args(["-n", "pkill", "-x", "tcpdump"])
        .output()
        .await;

    let path = CAPTURE_OUTPUT_PATH
        .lock()
        .unwrap()
        .clone()
        .unwrap_or_default();

    Ok(path)
}

/// Open a .pcap file in Wireshark.
#[tauri::command]
pub async fn open_in_wireshark(path: String) -> Result<(), String> {
    if !std::path::Path::new(&path).exists() {
        return Err(format!("File not found: {}", path));
    }

    Command::new("wireshark")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to launch Wireshark: {}", e))?;

    Ok(())
}

/// Expand ~ in a path to the actual home directory.
#[tauri::command]
pub fn expand_capture_path(path: String) -> String {
    if path.starts_with("~/") {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        format!("{}{}", home, &path[1..])
    } else {
        path
    }
}

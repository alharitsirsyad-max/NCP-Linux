use std::process::Command;
use std::time::Duration;
use std::sync::mpsc;
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use crate::models::{SpeedTestResult, SpeedTestProgress};

fn emit_progress(app: &AppHandle, stage: &str, percent: u8, message: &str, current_value: Option<f64>) {
    let _ = app.emit("speedtest_progress", SpeedTestProgress {
        stage: stage.to_string(),
        percent,
        current_value,
        message: message.to_string(),
    });
}

#[tauri::command]
pub fn check_speedtest_available() -> bool {
    Command::new("which")
        .arg("speedtest-cli")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[tauri::command]
pub async fn run_speedtest(app: AppHandle) -> Result<SpeedTestResult, String> {
    if !check_speedtest_available() {
        return Err(
            "speedtest-cli not found. Install: sudo pacman -S speedtest-cli (Arch) or sudo apt install speedtest-cli (Ubuntu)".to_string()
        );
    }

    emit_progress(&app, "ping", 5, "Connecting to server...", None);

    // Channel to receive result from background thread
    let (tx, rx) = mpsc::channel::<Result<std::process::Output, std::io::Error>>();

    // Progress simulation thread
    let progress_app = app.clone();
    std::thread::spawn(move || {
        let stages: &[(&str, u8, &str)] = &[
            ("ping",     10, "Testing ping..."),
            ("ping",     20, "Testing ping..."),
            ("download", 30, "Testing download speed..."),
            ("download", 45, "Testing download speed..."),
            ("download", 60, "Testing download speed..."),
            ("upload",   72, "Testing upload speed..."),
            ("upload",   82, "Testing upload speed..."),
            ("upload",   92, "Testing upload speed..."),
        ];
        for (stage, pct, msg) in stages {
            emit_progress(&progress_app, stage, *pct, msg, None);
            std::thread::sleep(Duration::from_secs(3));
        }
    });

    // Run speedtest-cli in a separate thread
    std::thread::spawn(move || {
        let output = Command::new("speedtest-cli")
            .args(["--json", "--secure"])
            .output();
        let _ = tx.send(output);
    });

    // Wait for result using async-friendly blocking
    let output = loop {
        match rx.try_recv() {
            Ok(result) => break result.map_err(|e| format!("Failed to run speedtest-cli: {}", e))?,
            Err(mpsc::TryRecvError::Empty) => {
                // Yield to async runtime briefly
                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
            }
            Err(mpsc::TryRecvError::Disconnected) => {
                return Err("speedtest-cli process disconnected".to_string());
            }
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("speedtest-cli error: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse output: {}", e))?;

    let ping     = json["ping"].as_f64().unwrap_or(0.0);
    let download = json["download"].as_f64().unwrap_or(0.0) / 1_000_000.0;
    let upload   = json["upload"].as_f64().unwrap_or(0.0)   / 1_000_000.0;

    let server_name    = json["server"]["name"].as_str().unwrap_or("Unknown").to_string();
    let server_country = json["server"]["country"].as_str().unwrap_or("").to_string();
    let isp            = json["client"]["isp"].as_str().unwrap_or("Unknown").to_string();
    let timestamp      = json["timestamp"].as_str().unwrap_or("").to_string();

    let result = SpeedTestResult { ping, download, upload, server_name, server_country, isp, timestamp };

    emit_progress(&app, "done", 100, "Test complete!", None);

    Ok(result)
}

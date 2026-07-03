use serde::{Deserialize, Serialize};
use tokio::process::Command;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WifiNetwork {
    pub ssid: String,
    pub bssid: String,
    pub signal_strength: i32, // dBm, e.g. -65
    pub signal_percent: u8,   // 0–100
    pub channel: u32,
    pub frequency_mhz: u32, // 2412, 5180, etc.
    pub band: String,        // "2.4 GHz" | "5 GHz" | "6 GHz"
    pub security: String,    // "WPA2" | "WPA3" | "Open" | etc.
    pub mode: String,        // "Infrastructure" | "Ad-Hoc"
    pub in_use: bool,
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Scan Wi-Fi networks using nmcli and return sorted results.
///
/// Sorted: in_use first, then by signal_percent descending.
#[tauri::command]
pub async fn scan_wifi_networks() -> Result<Vec<WifiNetwork>, String> {
    // Trigger a fresh scan first (best-effort, may require elevated perms)
    let _ = Command::new("nmcli")
        .args(["device", "wifi", "rescan"])
        .output()
        .await;

    // Fetch list with all fields we need
    // Fields: IN-USE,BSSID,SSID,MODE,CHAN,FREQ,SIGNAL,SECURITY
    let output = Command::new("nmcli")
        .args([
            "-t",
            "-f",
            "IN-USE,BSSID,SSID,MODE,CHAN,FREQ,SIGNAL,SECURITY",
            "device",
            "wifi",
            "list",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run nmcli: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("nmcli error: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut networks = parse_nmcli_output(&stdout);

    // Sort: in_use first, then signal descending
    networks.sort_by(|a, b| {
        b.in_use
            .cmp(&a.in_use)
            .then(b.signal_percent.cmp(&a.signal_percent))
    });

    Ok(networks)
}

/// Check if a Wi-Fi adapter is present.
#[tauri::command]
pub async fn check_wifi_available() -> bool {
    let output = Command::new("nmcli")
        .args(["-t", "-f", "TYPE", "device", "status"])
        .output()
        .await;

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            stdout.lines().any(|l| l.trim().eq_ignore_ascii_case("wifi"))
        }
        Err(_) => false,
    }
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/// Parse `nmcli -t -f IN-USE,BSSID,SSID,MODE,CHAN,FREQ,SIGNAL,SECURITY device wifi list` output.
///
/// nmcli -t uses ':' as separator and escapes literal colons as '\:'.
/// Field order: IN-USE, BSSID, SSID, MODE, CHAN, FREQ, SIGNAL, SECURITY
fn parse_nmcli_output(input: &str) -> Vec<WifiNetwork> {
    let mut networks = Vec::new();

    for line in input.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // Split by unescaped ':' — nmcli -t escapes ':' inside values as '\:'
        let fields = split_nmcli_line(line);
        if fields.len() < 8 {
            continue;
        }

        let in_use = fields[0].trim() == "*";
        let bssid = unescape(&fields[1]);
        let ssid = unescape(&fields[2]);
        let mode = unescape(&fields[3]);
        let channel: u32 = fields[4].trim().parse().unwrap_or(0);
        let freq_str = unescape(&fields[5]); // e.g. "2412 MHz" or "5180 MHz"
        let signal: u32 = fields[6].trim().parse().unwrap_or(0);
        let security = unescape(&fields[7]);

        // Parse frequency
        let frequency_mhz: u32 = freq_str
            .split_whitespace()
            .next()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        // Convert nmcli signal (0–100) to dBm approximation
        // nmcli SIGNAL field is already 0–100 (not dBm)
        let signal_percent = signal.min(100) as u8;
        // Approximate dBm: -100 + (signal_percent / 2)
        let signal_strength = -100_i32 + (signal_percent as i32 / 2);

        let band = freq_to_band(frequency_mhz);

        // Normalize mode
        let mode_display = if mode.to_lowercase().contains("infra") {
            "Infrastructure".to_string()
        } else if mode.to_lowercase().contains("adhoc") || mode.to_lowercase().contains("ad-hoc") {
            "Ad-Hoc".to_string()
        } else {
            mode.clone()
        };

        // Normalize security
        let security_display = normalize_security(&security);

        // Skip entries with empty BSSID (duplicate/summary rows)
        if bssid.is_empty() || bssid == "--" {
            continue;
        }

        networks.push(WifiNetwork {
            ssid: if ssid.is_empty() { "<Hidden>".to_string() } else { ssid },
            bssid,
            signal_strength,
            signal_percent,
            channel,
            frequency_mhz,
            band,
            security: security_display,
            mode: mode_display,
            in_use,
        });
    }

    networks
}

/// Split a nmcli -t output line by unescaped ':' separators.
fn split_nmcli_line(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let chars: Vec<char> = line.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        if chars[i] == '\\' && i + 1 < chars.len() && chars[i + 1] == ':' {
            // Escaped colon — keep it as literal ':'
            current.push(':');
            i += 2;
        } else if chars[i] == ':' {
            fields.push(current.clone());
            current.clear();
            i += 1;
        } else {
            current.push(chars[i]);
            i += 1;
        }
    }
    fields.push(current);
    fields
}

fn unescape(s: &str) -> String {
    s.trim().to_string()
}

fn freq_to_band(freq_mhz: u32) -> String {
    if freq_mhz == 0 {
        "Unknown".to_string()
    } else if freq_mhz < 3000 {
        "2.4 GHz".to_string()
    } else if freq_mhz < 6000 {
        "5 GHz".to_string()
    } else {
        "6 GHz".to_string()
    }
}

fn normalize_security(raw: &str) -> String {
    let r = raw.trim().to_uppercase();
    if r.is_empty() || r == "--" || r == "NONE" {
        return "Open".to_string();
    }
    if r.contains("WPA3") {
        return "WPA3".to_string();
    }
    if r.contains("WPA2") {
        return "WPA2".to_string();
    }
    if r.contains("WPA") {
        return "WPA".to_string();
    }
    if r.contains("WEP") {
        return "WEP".to_string();
    }
    raw.trim().to_string()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_freq_to_band() {
        assert_eq!(freq_to_band(2412), "2.4 GHz");
        assert_eq!(freq_to_band(5180), "5 GHz");
        assert_eq!(freq_to_band(5925), "5 GHz");
        assert_eq!(freq_to_band(6000), "5 GHz");
        assert_eq!(freq_to_band(6100), "6 GHz");
    }

    #[test]
    fn test_normalize_security() {
        assert_eq!(normalize_security(""), "Open");
        assert_eq!(normalize_security("--"), "Open");
        assert_eq!(normalize_security("WPA2 802.1X"), "WPA2");
        assert_eq!(normalize_security("WPA3"), "WPA3");
        assert_eq!(normalize_security("WPA1 WPA2"), "WPA2");
    }

    #[test]
    fn test_split_nmcli_line_basic() {
        // IN-USE:BSSID:SSID:MODE:CHAN:FREQ:SIGNAL:SECURITY
        let line = "*:AA\\:BB\\:CC\\:DD\\:EE\\:FF:HomeNet:Infra:6:2437 MHz:85:WPA2";
        let fields = split_nmcli_line(line);
        assert_eq!(fields[0], "*");
        assert_eq!(fields[1], "AA:BB:CC:DD:EE:FF");
        assert_eq!(fields[2], "HomeNet");
        assert_eq!(fields[6], "85");
    }
}

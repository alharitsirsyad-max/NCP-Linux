use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
pub struct PingLine {
    pub seq: u32,
    pub ttl: u32,
    pub time_ms: f64,
    pub status: String, // "success" | "timeout"
    pub raw: String,
}

#[derive(Clone, Serialize)]
pub struct PingSummary {
    pub packets_sent: u32,
    pub packets_received: u32,
    pub packet_loss: f64,
    pub rtt_min: f64,
    pub rtt_avg: f64,
    pub rtt_max: f64,
}

/// Validate that target doesn't contain shell-injection characters
fn validate_target(target: &str) -> Result<(), String> {
    if target.is_empty() {
        return Err("Target cannot be empty".to_string());
    }
    let invalid: &[char] = &[';', '&', '|', '`', '$', '(', ')', '<', '>', '\n', '\r', ' '];
    if target.chars().any(|c| invalid.contains(&c)) {
        return Err(format!("Target contains invalid characters: {}", target));
    }
    Ok(())
}

/// Parse a single ping output line into a PingLine struct
/// Handles both: "64 bytes from X: icmp_seq=1 ttl=118 time=12 ms"
/// and: "Request timeout for icmp_seq 1" / "no answer yet for icmp_seq=1"
fn parse_ping_line(line: &str, seq_counter: &mut u32) -> Option<PingLine> {
    let line_lower = line.to_lowercase();

    // Timeout line
    if line_lower.contains("timeout") || line_lower.contains("no answer") {
        *seq_counter += 1;
        // Try to extract seq number
        let seq = extract_seq(line).unwrap_or(*seq_counter);
        return Some(PingLine {
            seq,
            ttl: 0,
            time_ms: 0.0,
            status: "timeout".to_string(),
            raw: line.to_string(),
        });
    }

    // Success line: "64 bytes from ..."
    if line.contains("bytes from") && line.contains("time=") {
        *seq_counter += 1;
        let seq = extract_field(line, "icmp_seq=").unwrap_or(*seq_counter);
        let ttl = extract_field(line, "ttl=").unwrap_or(0);
        let time_ms = extract_time(line).unwrap_or(0.0);

        return Some(PingLine {
            seq,
            ttl,
            time_ms,
            status: "success".to_string(),
            raw: line.to_string(),
        });
    }

    None
}

fn extract_seq(line: &str) -> Option<u32> {
    // Try "icmp_seq=N" or "icmp_seq N"
    if let Some(pos) = line.find("icmp_seq=") {
        let rest = &line[pos + 9..];
        rest.split(|c: char| !c.is_ascii_digit()).next()?.parse().ok()
    } else if let Some(pos) = line.find("icmp_seq ") {
        let rest = &line[pos + 9..];
        rest.split(|c: char| !c.is_ascii_digit()).next()?.parse().ok()
    } else {
        None
    }
}

fn extract_field(line: &str, key: &str) -> Option<u32> {
    let pos = line.find(key)?;
    let rest = &line[pos + key.len()..];
    rest.split(|c: char| !c.is_ascii_digit()).next()?.parse().ok()
}

fn extract_time(line: &str) -> Option<f64> {
    let pos = line.find("time=")?;
    let rest = &line[pos + 5..];
    // time can be "12.3 ms" or "12.3ms"
    let num_str: String = rest
        .chars()
        .take_while(|c| c.is_ascii_digit() || *c == '.')
        .collect();
    num_str.parse().ok()
}

/// Parse the ping summary line:
/// "4 packets transmitted, 3 received, 25% packet loss, time 3003ms"
/// "rtt min/avg/max/mdev = 11.000/12.000/13.000/0.816 ms"
fn parse_summary(lines: &[String]) -> PingSummary {
    let mut sent = 0u32;
    let mut received = 0u32;
    let mut loss = 0.0f64;
    let mut rtt_min = 0.0f64;
    let mut rtt_avg = 0.0f64;
    let mut rtt_max = 0.0f64;

    for line in lines {
        // "N packets transmitted, M received, X% packet loss"
        if line.contains("packets transmitted") {
            let parts: Vec<&str> = line.split(',').collect();
            if let Some(p) = parts.first() {
                sent = p.split_whitespace().next()
                    .and_then(|n| n.parse().ok()).unwrap_or(0);
            }
            if let Some(p) = parts.get(1) {
                received = p.split_whitespace().next()
                    .and_then(|n| n.parse().ok()).unwrap_or(0);
            }
            if let Some(p) = parts.get(2) {
                let loss_str: String = p.chars()
                    .filter(|c| c.is_ascii_digit() || *c == '.')
                    .collect();
                loss = loss_str.parse().unwrap_or(0.0);
            }
        }
        // "rtt min/avg/max/mdev = 11.0/12.0/13.0/0.8 ms"
        if line.contains("min/avg/max") {
            if let Some(pos) = line.find('=') {
                let values_part = line[pos + 1..].trim();
                let numbers: Vec<f64> = values_part
                    .split('/')
                    .filter_map(|s| s.split_whitespace().next()?.parse().ok())
                    .collect();
                if numbers.len() >= 3 {
                    rtt_min = numbers[0];
                    rtt_avg = numbers[1];
                    rtt_max = numbers[2];
                }
            }
        }
    }

    PingSummary {
        packets_sent: sent,
        packets_received: received,
        packet_loss: loss,
        rtt_min,
        rtt_avg,
        rtt_max,
    }
}

#[tauri::command]
pub async fn run_ping(
    app: AppHandle,
    target: String,
    count: u32,
) -> Result<(), String> {
    // Validate inputs
    validate_target(&target)?;
    if count == 0 || count > 100 {
        return Err("Count must be between 1 and 100".to_string());
    }

    let mut child = Command::new("ping")
        .args(["-c", &count.to_string(), &target])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "ping: command not found. Install iputils.".to_string()
            } else {
                format!("Failed to spawn ping: {}", e)
            }
        })?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let reader = BufReader::new(stdout);

    let mut all_lines: Vec<String> = Vec::new();
    let mut seq_counter = 0u32;

    for line in reader.lines() {
        let Ok(line) = line else { break };
        all_lines.push(line.clone());

        if let Some(ping_line) = parse_ping_line(&line, &mut seq_counter) {
            let _ = app.emit("ping_line", &ping_line);
        }
    }

    // Wait for process to finish
    let _ = child.wait();

    // Build and emit summary
    let summary = parse_summary(&all_lines);
    let _ = app.emit("ping_done", &summary);

    Ok(())
}

// DNS Lookup
#[derive(Clone, Serialize)]
pub struct DnsResult {
    pub records: Vec<String>,
    pub record_type: String,
    pub host: String,
}

#[tauri::command]
pub fn run_dns_lookup(host: String, record_type: String) -> Result<DnsResult, String> {
    validate_target(&host)?;

    let valid_types = ["A", "AAAA", "MX", "CNAME", "TXT", "NS", "PTR"];
    let rt = record_type.to_uppercase();
    if !valid_types.contains(&rt.as_str()) {
        return Err(format!("Invalid record type: {}", record_type));
    }

    let output = Command::new("dig")
        .args(["+short", "-t", &rt, &host])
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "dig: command not found. Install bind-tools (Arch) or dnsutils (Debian/Ubuntu).".to_string()
            } else {
                format!("Failed to run dig: {}", e)
            }
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("dig error: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let records: Vec<String> = stdout
        .lines()
        .filter(|l| !l.is_empty())
        .map(String::from)
        .collect();

    Ok(DnsResult {
        records,
        record_type: rt,
        host,
    })
}

// Traceroute
#[derive(Clone, Serialize)]
pub struct TracerouteHop {
    pub hop: u32,
    pub ip: Option<String>,
    pub probes: Vec<Option<f64>>, // ms per probe, None = timeout
}

#[tauri::command]
pub async fn run_traceroute(app: AppHandle, target: String) -> Result<(), String> {
    validate_target(&target)?;

    let mut child = Command::new("traceroute")
        .args(["-n", &target])
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "traceroute: command not found. Install traceroute.".to_string()
            } else {
                format!("Failed to spawn traceroute: {}", e)
            }
        })?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let reader = BufReader::new(stdout);

    for line in reader.lines() {
        let Ok(line) = line else { break };
        if let Some(hop) = parse_traceroute_line(&line) {
            let _ = app.emit("traceroute_hop", &hop);
        }
    }

    let _ = child.wait();
    let _ = app.emit("traceroute_done", &serde_json::json!({}));

    Ok(())
}

/// Parse traceroute line like: "1  192.168.1.1  1.234 ms  1.100 ms  1.050 ms"
fn parse_traceroute_line(line: &str) -> Option<TracerouteHop> {
    let mut parts = line.split_whitespace();
    let hop_str = parts.next()?;
    let hop: u32 = hop_str.parse().ok()?;

    let mut ip: Option<String> = None;
    let mut probes: Vec<Option<f64>> = Vec::new();

    let rest: Vec<&str> = parts.collect();
    let mut i = 0;

    while i < rest.len() {
        let token = rest[i];

        // IP address token
        if token != "*" && token.contains('.') && ip.is_none() {
            ip = Some(token.to_string());
            i += 1;
            continue;
        }

        // Timeout
        if token == "*" {
            probes.push(None);
            i += 1;
            continue;
        }

        // Latency value followed by "ms"
        if let Ok(ms) = token.parse::<f64>() {
            probes.push(Some(ms));
            i += 2; // skip "ms"
            continue;
        }

        i += 1;
    }

    if probes.is_empty() {
        return None;
    }

    Some(TracerouteHop { hop, ip, probes })
}

// System info
#[derive(Serialize)]
pub struct SystemInfo {
    pub hostname: String,
    pub username: String,
    pub distro: String,
    pub kernel: String,
    pub uptime_seconds: u64,
    pub nm_status: String,
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    // Hostname
    let hostname = std::fs::read_to_string("/etc/hostname")
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| {
            Command::new("hostname")
                .output()
                .ok()
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                .unwrap_or_default()
        });

    // Username
    let username = std::env::var("USER")
        .or_else(|_| std::env::var("LOGNAME"))
        .unwrap_or_else(|_| "unknown".to_string());

    // Distro from /etc/os-release
    let distro = parse_os_release();

    // Kernel
    let kernel = Command::new("uname")
        .arg("-r")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    // Uptime from /proc/uptime
    let uptime_seconds = std::fs::read_to_string("/proc/uptime")
        .ok()
        .and_then(|s| s.split_whitespace().next()?.parse::<f64>().ok())
        .map(|f| f as u64)
        .unwrap_or(0);

    // NM status
    let nm_status = Command::new("systemctl")
        .args(["is-active", "NetworkManager"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    Ok(SystemInfo {
        hostname,
        username,
        distro,
        kernel,
        uptime_seconds,
        nm_status,
    })
}

fn parse_os_release() -> String {
    let Ok(content) = std::fs::read_to_string("/etc/os-release") else {
        return "Unknown Linux".to_string();
    };
    for line in content.lines() {
        if line.starts_with("PRETTY_NAME=") {
            return line[12..].trim_matches('"').to_string();
        }
    }
    "Unknown Linux".to_string()
}

// ── MTR ──────────────────────────────────────────────────────────────────────

#[derive(Clone, Serialize)]
pub struct MtrHop {
    pub hop: u32,
    pub host: Option<String>,
    pub loss_pct: f64,
    pub sent: u32,
    pub last_ms: f64,
    pub avg_ms: f64,
    pub best_ms: f64,
    pub worst_ms: f64,
}

#[derive(Clone, Serialize)]
pub struct MtrUpdate {
    pub cycle: u32,
    pub hops: Vec<MtrHop>,
}

/// Run MTR using `mtr --raw -n -c {cycles} {target}` and stream updates.
///
/// `mtr --raw` outputs lines like:
///   h HOP_IDX HOST       (hop host update)
///   p HOP_IDX LATENCY_US (ping result in microseconds)
///   d HOP_IDX HOST       (DNS resolved name)
///
/// We accumulate data and emit an `mtr_update` event each time a full cycle completes.
#[tauri::command]
pub async fn run_mtr(
    app: AppHandle,
    target: String,
    cycles: u32,
) -> Result<(), String> {
    validate_target(&target)?;

    if std::process::Command::new("which")
        .arg("mtr")
        .output()
        .map(|o| !o.status.success())
        .unwrap_or(true)
    {
        return Err(
            "mtr: command not found. Install it with: sudo pacman -S mtr (Arch) or sudo apt install mtr (Debian/Ubuntu)".to_string()
        );
    }

    let cycle_arg = if cycles == 0 {
        "999999".to_string() // continuous until stopped
    } else {
        cycles.to_string()
    };

    let mut child = Command::new("mtr")
        .args(["--raw", "-n", "-c", &cycle_arg, &target])
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn mtr: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture mtr stdout")?;
    let reader = BufReader::new(stdout);

    // hop index -> (host, list of latencies in ms)
    let mut hop_data: std::collections::BTreeMap<u32, (Option<String>, Vec<f64>)> = std::collections::BTreeMap::new();
    let mut current_cycle = 0u32;
    // Track how many pings we've seen for hop 1 to detect new cycles
    let mut hop1_count = 0u32;

    for line in reader.lines() {
        let Ok(line) = line else { break };
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 3 { continue; }

        let kind = parts[0];
        let hop_idx: u32 = match parts[1].parse() {
            Ok(v) => v,
            Err(_) => continue,
        };

        match kind {
            "h" | "d" => {
                // Host line: "h 0 192.168.1.1" (0-indexed)
                let host = parts[2].to_string();
                let entry = hop_data.entry(hop_idx + 1).or_insert((None, Vec::new()));
                if entry.0.is_none() || kind == "d" {
                    entry.0 = Some(host);
                }
            }
            "p" => {
                // Ping line: "p 0 12345" (microseconds, 0-indexed)
                let us: f64 = match parts[2].parse() {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                let ms = us / 1000.0;
                let entry = hop_data.entry(hop_idx + 1).or_insert((None, Vec::new()));
                entry.1.push(ms);

                // When hop 0 (first hop) gets a new ping, we've started a new cycle
                if hop_idx == 0 {
                    hop1_count += 1;
                    if hop1_count > 1 {
                        current_cycle += 1;
                        let update = build_mtr_update(current_cycle, &hop_data);
                        let _ = app.emit("mtr_update", &update);
                    }
                }
            }
            _ => {}
        }
    }

    // Emit final state
    current_cycle += 1;
    if !hop_data.is_empty() {
        let update = build_mtr_update(current_cycle, &hop_data);
        let _ = app.emit("mtr_update", &update);
    }

    let _ = child.wait();
    let _ = app.emit("mtr_done", &serde_json::json!({ "cycles": current_cycle }));

    Ok(())
}

fn build_mtr_update(
    cycle: u32,
    hop_data: &std::collections::BTreeMap<u32, (Option<String>, Vec<f64>)>,
) -> MtrUpdate {
    let hops: Vec<MtrHop> = hop_data
        .iter()
        .map(|(&hop, (host, latencies))| {
            let sent = latencies.len() as u32;
            let timeouts = 0u32; // mtr --raw doesn't emit timeout lines
            let total = sent + timeouts;
            let loss_pct = if total == 0 { 0.0 } else { (timeouts as f64 / total as f64) * 100.0 };
            let last_ms = latencies.last().copied().unwrap_or(0.0);
            let avg_ms = if sent == 0 { 0.0 } else { latencies.iter().sum::<f64>() / sent as f64 };
            let best_ms = latencies.iter().cloned().fold(f64::MAX, f64::min);
            let worst_ms = latencies.iter().cloned().fold(f64::MIN, f64::max);

            MtrHop {
                hop,
                host: host.clone(),
                loss_pct,
                sent: total,
                last_ms,
                avg_ms,
                best_ms: if best_ms == f64::MAX { 0.0 } else { best_ms },
                worst_ms: if worst_ms == f64::MIN { 0.0 } else { worst_ms },
            }
        })
        .collect();

    MtrUpdate { cycle, hops }
}

// ── Whois Lookup ──────────────────────────────────────────────────────────────

#[tauri::command]
pub fn run_whois(target: String) -> Result<String, String> {
    validate_target(&target)?;

    let output = Command::new("whois")
        .arg(&target)
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "whois: command not found. Install it with: sudo pacman -S whois (Arch) or sudo apt install whois (Debian/Ubuntu)".to_string()
            } else {
                format!("Failed to run whois: {}", e)
            }
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("whois error: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}

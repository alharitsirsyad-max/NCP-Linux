use std::collections::HashMap;
use std::process::Command;
use serde_json::Value;
use serde::Serialize;

// ── Routing Table ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct RouteEntry {
    pub destination: String,
    pub gateway: Option<String>,
    pub interface: String,
    pub metric: u32,
    pub protocol: String,
    pub scope: String,
}

#[tauri::command]
pub fn get_routing_table() -> Result<Vec<RouteEntry>, String> {
    let output = Command::new("ip")
        .args(["-j", "route", "show"])
        .output()
        .map_err(|e| format!("Failed to run ip route: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ip route error: {}", stderr.trim()));
    }

    let json: Vec<Value> = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("JSON parse error: {}", e))?;

    let routes = json
        .iter()
        .filter_map(|r| {
            let dst = r["dst"].as_str()?;
            Some(RouteEntry {
                destination: dst.to_string(),
                gateway: r["gateway"].as_str().map(String::from),
                interface: r["dev"].as_str().unwrap_or("").to_string(),
                metric: r["metric"].as_u64().unwrap_or(0) as u32,
                protocol: r["protocol"].as_str().unwrap_or("kernel").to_string(),
                scope: r["scope"].as_str().unwrap_or("global").to_string(),
            })
        })
        .collect();

    Ok(routes)
}

// ── ARP Table ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct ArpEntry {
    pub ip: String,
    pub mac: String,
    pub interface: String,
    pub state: String,
}

#[tauri::command]
pub fn get_arp_table() -> Result<Vec<ArpEntry>, String> {
    let output = Command::new("ip")
        .args(["-j", "neigh", "show"])
        .output()
        .map_err(|e| format!("Failed to run ip neigh: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ip neigh error: {}", stderr.trim()));
    }

    let json: Vec<Value> = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("JSON parse error: {}", e))?;

    let entries = json
        .iter()
        .filter_map(|e| {
            let ip = e["dst"].as_str()?;
            let mac = e["lladdr"].as_str().unwrap_or("").to_string();
            let iface = e["dev"].as_str().unwrap_or("").to_string();
            // state is an array like ["REACHABLE"] or ["STALE"]
            let state = e["state"]
                .as_array()
                .and_then(|a| a.first())
                .and_then(|s| s.as_str())
                .unwrap_or("UNKNOWN")
                .to_uppercase();
            Some(ArpEntry {
                ip: ip.to_string(),
                mac,
                interface: iface,
                state,
            })
        })
        .collect();

    Ok(entries)
}

// ── Open Ports (ss -tulnp) ───────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct PortEntry {
    pub protocol: String,
    pub local_address: String,
    pub local_port: u16,
    pub state: String,
    pub pid: Option<u32>,
    pub process: Option<String>,
}

#[tauri::command]
pub fn get_open_ports() -> Result<Vec<PortEntry>, String> {
    let output = Command::new("ss")
        .args(["-tulnp"])
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "ss: command not found. Install iproute2.".to_string()
            } else {
                format!("Failed to run ss: {}", e)
            }
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ss error: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_ss_output(&stdout))
}

/// Parse output of `ss -tulnp`
/// Example line:
/// tcp   LISTEN 0      128          0.0.0.0:22        0.0.0.0:*    users:(("sshd",pid=1234,fd=3))
/// udp   UNCONN 0      0            0.0.0.0:68        0.0.0.0:*
pub fn parse_ss_output(input: &str) -> Vec<PortEntry> {
    let mut entries = Vec::new();

    for line in input.lines() {
        // Skip header line
        if line.starts_with("Netid") || line.starts_with("State") {
            continue;
        }
        let cols: Vec<&str> = line.split_whitespace().collect();
        if cols.len() < 5 {
            continue;
        }

        let protocol = cols[0].to_lowercase();
        if protocol != "tcp" && protocol != "udp" {
            continue;
        }

        let state = cols[1].to_string();
        let local_full = cols[4]; // e.g. "0.0.0.0:22" or "[::]:80"

        let (local_address, local_port) = split_addr_port(local_full);
        let Ok(port) = local_port.parse::<u16>() else {
            continue;
        };

        // Parse process info from last column: users:(("sshd",pid=1234,fd=3))
        let (pid, process) = if let Some(proc_col) = cols.last() {
            parse_process_info(proc_col)
        } else {
            (None, None)
        };

        entries.push(PortEntry {
            protocol,
            local_address,
            local_port: port,
            state,
            pid,
            process,
        });
    }

    entries
}

/// Split "0.0.0.0:8080" or "[::1]:443" into (address, port)
fn split_addr_port(s: &str) -> (String, String) {
    // IPv6 format: [::]:80
    if s.starts_with('[') {
        if let Some(bracket_end) = s.rfind(']') {
            let addr = s[1..bracket_end].to_string();
            let port = s.get(bracket_end + 2..).unwrap_or("0").to_string();
            return (addr, port);
        }
    }
    // IPv4: 0.0.0.0:80 or *:80
    if let Some(colon) = s.rfind(':') {
        let addr = s[..colon].to_string();
        let port = s[colon + 1..].to_string();
        return (addr, port);
    }
    (s.to_string(), "0".to_string())
}

/// Extract pid and process name from "users:(("sshd",pid=1234,fd=3))"
fn parse_process_info(s: &str) -> (Option<u32>, Option<String>) {
    if !s.contains("users:") {
        return (None, None);
    }

    // Extract process name (first quoted string)
    let proc_name = s
        .find('"')
        .and_then(|start| s[start + 1..].find('"').map(|end| s[start + 1..start + 1 + end].to_string()));

    // Extract pid= value
    let pid = s.find("pid=").and_then(|pos| {
        s[pos + 4..]
            .split(|c: char| !c.is_ascii_digit())
            .next()?
            .parse::<u32>()
            .ok()
    });

    (pid, proc_name)
}

// ── Traffic Stats ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct TrafficSnapshot {
    pub interface: String,
    pub bytes_rx: u64,
    pub bytes_tx: u64,
}

#[tauri::command]
pub fn get_traffic_snapshot() -> Result<Vec<TrafficSnapshot>, String> {
    let content = std::fs::read_to_string("/proc/net/dev")
        .map_err(|e| format!("Failed to read /proc/net/dev: {}", e))?;

    let mut snapshots = Vec::new();
    for line in content.lines().skip(2) {
        let line = line.trim();
        let Some((iface, rest)) = line.split_once(':') else { continue };
        let cols: Vec<&str> = rest.split_whitespace().collect();
        if cols.len() >= 9 {
            let rx = cols[0].parse::<u64>().unwrap_or(0);
            let tx = cols[8].parse::<u64>().unwrap_or(0);
            snapshots.push(TrafficSnapshot {
                interface: iface.trim().to_string(),
                bytes_rx: rx,
                bytes_tx: tx,
            });
        }
    }
    Ok(snapshots)
}

// ── Internet check ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct InternetStatus {
    pub online: bool,
    pub latency_ms: Option<f64>,
}

#[tauri::command]
pub fn check_internet() -> Result<InternetStatus, String> {
    let output = Command::new("ping")
        .args(["-c", "1", "-W", "3", "1.1.1.1"])
        .output()
        .map_err(|e| format!("Failed to run ping: {}", e))?;

    if output.status.success() {
        // Try to extract time from output
        let stdout = String::from_utf8_lossy(&output.stdout);
        let latency = stdout.lines()
            .find(|l| l.contains("time="))
            .and_then(|l| l.find("time=").map(|p| &l[p + 5..]))
            .and_then(|s| s.split_whitespace().next())
            .and_then(|s| s.parse::<f64>().ok());

        Ok(InternetStatus { online: true, latency_ms: latency })
    } else {
        Ok(InternetStatus { online: false, latency_ms: None })
    }
}

// ── Uptime ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct UptimeInfo {
    pub uptime_seconds: u64,
}

#[tauri::command]
pub fn get_uptime() -> Result<UptimeInfo, String> {
    let content = std::fs::read_to_string("/proc/uptime")
        .map_err(|e| format!("Failed to read /proc/uptime: {}", e))?;
    let secs = content.split_whitespace()
        .next()
        .and_then(|s| s.parse::<f64>().ok())
        .map(|f| f as u64)
        .unwrap_or(0);
    Ok(UptimeInfo { uptime_seconds: secs })
}

// ── Terminal Launcher ────────────────────────────────────────────────────────

#[tauri::command]
pub fn open_terminal() -> Result<(), String> {
    let terminals = ["kitty", "alacritty", "gnome-terminal", "xterm"];
    for term in &terminals {
        if which_exists(term) {
            std::process::Command::new(term)
                .spawn()
                .map_err(|e| format!("Failed to launch {}: {}", term, e))?;
            return Ok(());
        }
    }
    Err("No terminal emulator found. Install kitty, alacritty, gnome-terminal, or xterm.".to_string())
}

#[tauri::command]
pub fn launch_wireshark(iface: Option<String>) -> Result<(), String> {
    if !which_exists("wireshark") {
        return Err(
            "Wireshark not found. Install it with: sudo pacman -S wireshark-qt (Arch) or sudo apt install wireshark (Debian/Ubuntu)".to_string()
        );
    }
    let mut cmd = std::process::Command::new("wireshark");
    if let Some(iface) = iface {
        cmd.args(["-i", &iface]);
    }
    cmd.spawn().map_err(|e| format!("Failed to launch wireshark: {}", e))?;
    Ok(())
}

fn which_exists(binary: &str) -> bool {
    Command::new("which")
        .arg(binary)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[tauri::command]
pub fn open_nm_connection_editor(iface: String) -> Result<(), String> {
    if !which_exists("nm-connection-editor") {
        return Err("nm-connection-editor not found. Install network-manager-applet.".to_string());
    }
    std::process::Command::new("nm-connection-editor")
        .args(["--type=802-3-ethernet", "--edit", &iface])
        .spawn()
        .map_err(|e| format!("Failed to launch nm-connection-editor: {}", e))?;
    Ok(())
}

// ── Unit tests for ss parser ─────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ss_tcp_listen() {
        let input = "Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process\ntcp   LISTEN 0      128    0.0.0.0:22         0.0.0.0:*          users:((\"sshd\",pid=1234,fd=3))\n";
        let result = parse_ss_output(input);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].protocol, "tcp");
        assert_eq!(result[0].local_port, 22);
        assert_eq!(result[0].state, "LISTEN");
        assert_eq!(result[0].pid, Some(1234));
        assert_eq!(result[0].process.as_deref(), Some("sshd"));
    }

    #[test]
    fn test_parse_ss_udp_no_process() {
        let input = "Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port\nudp   UNCONN 0      0      0.0.0.0:68         0.0.0.0:*\n";
        let result = parse_ss_output(input);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].protocol, "udp");
        assert_eq!(result[0].local_port, 68);
        assert!(result[0].pid.is_none());
    }

    #[test]
    fn test_split_addr_port_ipv4() {
        let (addr, port) = split_addr_port("192.168.1.1:80");
        assert_eq!(addr, "192.168.1.1");
        assert_eq!(port, "80");
    }

    #[test]
    fn test_split_addr_port_ipv6() {
        let (addr, port) = split_addr_port("[::1]:443");
        assert_eq!(addr, "::1");
        assert_eq!(port, "443");
    }
}

// ── SSH Quick Connect ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn ssh_connect(user: String, host: String, port: u16) -> Result<(), String> {
    // Validate inputs — no shell injection
    for val in [&user, &host] {
        if val.chars().any(|c| matches!(c, ';' | '&' | '|' | '`' | '$' | '(' | ')' | '<' | '>' | '\n' | '\r')) {
            return Err(format!("Invalid character in '{}'", val));
        }
    }

    let ssh_cmd = format!("ssh -p {} {}@{}", port, user, host);

    // Try terminal emulators in order
    let terminals: &[(&str, &[&str])] = &[
        ("kitty",         &["kitty", "--", "sh", "-c"]),
        ("alacritty",     &["alacritty", "-e", "sh", "-c"]),
        ("gnome-terminal",&["gnome-terminal", "--", "sh", "-c"]),
        ("xterm",         &["xterm", "-e", "sh", "-c"]),
        ("konsole",       &["konsole", "-e", "sh", "-c"]),
    ];

    for (name, args) in terminals {
        if which_exists(name) {
            let mut cmd = std::process::Command::new(args[0]);
            for arg in &args[1..] {
                cmd.arg(arg);
            }
            cmd.arg(&ssh_cmd);
            cmd.spawn()
                .map_err(|e| format!("Failed to launch {}: {}", name, e))?;
            return Ok(());
        }
    }

    Err("No terminal emulator found. Install kitty, alacritty, gnome-terminal, xterm, or konsole.".to_string())
}

// ── MAC Vendor Lookup ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn lookup_mac_vendor(mac: String) -> Result<String, String> {
    // Use local OUI prefix lookup via `manuf` data if available,
    // otherwise use `ip` to get vendor hint from driver info
    // Simple approach: return OUI prefix for display
    if mac.len() < 8 {
        return Err("Invalid MAC address".to_string());
    }

    // Normalize: take first 3 octets as OUI
    let oui = mac
        .split(|c| c == ':' || c == '-')
        .take(3)
        .collect::<Vec<&str>>()
        .join(":")
        .to_uppercase();

    // Try reading from system's manuf database (Wireshark installs this)
    let manuf_paths = [
        "/usr/share/wireshark/manuf",
        "/usr/share/wireshark/manuf.txt",
        "/etc/wireshark/manuf",
    ];

    for path in &manuf_paths {
        if let Ok(content) = std::fs::read_to_string(path) {
            for line in content.lines() {
                if line.starts_with('#') || line.trim().is_empty() { continue; }
                let parts: Vec<&str> = line.splitn(3, '\t').collect();
                if parts.len() >= 2 {
                    let prefix = parts[0].trim().to_uppercase();
                    // Match 3-octet OUI
                    if prefix == oui {
                        let vendor = if parts.len() >= 3 { parts[2].trim() } else { parts[1].trim() };
                        return Ok(vendor.to_string());
                    }
                }
            }
        }
    }

    // Fallback: return OUI with note
    Ok(format!("OUI: {} (install Wireshark for vendor names)", oui))
}

// ── Export Report ─────────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct SaveResult {
    pub path: String,
}

#[tauri::command]
pub fn save_report(content: String, filename: String) -> Result<SaveResult, String> {
    // Validate filename — no path traversal
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("Invalid filename".to_string());
    }

    // Save to ~/Downloads or ~/Documents
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let downloads = std::path::Path::new(&home).join("Downloads");
    let dir = if downloads.exists() {
        downloads
    } else {
        std::path::Path::new(&home).join("Documents")
    };

    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join(&filename);

    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(SaveResult {
        path: path.to_string_lossy().to_string(),
    })
}

// ── WinBox / CPT Launcher ─────────────────────────────────────────────────────

#[tauri::command]
pub fn launch_winbox(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("WinBox path is not configured. Go to Settings and set the WinBox binary path.".to_string());
    }
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(format!("WinBox binary not found at: {}", path));
    }
    std::process::Command::new(&path)
        .spawn()
        .map_err(|e| format!("Failed to launch WinBox: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn launch_packet_tracer(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("Cisco Packet Tracer path is not configured. Go to Settings and set the binary path.".to_string());
    }
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(format!("Cisco Packet Tracer binary not found at: {}", path));
    }
    std::process::Command::new(&path)
        .spawn()
        .map_err(|e| format!("Failed to launch Packet Tracer: {}", e))?;
    Ok(())
}

use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalNetwork {
    pub interface: String,
    pub network: String,
    pub local_ip: String,
    pub gateway: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanDevice {
    pub ip: String,
    pub mac: Option<String>,
    pub vendor: Option<String>,
    pub hostname: Option<String>,
    pub latency_ms: Option<f64>,
    pub status: String, // "online"
}

#[derive(Debug, Clone, Serialize)]
pub struct LanScanProgress {
    pub devices_found: u32,
    pub percent: u8,
    pub message: String,
}

/// Check whether nmap is installed on the system.
#[tauri::command]
pub async fn check_nmap_available() -> bool {
    Command::new("which")
        .arg("nmap")
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Detect local subnets from `ip -j addr show`.
#[tauri::command]
pub async fn get_local_networks() -> Result<Vec<LocalNetwork>, String> {
    let output = Command::new("ip")
        .args(["-j", "addr", "show"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("Failed to run ip addr show".to_string());
    }

    let raw: serde_json::Value =
        serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())?;

    let iface_array = raw.as_array().ok_or("Unexpected JSON shape")?;

    // Get default gateway for each interface from `ip route show`
    let route_output = Command::new("ip")
        .args(["-j", "route", "show"])
        .output()
        .await
        .unwrap_or_default();
    let routes: serde_json::Value =
        serde_json::from_slice(&route_output.stdout).unwrap_or(serde_json::json!([]));

    let mut networks: Vec<LocalNetwork> = Vec::new();

    for iface in iface_array {
        let name = iface["ifname"].as_str().unwrap_or("").to_string();
        let flags = iface["flags"]
            .as_array()
            .map(|f| f.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
            .unwrap_or_default();

        // Skip loopback and interfaces that are DOWN
        if flags.contains(&"LOOPBACK") || !flags.contains(&"UP") {
            continue;
        }

        // Also skip docker/bridge/virtual that only have link-local
        if name.starts_with("docker") || name.starts_with("br-") || name.starts_with("virbr") {
            continue;
        }

        if let Some(addr_info) = iface["addr_info"].as_array() {
            for addr in addr_info {
                let family = addr["family"].as_str().unwrap_or("");
                if family != "inet" {
                    continue;
                }

                let local_ip = addr["local"].as_str().unwrap_or("").to_string();
                let prefixlen = addr["prefixlen"].as_u64().unwrap_or(24) as u8;

                if local_ip.is_empty() {
                    continue;
                }

                // Build network CIDR from IP + prefix
                let network = ip_to_network(&local_ip, prefixlen);

                // Find gateway for this interface from routes
                let gateway = routes
                    .as_array()
                    .and_then(|arr| {
                        arr.iter().find(|r| {
                            r["dev"].as_str() == Some(&name)
                                && r["dst"].as_str() == Some("default")
                        })
                    })
                    .and_then(|r| r["gateway"].as_str())
                    .map(|s| s.to_string());

                networks.push(LocalNetwork {
                    interface: name.clone(),
                    network,
                    local_ip,
                    gateway,
                });
            }
        }
    }

    Ok(networks)
}

/// Convert an IPv4 address + prefix length to network CIDR notation.
fn ip_to_network(ip: &str, prefix: u8) -> String {
    let parts: Vec<u8> = ip
        .split('.')
        .filter_map(|p| p.parse().ok())
        .collect();

    if parts.len() != 4 {
        return format!("{}/{}", ip, prefix);
    }

    let ip_u32 = ((parts[0] as u32) << 24)
        | ((parts[1] as u32) << 16)
        | ((parts[2] as u32) << 8)
        | (parts[3] as u32);

    let mask = if prefix == 0 {
        0u32
    } else {
        u32::MAX << (32 - prefix)
    };

    let network_u32 = ip_u32 & mask;
    let a = (network_u32 >> 24) as u8;
    let b = (network_u32 >> 16) as u8;
    let c = (network_u32 >> 8) as u8;
    let d = network_u32 as u8;

    format!("{}.{}.{}.{}/{}", a, b, c, d, prefix)
}

// Global cancel flag — simplistic but sufficient for a desktop app
static SCAN_CANCEL: AtomicBool = AtomicBool::new(false);

/// Run nmap ping scan on the given network CIDR and stream results.
///
/// Uses `sudo nmap -sn --oX - <network>` for MAC+vendor info.
/// Falls back to `nmap -sn <network>` without sudo if that fails.
#[tauri::command]
pub async fn run_lan_scan(
    app: tauri::AppHandle,
    network: String,
) -> Result<Vec<LanDevice>, String> {
    SCAN_CANCEL.store(false, Ordering::Relaxed);

    // Try with sudo first (gives MAC/vendor), fallback without
    let use_sudo = sudo_available().await;

    let mut child = build_nmap_command(&network, use_sudo)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start nmap: {}", e))?;

    let stdout = child.stdout.take().ok_or("No stdout")?;
    let mut reader = BufReader::new(stdout).lines();

    let mut xml_buf = String::new();
    let mut devices: Vec<LanDevice> = Vec::new();
    let mut devices_found: u32 = 0;

    // Progress ticker: nmap doesn't output per-device until done.
    // We do a best-effort incremental progress while reading XML chunks.
    let mut percent: u8 = 5;

    // Emit initial progress
    let _ = app.emit(
        "lan_scan_progress",
        LanScanProgress {
            devices_found: 0,
            percent,
            message: format!("Scanning {}...", network),
        },
    );

    while let Ok(Some(line)) = reader.next_line().await {
        if SCAN_CANCEL.load(Ordering::Relaxed) {
            let _ = child.kill().await;
            break;
        }

        xml_buf.push_str(&line);
        xml_buf.push('\n');

        // Try to parse each <host ...>...</host> block as it arrives
        while let Some(device) = try_extract_host(&xml_buf) {
            devices_found += 1;
            devices.push(device.clone());

            // Bump progress estimate (cap at 95 until done)
            percent = percent.saturating_add(3).min(95);

            let _ = app.emit(
                "lan_scan_progress",
                LanScanProgress {
                    devices_found,
                    percent,
                    message: format!(
                        "Found {} device(s), scanning {}...",
                        devices_found, network
                    ),
                },
            );
            let _ = app.emit("lan_device_found", device);

            // Remove the consumed host block from buffer
            if let Some(end) = xml_buf.find("</host>") {
                xml_buf = xml_buf[end + "</host>".len()..].to_string();
            } else {
                break;
            }
        }
    }

    let _ = child.wait().await;

    // Final progress
    let _ = app.emit(
        "lan_scan_progress",
        LanScanProgress {
            devices_found,
            percent: 100,
            message: format!("Scan complete. {} device(s) found.", devices_found),
        },
    );
    let _ = app.emit("lan_scan_done", devices_found);

    Ok(devices)
}

/// Cancel an in-progress scan.
#[tauri::command]
pub async fn cancel_lan_scan() {
    SCAN_CANCEL.store(true, Ordering::Relaxed);
}

// ── helpers ──────────────────────────────────────────────────────────────────

async fn sudo_available() -> bool {
    Command::new("sudo")
        .args(["-n", "true"])
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn build_nmap_command(network: &str, with_sudo: bool) -> tokio::process::Command {
    if with_sudo {
        let mut c = tokio::process::Command::new("sudo");
        c.args(["-n", "nmap", "-sn", "--oX", "-", network]);
        c
    } else {
        let mut c = tokio::process::Command::new("nmap");
        c.args(["-sn", "--oX", "-", network]);
        c
    }
}

/// Try to extract one complete `<host>…</host>` block from the XML buffer
/// and parse it into a `LanDevice`.
fn try_extract_host(xml: &str) -> Option<LanDevice> {
    let start = xml.find("<host ")?;
    let end = xml[start..].find("</host>")? + start + "</host>".len();
    let host_xml = &xml[start..end];
    parse_host_xml(host_xml)
}

fn parse_host_xml(xml: &str) -> Option<LanDevice> {
    // Quick-and-dirty attribute extractor (no full XML parser dep needed)
    fn attr<'a>(xml: &'a str, tag: &str, attr_name: &str) -> Option<String> {
        let tag_start = xml.find(&format!("<{}", tag))?;
        let tag_body_start = tag_start;
        let tag_end = xml[tag_body_start..].find('>')?;
        let tag_str = &xml[tag_body_start..tag_body_start + tag_end + 1];

        let search = format!("{}=\"", attr_name);
        let val_start = tag_str.find(&search)? + search.len();
        let val_end = tag_str[val_start..].find('"')?;
        Some(tag_str[val_start..val_start + val_end].to_string())
    }

    fn attr_in<'a>(xml: &'a str, addrtype: &str, return_attr: &str) -> Option<String> {
        // Find <address addrtype="..." ... return_attr="..."/>
        let mut search_from = 0;
        while let Some(pos) = xml[search_from..].find("<address ") {
            let abs = search_from + pos;
            let tag_end = xml[abs..].find('>')?;
            let tag_str = &xml[abs..abs + tag_end + 1];

            let type_search = format!("addrtype=\"{}\"", addrtype);
            if tag_str.contains(&type_search) {
                let attr_search = format!("{}=\"", return_attr);
                if let Some(vs) = tag_str.find(&attr_search) {
                    let vs = vs + attr_search.len();
                    let ve = tag_str[vs..].find('"')?;
                    return Some(tag_str[vs..vs + ve].to_string());
                }
            }
            search_from = abs + 1;
        }
        None
    }

    // Must be "up"
    let status_state = attr(xml, "status ", "state")
        .or_else(|| {
            // <status state="up" .../>
            let s = xml.find("<status ")?;
            let e = xml[s..].find('>')?;
            let t = &xml[s..s + e + 1];
            let ss = "state=\"";
            let vs = t.find(ss)? + ss.len();
            let ve = t[vs..].find('"')?;
            Some(t[vs..vs + ve].to_string())
        })
        .unwrap_or_default();

    if status_state != "up" {
        return None;
    }

    let ip = attr_in(xml, "ipv4", "addr")?;
    let mac = attr_in(xml, "mac", "addr");
    let vendor = attr_in(xml, "mac", "vendor");

    // Hostname
    let hostname = {
        let search = "name=\"";
        xml.find(search).and_then(|vs| {
            let vs = vs + search.len();
            let ve = xml[vs..].find('"')?;
            let h = xml[vs..vs + ve].to_string();
            if h.is_empty() { None } else { Some(h) }
        })
    };

    // RTT latency (microseconds → ms)
    let latency_ms = {
        let search = "srtt=\"";
        xml.find(search).and_then(|vs| {
            let vs = vs + search.len();
            let ve = xml[vs..].find('"')?;
            xml[vs..vs + ve].parse::<f64>().ok().map(|us| us / 1000.0)
        })
    };

    Some(LanDevice {
        ip,
        mac,
        vendor,
        hostname,
        latency_ms,
        status: "online".to_string(),
    })
}

use std::collections::HashMap;
use std::process::Command;
use serde_json::Value;
use crate::models::NetworkAdapter;

/// Determine adapter type from name and flags
fn classify_adapter(name: &str, flags: &[String]) -> String {
    if name.starts_with("lo") {
        return "loopback".to_string();
    }
    if name.starts_with("wl") || name.starts_with("wlan") {
        return "wifi".to_string();
    }
    if name.starts_with("tun")
        || name.starts_with("tap")
        || name.starts_with("tailscale")
        || name.starts_with("wg")
        || name.starts_with("vpn")
    {
        return "vpn".to_string();
    }
    if name.starts_with("docker")
        || name.starts_with("br-")
        || name.starts_with("veth")
        || name.starts_with("virbr")
        || name.starts_with("vboxnet")
        || name.starts_with("vmnet")
    {
        return "virtual".to_string();
    }
    // Check BROADCAST flag to distinguish ethernet from other types
    if flags.iter().any(|f| f == "BROADCAST") {
        return "ethernet".to_string();
    }
    "virtual".to_string()
}

/// Human-readable display name
fn display_name(name: &str, adapter_type: &str) -> String {
    if name.starts_with("lo") {
        return "Loopback".to_string();
    }
    if name.starts_with("wl") || name.starts_with("wlan") {
        return "Wi-Fi".to_string();
    }
    if name.starts_with("docker") {
        return "Docker".to_string();
    }
    if name.starts_with("tailscale") {
        return "Tailscale".to_string();
    }
    if name.starts_with("wg") {
        return "WireGuard".to_string();
    }
    if name.starts_with("vboxnet") {
        return "VirtualBox Host-Only".to_string();
    }
    if name.starts_with("vmnet") {
        return "VMware Network".to_string();
    }
    if name.starts_with("virbr") {
        return "Virtual Bridge".to_string();
    }
    if name.starts_with("br-") {
        return "Docker Bridge".to_string();
    }
    if name.starts_with("veth") {
        return "Virtual Ethernet".to_string();
    }
    if name.starts_with("tun") || name.starts_with("tap") {
        return "VPN Tunnel".to_string();
    }
    match adapter_type {
        "ethernet" => "Ethernet".to_string(),
        "wifi" => "Wi-Fi".to_string(),
        "vpn" => "VPN".to_string(),
        "virtual" => "Virtual Adapter".to_string(),
        _ => name.to_string(),
    }
}

/// Parse /proc/net/dev to get bytes_rx and bytes_tx per interface
fn parse_proc_net_dev() -> HashMap<String, (u64, u64)> {
    let mut map = HashMap::new();
    let Ok(content) = std::fs::read_to_string("/proc/net/dev") else {
        return map;
    };
    // Format: iface: rx_bytes ... tx_bytes (columns 0=rx_bytes, 8=tx_bytes)
    for line in content.lines().skip(2) {
        let line = line.trim();
        let Some((iface, rest)) = line.split_once(':') else {
            continue;
        };
        let cols: Vec<&str> = rest.split_whitespace().collect();
        if cols.len() >= 9 {
            let rx = cols[0].parse::<u64>().unwrap_or(0);
            let tx = cols[8].parse::<u64>().unwrap_or(0);
            map.insert(iface.trim().to_string(), (rx, tx));
        }
    }
    map
}

/// Parse /etc/resolv.conf for nameserver entries
fn parse_resolv_conf() -> Vec<String> {
    let Ok(content) = std::fs::read_to_string("/etc/resolv.conf") else {
        return vec![];
    };
    content
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.starts_with("nameserver") {
                line.split_whitespace().nth(1).map(|s| s.to_string())
            } else {
                None
            }
        })
        .collect()
}

/// Parse `ip -j route show` to build interface -> gateway map
fn parse_gateways() -> HashMap<String, String> {
    let mut map = HashMap::new();
    let Ok(output) = Command::new("ip")
        .args(["-j", "route", "show"])
        .output()
    else {
        return map;
    };
    let Ok(json) = serde_json::from_slice::<Vec<Value>>(&output.stdout) else {
        return map;
    };
    for route in &json {
        // Only pick routes with a gateway (skip on-link routes)
        if let (Some(dev), Some(gw)) = (
            route["dev"].as_str(),
            route["gateway"].as_str(),
        ) {
            // Prefer the default route gateway per interface; don't overwrite if already set
            map.entry(dev.to_string()).or_insert_with(|| gw.to_string());
        }
    }
    map
}

/// Read driver name from sysfs
fn read_driver(name: &str) -> Option<String> {
    let link = std::fs::read_link(format!("/sys/class/net/{}/device/driver", name)).ok()?;
    link.file_name()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string())
}

#[tauri::command]
pub fn list_adapters() -> Result<Vec<NetworkAdapter>, String> {
    // Run `ip -j addr show`
    let output = Command::new("ip")
        .args(["-j", "addr", "show"])
        .output()
        .map_err(|e| format!("Failed to run ip: {}", e))?;

    let json: Vec<Value> =
        serde_json::from_slice(&output.stdout).map_err(|e| format!("JSON parse error: {}", e))?;

    let traffic = parse_proc_net_dev();
    let gateways = parse_gateways();
    let dns_servers = parse_resolv_conf();

    let mut adapters = Vec::new();

    for iface in &json {
        let name = match iface["ifname"].as_str() {
            Some(n) => n.to_string(),
            None => continue,
        };

        // Collect flags
        let flags: Vec<String> = iface["flags"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();

        let adapter_type = classify_adapter(&name, &flags);
        let display = display_name(&name, &adapter_type);

        // State
        let operstate = iface["operstate"].as_str().unwrap_or("UNKNOWN");
        let state = match operstate.to_uppercase().as_str() {
            "UP" => "connected",
            "DOWN" => "disconnected",
            "UNKNOWN" => {
                // loopback typically shows as UNKNOWN but is active
                if flags.iter().any(|f| f == "UP") {
                    "connected"
                } else {
                    "unknown"
                }
            }
            _ => "unknown",
        }
        .to_string();

        // MAC
        let mac = iface["address"].as_str().map(String::from);

        // MTU
        let mtu = iface["mtu"].as_u64().unwrap_or(1500) as u32;

        // Parse addr_info for IPv4 and IPv6
        let mut ipv4: Option<String> = None;
        let mut ipv4_prefix: Option<u8> = None;
        let mut ipv6: Option<String> = None;

        if let Some(addr_info) = iface["addr_info"].as_array() {
            for addr in addr_info {
                let family = addr["family"].as_str().unwrap_or("");
                match family {
                    "inet" if ipv4.is_none() => {
                        ipv4 = addr["local"].as_str().map(String::from);
                        ipv4_prefix = addr["prefixlen"].as_u64().map(|n| n as u8);
                    }
                    "inet6" if ipv6.is_none() => {
                        // Skip link-local unless it's the only one
                        let addr_str = addr["local"].as_str().unwrap_or("");
                        if !addr_str.starts_with("fe80") {
                            ipv6 = Some(addr_str.to_string());
                        }
                    }
                    _ => {}
                }
            }
            // If no global IPv6, take link-local as fallback
            if ipv6.is_none() {
                for addr in addr_info {
                    if addr["family"].as_str() == Some("inet6") {
                        ipv6 = addr["local"].as_str().map(String::from);
                        break;
                    }
                }
            }
        }

        // Gateway from route table
        let gateway = gateways.get(&name).cloned();

        // DNS — assign to connected adapters
        let dns = if state == "connected" && !dns_servers.is_empty() {
            dns_servers.clone()
        } else {
            vec![]
        };

        // Traffic stats
        let (bytes_rx, bytes_tx) = traffic.get(&name).copied().unwrap_or((0, 0));

        // Driver
        let driver = read_driver(&name);

        adapters.push(NetworkAdapter {
            name,
            display_name: display,
            adapter_type,
            state,
            ipv4,
            ipv4_prefix,
            ipv6,
            gateway,
            dns,
            mac,
            mtu,
            speed: None, // speed requires ethtool or sysfs ioctl — skip for now
            driver,
            bytes_rx,
            bytes_tx,
            connected_since: None,
        });
    }

    Ok(adapters)
}

#[tauri::command]
pub fn enable_adapter(iface: String) -> Result<(), String> {
    let output = Command::new("nmcli")
        .args(["device", "connect", &iface])
        .output()
        .map_err(|e| format!("Failed to run nmcli: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("nmcli error: {}", stderr.trim()))
    }
}

#[tauri::command]
pub fn disable_adapter(iface: String) -> Result<(), String> {
    let output = Command::new("nmcli")
        .args(["device", "disconnect", &iface])
        .output()
        .map_err(|e| format!("Failed to run nmcli: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("nmcli error: {}", stderr.trim()))
    }
}

#[tauri::command]
pub fn renew_dhcp(iface: String) -> Result<(), String> {
    let output = Command::new("nmcli")
        .args(["device", "reapply", &iface])
        .output()
        .map_err(|e| format!("Failed to run nmcli: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("nmcli error: {}", stderr.trim()))
    }
}

/// Generic nmcli command — used by frontend to apply network configuration
#[tauri::command]
pub fn run_nmcli_command(args: Vec<String>) -> Result<String, String> {
    // Validate: must start with known safe subcommands
    let first = args.first().map(|s| s.as_str()).unwrap_or("");
    if !["connection", "device", "radio", "networking"].contains(&first) {
        return Err(format!("Unsupported nmcli subcommand: {}", first));
    }

    let output = Command::new("nmcli")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to run nmcli: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        Err(format!("{}{}", stderr.trim(), stdout.trim()))
    }
}

/// Resolve NetworkManager connection name from interface device name.
/// `nmcli -t -f NAME,DEVICE connection show` returns "ConnName:device" per line.
fn resolve_connection_name(iface: &str) -> Option<String> {
    let output = Command::new("nmcli")
        .args(["-t", "-f", "NAME,DEVICE", "connection", "show"])
        .output()
        .ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let parts: Vec<&str> = line.splitn(2, ':').collect();
        if parts.len() == 2 && parts[1].trim() == iface {
            return Some(parts[0].trim().to_string());
        }
    }
    None
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct Ipv4Config {
    pub method: String,       // "auto" | "manual"
    pub address: Option<String>,
    pub prefix: Option<u8>,
    pub gateway: Option<String>,
    pub dns: Vec<String>,
}

/// Get the current IPv4 method (auto/manual) for an interface via nmcli
#[tauri::command]
pub fn get_ipv4_config(iface: String) -> Result<Ipv4Config, String> {
    let conn_name = resolve_connection_name(&iface)
        .ok_or_else(|| format!("No NetworkManager connection found for '{}'", iface))?;

    let output = Command::new("nmcli")
        .args(["-t", "-f",
               "ipv4.method,ipv4.addresses,ipv4.gateway,ipv4.dns",
               "connection", "show", &conn_name])
        .output()
        .map_err(|e| format!("nmcli failed: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("nmcli error: {}", err.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut method = "auto".to_string();
    let mut address: Option<String> = None;
    let mut prefix: Option<u8> = None;
    let mut gateway: Option<String> = None;
    let mut dns: Vec<String> = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.splitn(2, ':').collect();
        if parts.len() != 2 { continue; }
        let key = parts[0].trim();
        let val = parts[1].trim();

        match key {
            "ipv4.method" => { method = val.to_string(); }
            "ipv4.addresses" => {
                if !val.is_empty() {
                    // Format: "192.168.1.100/24"
                    let addr_parts: Vec<&str> = val.splitn(2, '/').collect();
                    address = Some(addr_parts[0].to_string());
                    if addr_parts.len() > 1 {
                        prefix = addr_parts[1].parse::<u8>().ok();
                    }
                }
            }
            "ipv4.gateway" => {
                if !val.is_empty() && val != "--" {
                    gateway = Some(val.to_string());
                }
            }
            "ipv4.dns" => {
                if !val.is_empty() && val != "--" {
                    dns = val.split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                }
            }
            _ => {}
        }
    }

    Ok(Ipv4Config { method, address, prefix, gateway, dns })
}

/// Apply IPv4 configuration to a network interface via NetworkManager
#[tauri::command]
pub fn apply_ipv4_config(iface: String, config: Ipv4Config) -> Result<(), String> {
    let conn_name = resolve_connection_name(&iface)
        .ok_or_else(|| format!("No NetworkManager connection found for '{}'.\nMake sure the interface is managed by NetworkManager.", iface))?;

    let mut args = vec![
        "connection".to_string(),
        "modify".to_string(),
        conn_name.clone(),
    ];

    if config.method == "auto" {
        // Switch to DHCP
        args.extend_from_slice(&[
            "ipv4.method".to_string(), "auto".to_string(),
            "ipv4.addresses".to_string(), "".to_string(),
            "ipv4.gateway".to_string(), "".to_string(),
            "ipv4.dns".to_string(), "".to_string(),
        ]);
    } else {
        // Static IP
        let addr = config.address.ok_or("IP address is required for static config")?;
        let pfx = config.prefix.unwrap_or(24);
        let gw = config.gateway.unwrap_or_default();
        let dns_str = config.dns.join(",");

        args.extend_from_slice(&[
            "ipv4.method".to_string(), "manual".to_string(),
            "ipv4.addresses".to_string(), format!("{}/{}", addr, pfx),
            "ipv4.gateway".to_string(), gw,
            "ipv4.dns".to_string(), dns_str,
        ]);
    }

    let modify_output = Command::new("nmcli")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to run nmcli: {}", e))?;

    if !modify_output.status.success() {
        let err = String::from_utf8_lossy(&modify_output.stderr);
        return Err(format!("nmcli modify failed: {}", err.trim()));
    }

    // Bring connection back up to apply
    let up_output = Command::new("nmcli")
        .args(["connection", "up", &conn_name])
        .output()
        .map_err(|e| format!("Failed to bring connection up: {}", e))?;

    if !up_output.status.success() {
        let err = String::from_utf8_lossy(&up_output.stderr);
        return Err(format!("nmcli connection up failed: {}", err.trim()));
    }

    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct Ipv6Config {
    pub method: String,       // "auto" | "manual" | "ignore" | "disabled"
    pub address: Option<String>,
    pub prefix: Option<u8>,
    pub gateway: Option<String>,
    pub dns: Vec<String>,
}

#[tauri::command]
pub fn get_ipv6_config(iface: String) -> Result<Ipv6Config, String> {
    let conn_name = resolve_connection_name(&iface)
        .ok_or_else(|| format!("No NetworkManager connection found for '{}'", iface))?;

    let output = Command::new("nmcli")
        .args(["-t", "-f",
               "ipv6.method,ipv6.addresses,ipv6.gateway,ipv6.dns",
               "connection", "show", &conn_name])
        .output()
        .map_err(|e| format!("nmcli failed: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("nmcli error: {}", err.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut method = "auto".to_string();
    let mut address: Option<String> = None;
    let mut prefix: Option<u8> = None;
    let mut gateway: Option<String> = None;
    let mut dns: Vec<String> = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.splitn(2, ':').collect();
        if parts.len() != 2 { continue; }
        let key = parts[0].trim();
        let val = parts[1].trim();

        match key {
            "ipv6.method" => { method = val.to_string(); }
            "ipv6.addresses" => {
                if !val.is_empty() && val != "--" {
                    let addr_parts: Vec<&str> = val.splitn(2, '/').collect();
                    address = Some(addr_parts[0].to_string());
                    if addr_parts.len() > 1 {
                        prefix = addr_parts[1]
                            .split(|c: char| !c.is_ascii_digit())
                            .next()
                            .and_then(|s| s.parse::<u8>().ok());
                    }
                }
            }
            "ipv6.gateway" => {
                if !val.is_empty() && val != "--" {
                    gateway = Some(val.to_string());
                }
            }
            "ipv6.dns" => {
                if !val.is_empty() && val != "--" {
                    dns = val.split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                }
            }
            _ => {}
        }
    }

    Ok(Ipv6Config { method, address, prefix, gateway, dns })
}

#[tauri::command]
pub fn apply_ipv6_config(iface: String, config: Ipv6Config) -> Result<(), String> {
    let conn_name = resolve_connection_name(&iface)
        .ok_or_else(|| format!("No NetworkManager connection found for '{}'", iface))?;

    let mut args = vec![
        "connection".to_string(),
        "modify".to_string(),
        conn_name.clone(),
    ];

    match config.method.as_str() {
        "auto" => {
            args.extend_from_slice(&[
                "ipv6.method".to_string(), "auto".to_string(),
                "ipv6.addresses".to_string(), "".to_string(),
                "ipv6.gateway".to_string(), "".to_string(),
                "ipv6.dns".to_string(), "".to_string(),
            ]);
        }
        "disabled" | "ignore" => {
            args.extend_from_slice(&[
                "ipv6.method".to_string(), config.method.clone(),
            ]);
        }
        "manual" => {
            let addr = config.address.ok_or("IPv6 address is required for manual config")?;
            let pfx = config.prefix.unwrap_or(64);
            let gw = config.gateway.unwrap_or_default();
            let dns_str = config.dns.join(",");
            args.extend_from_slice(&[
                "ipv6.method".to_string(), "manual".to_string(),
                "ipv6.addresses".to_string(), format!("{}/{}", addr, pfx),
                "ipv6.gateway".to_string(), gw,
                "ipv6.dns".to_string(), dns_str,
            ]);
        }
        _ => {
            return Err(format!("Unknown IPv6 method: {}", config.method));
        }
    }

    let modify = Command::new("nmcli")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to run nmcli: {}", e))?;

    if !modify.status.success() {
        let err = String::from_utf8_lossy(&modify.stderr);
        return Err(format!("nmcli modify failed: {}", err.trim()));
    }

    let up = Command::new("nmcli")
        .args(["connection", "up", &conn_name])
        .output()
        .map_err(|e| format!("Failed to bring connection up: {}", e))?;

    if !up.status.success() {
        let err = String::from_utf8_lossy(&up.stderr);
        return Err(format!("nmcli connection up failed: {}", err.trim()));
    }

    Ok(())
}

/// Apply only DNS to a connection (IPv4 DNS, works for both tabs)
#[tauri::command]
pub fn apply_dns_config(iface: String, dns: Vec<String>) -> Result<(), String> {
    let conn_name = resolve_connection_name(&iface)
        .ok_or_else(|| format!("No NetworkManager connection found for '{}'", iface))?;

    let dns_str = dns.join(",");

    let modify = Command::new("nmcli")
        .args(["connection", "modify", &conn_name,
               "ipv4.dns", &dns_str])
        .output()
        .map_err(|e| format!("Failed to run nmcli: {}", e))?;

    if !modify.status.success() {
        let err = String::from_utf8_lossy(&modify.stderr);
        return Err(format!("nmcli modify failed: {}", err.trim()));
    }

    let up = Command::new("nmcli")
        .args(["connection", "up", &conn_name])
        .output()
        .map_err(|e| format!("Failed to bring connection up: {}", e))?;

    if !up.status.success() {
        let err = String::from_utf8_lossy(&up.stderr);
        return Err(format!("nmcli connection up failed: {}", err.trim()));
    }

    Ok(())
}

use serde::{Deserialize, Serialize};
use tokio::process::Command;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VlanInterface {
    pub name: String,             // "eth0.10"
    pub vlan_id: u16,             // 10
    pub parent_interface: String, // "eth0"
    pub state: String,            // "UP" | "DOWN" | "UNKNOWN"
    pub ipv4: Option<String>,     // "10.0.10.1/24"
    pub mac: Option<String>,
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Return all VLAN interfaces configured on the system.
/// Returns an empty Vec (not an error) if none exist.
#[tauri::command]
pub async fn get_vlan_info() -> Result<Vec<VlanInterface>, String> {
    // `ip -j link show type vlan` lists all VLAN sub-interfaces
    let output = Command::new("ip")
        .args(["-j", "link", "show", "type", "vlan"])
        .output()
        .await
        .map_err(|e| format!("Failed to run ip link: {}", e))?;

    if !output.status.success() {
        // ip may return non-zero if no VLANs exist — treat as empty
        return Ok(Vec::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() || stdout == "[]" || stdout == "null" {
        return Ok(Vec::new());
    }

    let json: serde_json::Value =
        serde_json::from_str(&stdout).map_err(|e| format!("JSON parse error: {}", e))?;

    let ifaces = match json.as_array() {
        Some(a) => a,
        None => return Ok(Vec::new()),
    };

    // Collect IP addresses in a second call: `ip -j addr show`
    let addr_output = Command::new("ip")
        .args(["-j", "addr", "show"])
        .output()
        .await
        .ok();

    let addr_json: serde_json::Value = addr_output
        .and_then(|o| serde_json::from_slice(&o.stdout).ok())
        .unwrap_or(serde_json::json!([]));

    let mut result = Vec::new();

    for iface in ifaces {
        let name = iface["ifname"].as_str().unwrap_or("").to_string();
        if name.is_empty() {
            continue;
        }

        // Flags
        let flags = iface["flags"]
            .as_array()
            .map(|f| f.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
            .unwrap_or_default();
        let state = if flags.contains(&"UP") { "UP" } else { "DOWN" }.to_string();

        // MAC
        let mac = iface["address"].as_str().map(|s| s.to_string());

        // VLAN ID + parent from link_type_info
        let vlan_id: u16 = iface["linkinfo"]["info_data"]["id"]
            .as_u64()
            .unwrap_or(0) as u16;
        let parent_interface = iface["link"].as_str().unwrap_or("").to_string();

        // IPv4 from addr table
        let ipv4 = find_ipv4_for(&addr_json, &name);

        result.push(VlanInterface {
            name,
            vlan_id,
            parent_interface,
            state,
            ipv4,
            mac,
        });
    }

    // Sort by VLAN ID
    result.sort_by_key(|v| v.vlan_id);

    Ok(result)
}

// ─── Helper ───────────────────────────────────────────────────────────────────

fn find_ipv4_for(addr_json: &serde_json::Value, iface_name: &str) -> Option<String> {
    let arr = addr_json.as_array()?;
    let iface = arr
        .iter()
        .find(|i| i["ifname"].as_str() == Some(iface_name))?;

    iface["addr_info"].as_array()?.iter().find_map(|a| {
        if a["family"].as_str() == Some("inet") {
            let local = a["local"].as_str()?;
            let prefix = a["prefixlen"].as_u64().unwrap_or(24);
            Some(format!("{}/{}", local, prefix))
        } else {
            None
        }
    })
}

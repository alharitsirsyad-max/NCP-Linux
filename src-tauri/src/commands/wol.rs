use serde::{Deserialize, Serialize};
use std::net::UdpSocket;
use std::path::PathBuf;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WolTarget {
    pub name: String,
    pub mac: String,
    pub broadcast: String, // e.g. "192.168.1.255" or "255.255.255.255"
    pub port: u16,         // default: 9
}

// ─── Commands ────────────────────────────────────────────────────────────────

/// Send a Wake-on-LAN magic packet to the given target.
///
/// Magic packet format: 6 × 0xFF + MAC repeated 16 times = 102 bytes.
#[tauri::command]
pub async fn send_wol(target: WolTarget) -> Result<String, String> {
    // Validate and parse MAC
    let mac_bytes = parse_mac(&target.mac)?;

    // Build magic packet
    let mut packet = [0u8; 102];
    // First 6 bytes: 0xFF
    for b in &mut packet[..6] {
        *b = 0xFF;
    }
    // Remaining 96 bytes: MAC repeated 16 times
    for i in 0..16 {
        let offset = 6 + i * 6;
        packet[offset..offset + 6].copy_from_slice(&mac_bytes);
    }

    // Send via UDP broadcast
    let bind_addr = "0.0.0.0:0";
    let socket = UdpSocket::bind(bind_addr)
        .map_err(|e| format!("Failed to create UDP socket: {}", e))?;

    socket
        .set_broadcast(true)
        .map_err(|e| format!("Failed to set SO_BROADCAST: {}", e))?;

    let target_addr = format!("{}:{}", target.broadcast, target.port);
    socket
        .send_to(&packet, &target_addr)
        .map_err(|e| format!("Failed to send magic packet to {}: {}", target_addr, e))?;

    Ok(format!(
        "Magic packet sent to {} ({})",
        target.mac, target.name
    ))
}

/// Save WoL targets list to disk.
/// Path: ~/.local/share/network.control.panel/wol_targets.json
#[tauri::command]
pub async fn save_wol_targets(targets: Vec<WolTarget>) -> Result<(), String> {
    let path = wol_data_path()?;
    let json =
        serde_json::to_string_pretty(&targets).map_err(|e| format!("Serialize error: {}", e))?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write {}: {}", path.display(), e))
}

/// Load WoL targets from disk. Returns empty vec if file does not exist.
#[tauri::command]
pub async fn load_wol_targets() -> Result<Vec<WolTarget>, String> {
    let path = wol_data_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("JSON parse error: {}", e))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Returns path to ~/.local/share/network.control.panel/wol_targets.json
fn wol_data_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let dir = PathBuf::from(home)
        .join(".local")
        .join("share")
        .join("network.control.panel");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Cannot create data dir: {}", e))?;
    Ok(dir.join("wol_targets.json"))
}

/// Parse a MAC address string (colon, dash, or no separator) into [u8; 6].
///
/// Accepts: "e4:5f:01:ab:cd:12", "e45f01abcd12", "E4-5F-01-AB-CD-12"
pub fn parse_mac(mac: &str) -> Result<[u8; 6], String> {
    // Remove common separators
    let clean: String = mac
        .chars()
        .filter(|&c| c != ':' && c != '-' && c != '.')
        .collect();

    if clean.len() != 12 {
        return Err(format!(
            "Invalid MAC address '{}': expected 12 hex digits after removing separators",
            mac
        ));
    }

    let mut bytes = [0u8; 6];
    for (i, chunk) in clean
        .as_bytes()
        .chunks(2)
        .enumerate()
    {
        let hex = std::str::from_utf8(chunk)
            .map_err(|_| format!("Invalid UTF-8 in MAC address: {}", mac))?;
        bytes[i] = u8::from_str_radix(hex, 16)
            .map_err(|_| format!("Invalid hex byte '{}' in MAC address: {}", hex, mac))?;
    }
    Ok(bytes)
}

// ─── Validation helper (also exported for frontend use) ───────────────────────

/// Validate a MAC address string — returns true if valid.
#[tauri::command]
pub fn validate_mac(mac: String) -> bool {
    parse_mac(&mac).is_ok()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_mac_colon() {
        let bytes = parse_mac("e4:5f:01:ab:cd:12").unwrap();
        assert_eq!(bytes, [0xe4, 0x5f, 0x01, 0xab, 0xcd, 0x12]);
    }

    #[test]
    fn test_parse_mac_dash() {
        let bytes = parse_mac("E4-5F-01-AB-CD-12").unwrap();
        assert_eq!(bytes, [0xe4, 0x5f, 0x01, 0xab, 0xcd, 0x12]);
    }

    #[test]
    fn test_parse_mac_plain() {
        let bytes = parse_mac("e45f01abcd12").unwrap();
        assert_eq!(bytes, [0xe4, 0x5f, 0x01, 0xab, 0xcd, 0x12]);
    }

    #[test]
    fn test_parse_mac_invalid() {
        assert!(parse_mac("e4:5f:01:ab:cd").is_err()); // too short
        assert!(parse_mac("zz:5f:01:ab:cd:12").is_err()); // invalid hex
    }

    #[test]
    fn test_magic_packet_length() {
        // We just need to verify the packet structure builds correctly
        let mac_bytes = parse_mac("e4:5f:01:ab:cd:12").unwrap();
        let mut packet = [0u8; 102];
        for b in &mut packet[..6] { *b = 0xFF; }
        for i in 0..16 {
            let offset = 6 + i * 6;
            packet[offset..offset + 6].copy_from_slice(&mac_bytes);
        }
        // First 6 bytes must be 0xFF
        assert!(packet[..6].iter().all(|&b| b == 0xFF));
        // Bytes 6..12 must equal the MAC
        assert_eq!(&packet[6..12], &mac_bytes);
        // Bytes 96..102 (last repetition) must also equal the MAC
        assert_eq!(&packet[96..102], &mac_bytes);
    }
}

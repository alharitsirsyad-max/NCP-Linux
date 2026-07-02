use serde::{Deserialize, Serialize};

#[allow(dead_code)]

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NetworkAdapter {
    pub name: String,
    pub display_name: String,
    pub adapter_type: String,
    pub state: String,
    pub ipv4: Option<String>,
    pub ipv4_prefix: Option<u8>,
    pub ipv6: Option<String>,
    pub gateway: Option<String>,
    pub dns: Vec<String>,
    pub mac: Option<String>,
    pub mtu: u32,
    pub speed: Option<u32>,
    pub driver: Option<String>,
    pub bytes_rx: u64,
    pub bytes_tx: u64,
    pub connected_since: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemInfo {
    pub hostname: String,
    pub username: String,
    pub distro: String,
    pub kernel: String,
    pub uptime_seconds: u64,
    pub public_ip: Option<String>,
    pub nm_status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RouteEntry {
    pub destination: String,
    pub gateway: Option<String>,
    pub interface: String,
    pub metric: u32,
    pub protocol: String,
    pub scope: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ArpEntry {
    pub ip: String,
    pub mac: String,
    pub interface: String,
    pub state: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PortEntry {
    pub protocol: String,
    pub local_address: String,
    pub local_port: u16,
    pub state: String,
    pub pid: Option<u32>,
    pub process: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpeedTestResult {
    pub ping: f64,
    pub download: f64,      // Mbps
    pub upload: f64,        // Mbps
    pub server_name: String,
    pub server_country: String,
    pub isp: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpeedTestProgress {
    pub stage: String,               // "ping" | "download" | "upload" | "done" | "error"
    pub percent: u8,                 // 0-100
    pub current_value: Option<f64>,
    pub message: String,
}

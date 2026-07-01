export type AdapterType = "ethernet" | "wifi" | "loopback" | "virtual" | "vpn";
export type AdapterState = "connected" | "disconnected" | "unavailable" | "unknown";

export interface NetworkAdapter {
  name: string;              // "enp5s0"
  display_name: string;      // "Ethernet"
  adapter_type: AdapterType;
  state: AdapterState;
  ipv4: string | null;       // "192.168.1.100"
  ipv4_prefix: number | null; // 24
  ipv6: string | null;
  gateway: string | null;
  dns: string[];
  mac: string | null;
  mtu: number;
  speed: number | null;      // Mbps
  driver: string | null;
  bytes_rx: number;
  bytes_tx: number;
  connected_since: string | null;
}

export interface PingLine {
  seq: number;
  ttl: number;
  time_ms: number;
  status: "success" | "timeout";
}

export interface PingResult {
  target: string;
  packets_sent: number;
  packets_received: number;
  packet_loss: number;
  rtt_min: number;
  rtt_avg: number;
  rtt_max: number;
  lines: PingLine[];
}

export interface RouteEntry {
  destination: string;
  gateway: string | null;
  interface: string;
  metric: number;
  protocol: string;
  scope: string;
}

export interface ArpEntry {
  ip: string;
  mac: string;
  interface: string;
  state: string;
}

export interface PortEntry {
  protocol: "tcp" | "udp";
  local_address: string;
  local_port: number;
  state: string;
  pid: number | null;
  process: string | null;
}

export interface SystemInfo {
  hostname: string;
  username: string;
  distro: string;
  kernel: string;
  uptime_seconds: number;
  public_ip: string | null;
  nm_status: string;
}

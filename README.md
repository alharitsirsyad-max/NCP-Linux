<div align="center">
  <img src="src/assets/ncp.png" alt="Network Control Panel" width="96" />
  <h1>Network Control Panel</h1>
  <p>Linux desktop app for network configuration, monitoring, and diagnostics.</p>
  <p>Built with <strong>Tauri v2</strong> + <strong>React</strong> + <strong>TypeScript</strong> · Inspired by Windows Network Connections</p>

  <p>
    <img src="https://img.shields.io/badge/platform-Linux-blue?style=flat-square" alt="Platform: Linux" />
    <img src="https://img.shields.io/badge/built_with-Tauri_v2-orange?style=flat-square" alt="Tauri v2" />
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License" />
    <img src="https://img.shields.io/badge/version-0.2.0-blue?style=flat-square" alt="Version 0.2.0" />
  </p>
</div>

---

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/alharitsirsyad-max/NCP-Linux/main/scripts/install.sh | bash
```

Otomatis install semua dependencies + aplikasi + membuat shortcut di app launcher.  
Supports: **Arch Linux, Ubuntu, Debian, Linux Mint, Fedora, openSUSE**.

---

## Features

### Core — Adapter & Network

| Feature | Description |
|---|---|
| **Adapter Management** | View all interfaces with real-time status, IP, gateway, MAC, MTU, driver. Enable/disable via NetworkManager |
| **IPv4/IPv6/DNS Edit** | Edit IP configuration, DNS servers, and IPv6 settings directly via `nmcli` |
| **Renew DHCP** | Reapply DHCP lease with one click |
| **Dashboard** | System info, network summary, internet status, real-time bandwidth graph |
| **Routing Table** | View `ip route` output filtered by interface |
| **ARP Table** | ARP cache with color-coded state + MAC vendor lookup |
| **Open Ports** | `ss -tulnp` output with TCP/UDP and listening-only filters |

### Diagnostics

| Feature | Description |
|---|---|
| **Ping** | Streaming real-time output with per-line color coding and RTT summary |
| **Traceroute** | Hop-by-hop traceroute with streaming output |
| **MTR** | Combined ping + traceroute, realtime table with loss%, latency per hop |
| **DNS Lookup** | Query A, AAAA, MX, CNAME, TXT, NS, PTR records via `dig` |
| **Whois** | Domain/IP whois lookup with syntax highlighting |
| **IP/CIDR Calculator** | Network address, broadcast, host range, subnet mask — pure frontend |

### Tools

| Feature | Description |
|---|---|
| **LAN Scanner** | Scan active devices on local network via `nmap` — shows IP, MAC, vendor, hostname, latency. Realtime rows. Requires `nmap` |
| **DNS Benchmark** | Compare latency of public DNS servers (Cloudflare, Google, Quad9, OpenDNS, AdGuard, ISP). Bar chart ranking with expand detail |
| **Wake-on-LAN** | Send magic packet to wake devices. Saved device list persisted to disk. Quick Wake mode |
| **Wi-Fi Analyzer** | Scan nearby Wi-Fi networks via `nmcli`. Signal bars, band detection, channel usage chart with "crowded" warning |
| **Traffic Monitor** | Realtime download/upload graph per interface using `/proc/net/dev`. SVG chart, 1m/5m/1h history |
| **VLAN Info** | Show all VLAN sub-interfaces (`ip link type vlan`). Empty state with setup instructions |
| **Packet Capture** | Capture packets via `sudo tcpdump`. BPF filter input, stop by time/packet count, open in Wireshark. Requires `tcpdump` |
| **Firewall Manager** | View and manage UFW rules. Add/delete rules, enable/disable firewall. All destructive actions require confirm dialog |
| **Bandwidth/Process** | Show per-process network usage via `sudo nethogs`. Realtime sorted table. Requires `nethogs` |
| **Speed Test** | Internet speed test via `speedtest-cli` — ping, download, upload with realtime gauge |
| **SSH Quick Connect** | Saved hosts, recent connections, quick connect — opens in terminal emulator |

### UI & System

| Feature | Description |
|---|---|
| **Context Menu** | Right-click adapter: Copy IP/MAC/DNS, Ping, Traceroute, Enable/Disable, Wake-on-LAN |
| **Status Bar** | Realtime download/upload speed, uptime, internet status |
| **Notifications** | Toast notifications when adapters connect/disconnect |
| **Export Report** | Export diagnostic results to `.txt` in `~/Downloads` |
| **Settings** | Terminal emulator, refresh interval, WinBox path, Packet Tracer path |
| **Keyboard Shortcuts** | `Ctrl+D` Diagnostics · `Ctrl+R`/`F5` Refresh · `Ctrl+,` Settings |
| **Menu Bar** | File / View / Tools / Help with functional dropdown menus |

---

## Installation

### One-line install (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/alharitsirsyad-max/NCP-Linux/main/scripts/install.sh | bash
```

The script will:
- Detect your distro automatically
- Install all required system dependencies
- Download and install the app binary or `.deb`/`.rpm` package
- Create a desktop shortcut in your app launcher
- Enable NetworkManager if not running

### Manual — Debian/Ubuntu

```bash
wget https://github.com/alharitsirsyad-max/NCP-Linux/releases/latest/download/network-control-panel_0.2.0_amd64.deb
sudo dpkg -i network-control-panel_0.2.0_amd64.deb
```

### Manual — Arch Linux

```bash
# Download binary from GitHub releases
wget https://github.com/alharitsirsyad-max/NCP-Linux/releases/latest/download/network-control-panel
chmod +x network-control-panel
mv network-control-panel ~/.local/bin/
```

---

## Runtime Dependencies

The app uses standard Linux CLI tools. Install any that are missing:

| Tool | Package (Arch) | Package (Ubuntu/Debian) | Purpose |
|---|---|---|---|
| `nmcli` | `networkmanager` | `network-manager` | Adapter management |
| `ip` | `iproute2` | `iproute2` | Adapter list, routing, ARP |
| `ping` | `iputils` | `iputils-ping` | Ping diagnostics |
| `dig` | `bind` | `dnsutils` | DNS lookup + DNS Benchmark |
| `traceroute` | `traceroute` | `traceroute` | Traceroute |
| `mtr` | `mtr` | `mtr-tiny` | MTR diagnostics |
| `whois` | `whois` | `whois` | Whois lookup |
| `ss` | `iproute2` | `iproute2` | Open ports |
| `speedtest-cli` | `speedtest-cli` | `speedtest-cli` | Speed test |
| `nmap` | `nmap` | `nmap` | LAN Scanner _(optional)_ |
| `tcpdump` | `tcpdump` | `tcpdump` | Packet Capture _(optional, needs sudo)_ |
| `nethogs` | `nethogs` | `nethogs` | Bandwidth per Process _(optional, needs sudo)_ |
| `ufw` | `ufw` | `ufw` | Firewall Manager _(optional)_ |
| `wireshark` | `wireshark-qt` | `wireshark` | Open captures in Wireshark _(optional)_ |

> **Note:** Tools marked _optional_ only affect the feature they power — the rest of the app works without them.

---

## Build from Source

### Prerequisites

**Arch Linux:**
```bash
sudo pacman -S rust nodejs pnpm webkit2gtk base-devel \
  networkmanager iproute2 iputils bind traceroute mtr whois \
  nmap tcpdump nethogs ufw
```

**Ubuntu/Debian:**
```bash
sudo apt install rustup nodejs build-essential libwebkit2gtk-4.1-dev \
  libssl-dev libgtk-3-dev network-manager iproute2 dnsutils \
  traceroute mtr-tiny whois nmap tcpdump nethogs ufw
curl -fsSL https://get.pnpm.io/install.sh | sh
```

### Build

```bash
git clone https://github.com/alharitsirsyad-max/NCP-Linux.git
cd NCP-Linux
pnpm install
pnpm tauri dev          # development mode
pnpm tauri build        # production build
```

Build output:
```
src-tauri/target/release/bundle/deb/network-control-panel_0.2.0_amd64.deb
src-tauri/target/release/bundle/rpm/network-control-panel-0.2.0-1.x86_64.rpm
src-tauri/target/release/network-control-panel  (binary)
```

---

## Architecture

```
Frontend (React 19 + TypeScript)
  └── Tauri v2 IPC bridge (invoke / events)
        └── Rust backend
              ├── nmcli          → adapter management, IPv4/IPv6/DNS config
              ├── ip             → adapter list, routing table, ARP
              ├── ping / mtr / traceroute / dig / whois → diagnostics
              ├── ss             → open ports
              ├── speedtest-cli  → speed test
              ├── nmap           → LAN scanner
              ├── nethogs        → bandwidth per process
              ├── tcpdump        → packet capture
              ├── ufw            → firewall management
              ├── UDP socket     → Wake-on-LAN (pure Rust, no binary needed)
              └── /proc/net/dev, /proc/uptime → realtime stats
```

---

## Sudo Requirements

Some features require passwordless `sudo` for the relevant binary.  
Add to `/etc/sudoers.d/ncp` (replace `YOUR_USER`):

```
YOUR_USER ALL=(ALL) NOPASSWD: /usr/bin/nmap
YOUR_USER ALL=(ALL) NOPASSWD: /usr/bin/tcpdump
YOUR_USER ALL=(ALL) NOPASSWD: /usr/bin/nethogs
YOUR_USER ALL=(ALL) NOPASSWD: /usr/bin/pkill
YOUR_USER ALL=(ALL) NOPASSWD: /usr/bin/ufw
```

---

## License

[MIT](./LICENSE)

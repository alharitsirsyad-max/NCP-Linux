<div align="center">
  <img src="src/assets/ncp.png" alt="Network Control Panel" width="96" />
  <h1>Network Control Panel</h1>
  <p>Linux desktop app for network configuration, monitoring, and diagnostics.</p>
  <p>Built with <strong>Tauri v2</strong> + <strong>React</strong> + <strong>TypeScript</strong> · Inspired by Windows Network Connections</p>

  <p>
    <img src="https://img.shields.io/badge/platform-Linux-blue?style=flat-square" alt="Platform: Linux" />
    <img src="https://img.shields.io/badge/built_with-Tauri_v2-orange?style=flat-square" alt="Tauri v2" />
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License" />
    <img src="https://img.shields.io/badge/version-0.1.0-blue?style=flat-square" alt="Version 0.1.0" />
  </p>
</div>

---

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/alharitsirsyad-max/NCP-Linux/main/scripts/install.sh | bash
```

Otomatis install semua dependencies + aplikasi + membuat shortcut di app launcher.

---

## Features

| Feature | Description |
|---|---|
| **Adapter Management** | View all interfaces with real-time status, IP, gateway, MAC, MTU, driver. Enable/disable via NetworkManager |
| **IPv4/IPv6/DNS Edit** | Edit IP configuration, DNS servers, and IPv6 settings directly via `nmcli` |
| **Renew DHCP** | Reapply DHCP lease with one click |
| **Dashboard** | System info, network summary, internet status, real-time bandwidth graph |
| **Ping** | Streaming real-time output with per-line color coding and RTT summary |
| **Traceroute** | Hop-by-hop traceroute with streaming output |
| **MTR** | Combined ping + traceroute, realtime table with loss%, latency per hop |
| **DNS Lookup** | Query A, AAAA, MX, CNAME, TXT, NS, PTR records via `dig` |
| **Whois** | Domain/IP whois lookup with syntax highlighting |
| **IP/CIDR Calculator** | Network address, broadcast, host range, subnet mask — pure frontend |
| **Routing Table** | View and filter `ip route` output by interface |
| **ARP Table** | ARP cache with color-coded state + MAC vendor lookup |
| **Open Ports** | `ss -tulnp` output with TCP/UDP and listening-only filters |
| **SSH Quick Connect** | Saved hosts, recent connections, quick connect — opens in terminal emulator |
| **Speed Test** | Internet speed test via `speedtest-cli` — ping, download, upload dengan gauge realtime |
| **Bandwidth Graph** | 60-second realtime canvas chart per interface |
| **Context Menu** | Right-click adapter: Copy IP/MAC/DNS, Ping, Traceroute, Enable/Disable, Open Terminal |
| **Status Bar** | Realtime download/upload speed, uptime, internet status |
| **Notifications** | Toast notifications when adapters connect/disconnect |
| **Export Report** | Export Ping/Traceroute/MTR results to `.txt` in ~/Downloads |
| **Settings** | Terminal emulator, refresh interval, WinBox path, Packet Tracer path |
| **Keyboard Shortcuts** | `Ctrl+D` Diagnostics · `Ctrl+R`/`F5` Refresh · `Ctrl+,` Settings |
| **Menu Bar** | File / View / Tools / Help with functional dropdown menus |

---

## Screenshots

> See [FEATURES.md](./FEATURES.md) for detailed feature documentation.

---

## Installation

### One-line install (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/alharitsirsyad-max/NCP-Linux/main/scripts/install.sh | bash
```

Supports: Arch Linux, Ubuntu, Debian, Linux Mint, Fedora, openSUSE.

### Manual — Debian/Ubuntu

```bash
wget https://github.com/alharitsirsyad-max/NCP-Linux/releases/latest/download/network-control-panel_0.1.0_amd64.deb
sudo dpkg -i network-control-panel_0.1.0_amd64.deb
```

### Manual — Arch Linux (AUR)

```bash
yay -S network-control-panel
# or
paru -S network-control-panel
```

---

## Runtime Dependencies

The app uses standard Linux CLI tools — install them if not present:

| Tool | Package (Arch) | Package (Ubuntu) | Purpose |
|---|---|---|---|
| `nmcli` | `networkmanager` | `network-manager` | Enable/disable adapters |
| `ip` | `iproute2` | `iproute2` | Adapter list, routing, ARP |
| `ping` | `iputils` | `iputils-ping` | Ping diagnostics |
| `dig` | `bind` | `dnsutils` | DNS lookup |
| `traceroute` | `traceroute` | `traceroute` | Traceroute |
| `mtr` | `mtr` | `mtr-tiny` | MTR diagnostics |
| `whois` | `whois` | `whois` | Whois lookup |
| `ss` | `iproute2` | `iproute2` | Open ports |
| `speedtest-cli` | `speedtest-cli` | `speedtest-cli` | Speed test |

---

## Build from Source

### Prerequisites

**Arch Linux:**
```bash
sudo pacman -S rust nodejs pnpm webkit2gtk base-devel \
  networkmanager iproute2 iputils bind traceroute mtr whois
```

**Ubuntu/Debian:**
```bash
sudo apt install rustup nodejs build-essential libwebkit2gtk-4.1-dev \
  libssl-dev libgtk-3-dev network-manager iproute2 dnsutils traceroute mtr-tiny whois
curl -fsSL https://get.pnpm.io/install.sh | sh
```

### Build

```bash
git clone https://github.com/alharitsirsyad-max/NCP-Linux.git
cd network-control-panel
pnpm install
pnpm tauri dev          # development
pnpm tauri build        # production build
```

Build output:
```
src-tauri/target/release/bundle/deb/network-control-panel_0.1.0_amd64.deb
src-tauri/target/release/bundle/rpm/network-control-panel-0.1.0-1.x86_64.rpm
src-tauri/target/release/network-control-panel  (binary)
```

---

## Architecture

```
Frontend (React 19 + TypeScript + Tailwind CSS)
  └── Tauri v2 IPC bridge (invoke / events)
        └── Rust backend
              ├── nmcli  → enable/disable adapters, renew DHCP
              ├── ip     → adapter list, routing table, ARP
              ├── ping   → streaming ping
              ├── traceroute / mtr → diagnostics
              ├── dig / whois → DNS & domain lookup
              ├── ss     → open ports
              └── /proc/net/dev, /proc/uptime → system stats
```

---

## License

[MIT](./LICENSE)

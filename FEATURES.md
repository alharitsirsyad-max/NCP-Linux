# Network Control Panel — Feature Documentation

Dokumentasi lengkap semua fitur dan fungsi aplikasi Network Control Panel (NCP).

---

## Daftar Isi

1. [Adapter Management](#1-adapter-management)
2. [IPv4 Configuration](#2-ipv4-configuration)
3. [IPv6 Configuration](#3-ipv6-configuration)
4. [DNS Configuration](#4-dns-configuration)
5. [Adapter Statistics](#5-adapter-statistics)
6. [Dashboard](#6-dashboard)
7. [Diagnostics — Ping](#7-diagnostics--ping)
8. [Diagnostics — Traceroute](#8-diagnostics--traceroute)
9. [Diagnostics — MTR](#9-diagnostics--mtr)
10. [Diagnostics — DNS Lookup](#10-diagnostics--dns-lookup)
11. [Diagnostics — Whois](#11-diagnostics--whois)
12. [Diagnostics — IP/CIDR Calculator](#12-diagnostics--ipcidr-calculator)
13. [Routing Table](#13-routing-table)
14. [ARP Table](#14-arp-table)
15. [Open Ports](#15-open-ports)
16. [SSH Quick Connect](#16-ssh-quick-connect)
17. [Context Menu](#17-context-menu)
18. [Status Bar](#18-status-bar)
19. [Menu Bar](#19-menu-bar)
20. [Toolbar](#20-toolbar)
21. [Notifications](#21-notifications)
22. [Export Report](#22-export-report)
23. [Settings](#23-settings)
24. [Keyboard Shortcuts](#24-keyboard-shortcuts)
25. [Properties Popup](#25-properties-popup)

---

## 1. Adapter Management

**Lokasi:** Sidebar → klik nama adapter → tab General

Menampilkan semua network interface yang terdeteksi di sistem Linux secara realtime.

### Data yang ditampilkan
- Nama interface (e.g. `enp5s0`, `wlan0`)
- Display name (Ethernet, Wi-Fi, Virtual, VPN, dll.)
- Status: Connected / Disconnected / Unknown
- IPv4 address + prefix length
- Default gateway
- Subnet mask
- DNS servers
- MAC address (dengan tombol Copy)
- MTU
- Driver
- Mode DHCP atau Static
- Connected since (waktu koneksi)
- Bytes received / sent

### Aksi yang tersedia
- **Enable** — mengaktifkan adapter via `nmcli device connect`
- **Disable** — menonaktifkan adapter via `nmcli device disconnect` (dengan konfirmasi)
- **Renew DHCP** — memperbarui lease DHCP via `nmcli device reapply`

### Logika tombol Enable/Disable
- Adapter sedang **connected** → tombol Enable abu-abu (tidak bisa diklik), Disable aktif
- Adapter sedang **disconnected** → tombol Enable aktif, Disable abu-abu
- Adapter **loopback** → kedua tombol disabled
- **Tidak ada adapter dipilih** → kedua tombol disabled

---

## 2. IPv4 Configuration

**Lokasi:** Sidebar → klik adapter → tab IPv4

### Mode tampil (read-only)
- IPv4 address dengan prefix
- Subnet mask
- Default gateway
- DNS servers (Preferred / Alternate)
- Badge: "Automatic (DHCP)" atau "Static / Manual"

### Mode edit
Klik tombol **Edit** (tersedia jika adapter dikelola NetworkManager).

**Toggle DHCP / Static:**
- **DHCP** — address, gateway, DNS diperoleh otomatis dari server
- **Static** — isi manual: IP Address, Prefix Length, Gateway, DNS Preferred, DNS Alternate

**Command yang dijalankan:**
```bash
# Static
nmcli connection modify "Conn Name" ipv4.method manual \
  ipv4.addresses "192.168.1.100/24" \
  ipv4.gateway "192.168.1.1" \
  ipv4.dns "8.8.8.8,8.8.4.4"

# DHCP
nmcli connection modify "Conn Name" ipv4.method auto \
  ipv4.addresses "" ipv4.gateway "" ipv4.dns ""

nmcli connection up "Conn Name"
```

> Tombol Edit **abu-abu/disabled** jika interface tidak dikelola NetworkManager.

---

## 3. IPv6 Configuration

**Lokasi:** Sidebar → klik adapter → tab IPv6

### Mode tampil
- IPv6 address (Global atau Link-local)
- Scope
- Method: Auto / Static / Disabled
- NM DNS (jika ada)

### Mode edit
Toggle tiga mode:
- **Auto** — SLAAC / DHCPv6 otomatis
- **Static** — isi manual: IPv6 Address, Prefix Length, Gateway, DNS
- **Disabled** — IPv6 dinonaktifkan pada koneksi ini

**Command yang dijalankan:**
```bash
nmcli connection modify "Conn Name" ipv6.method auto/manual/disabled \
  ipv6.addresses "2001:db8::1/64" \
  ipv6.gateway "fe80::1" \
  ipv6.dns "2606:4700:4700::1111"
nmcli connection up "Conn Name"
```

---

## 4. DNS Configuration

**Lokasi:** Sidebar → klik adapter → tab DNS

### Tampilan
- Daftar DNS server aktif dengan label: Preferred (index 0) dan Alternate (1, 2, dst.)
- Tombol Copy per server
- Section "Search Domains" (placeholder)
- Tombol **Open DNS Lookup** → langsung buka tab DNS Lookup di Diagnostics

### Mode edit
- Edit tiap DNS server
- Tombol **+ Add another DNS server** (maksimal 4)
- Simpan via `nmcli connection modify ... ipv4.dns "..." && nmcli connection up ...`

---

## 5. Adapter Statistics

**Lokasi:** Sidebar → klik adapter → tab Statistics

### Data yang ditampilkan
- **Bytes Received** — dengan format human-readable (KB/MB/GB) dan nilai bytes asli
- **Bytes Sent** — sama
- MTU
- Link Speed (Mbps jika tersedia)
- Duplex (Unknown jika tidak tersedia)
- Driver
- Connected Since

---

## 6. Dashboard

**Lokasi:** Klik "Dashboard" di toolbar atau menu View

### System Info Card
- Hostname
- Username
- Distro (dari `/etc/os-release` → `PRETTY_NAME`)
- Kernel version (`uname -r`)
- Uptime (format: Xh Xm Xs)

### Network Summary Card
- Jumlah interface aktif / total
- Nama interface utama (primary)
- IP lokal
- Default gateway
- DNS servers

### Internet Status Card
- Status internet: **Online** (hijau) / **Offline** (merah) / Checking...
- Latency ke 1.1.1.1 (dicheck setiap 30 detik)
- Status NetworkManager: active / inactive

### Traffic Card (Bandwidth Graph)
- Grafik realtime 60 detik terakhir
- Hijau = download, Biru = upload
- Nilai current speed: format KB/s atau MB/s
- Polling setiap 1 detik dari `/proc/net/dev`

### Active Adapters Section
- Daftar semua adapter yang sedang connected
- Nama, IP/prefix, gateway per adapter

---

## 7. Diagnostics — Ping

**Lokasi:** Diagnostics → tab Ping

### Input
- Target host atau IP
- Count (dropdown: 4, 8, 16, 32 packets)
- Enter untuk mulai

### Output
- Streaming realtime baris per baris
- **Hijau** = sukses (`bytes from ... ttl=... time=...ms`)
- **Merah** = timeout (`Request timeout`)
- Auto-scroll ke baris terbaru

### Summary bar (setelah selesai)
- Sent, Received, Loss%, Min, Avg, Max (RTT dalam ms)

### Kontrol
- Tombol **Run Ping** → mulai
- Tombol **Stop** (muncul saat berjalan) → hentikan proses
- Tombol **Export** → simpan output ke `~/Downloads/ping-TARGET-TIMESTAMP.txt`

**Command:** `ping -c {count} {target}`

---

## 8. Diagnostics — Traceroute

**Lokasi:** Diagnostics → tab Traceroute

### Output
- Tabel hop realtime: No., IP Address, Probe 1, Probe 2, Probe 3
- Timeout ditampilkan sebagai `*` (muted)
- Status "Trace complete — N hops" setelah selesai

### Kontrol
- **Trace** / **Stop**
- **Export** → `~/Downloads/traceroute-TARGET-TIMESTAMP.txt`

**Command:** `traceroute -n {target}`

---

## 9. Diagnostics — MTR

**Lokasi:** Diagnostics → tab MTR

MTR (My Traceroute) = kombinasi ping + traceroute yang berjalan terus-menerus.

### Input
- Target host atau IP
- Cycles: Continuous, 10, 20, 50

### Tabel (update realtime per cycle)
| Kolom | Deskripsi |
|---|---|
| # | Nomor hop |
| Host | IP address hop |
| Loss% | Persentase packet loss |
| Snt | Total packets sent |
| Last | Latency packet terakhir (ms) |
| Avg | Rata-rata latency |
| Best | Latency terbaik |
| Worst | Latency terburuk |

### Warna latency
- Hijau: < 20ms (excellent)
- Normal: 20–100ms (good)
- Kuning: 100–300ms (fair)
- Merah: > 300ms (poor)

### Warna loss
- Hijau: 0%
- Kuning: ≤ 10%
- Merah: > 10%

### Kontrol
- **Start MTR** / **Stop**
- **Export** (setelah selesai) → `~/Downloads/mtr-TARGET-TIMESTAMP.txt`

**Command:** `mtr --raw -n -c {cycles} {target}`

> Install MTR: `sudo pacman -S mtr` (Arch) atau `sudo apt install mtr-tiny` (Ubuntu)

---

## 10. Diagnostics — DNS Lookup

**Lokasi:** Diagnostics → tab DNS Lookup (atau dari sidebar DNS tab adapter → tombol "Open DNS Lookup")

### Input
- Hostname (e.g. `google.com`)
- Record type dropdown: **A, AAAA, MX, CNAME, TXT, NS, PTR**

### Output
- Daftar records dengan nomor baris
- Tombol Copy per record
- Tombol Copy semua hasil sekaligus
- Pesan "No records found" jika kosong

**Command:** `dig +short -t {TYPE} {hostname}`

> Install dig: `sudo pacman -S bind` (Arch) atau `sudo apt install dnsutils` (Ubuntu)

---

## 11. Diagnostics — Whois

**Lokasi:** Diagnostics → tab Whois

### Input
- Domain name atau IP address

### Output
- Raw whois output dengan syntax highlighting:
  - Kunci (field name) berwarna biru
  - Komentar (%) berwarna muted
  - Nilai normal
- Tombol Copy semua hasil

**Command:** `whois {target}`

> Install whois: `sudo pacman -S whois` (Arch) atau `sudo apt install whois` (Ubuntu)

---

## 12. Diagnostics — IP/CIDR Calculator

**Lokasi:** Diagnostics → tab IP Calculator

### Input
- Notasi CIDR: `192.168.1.0/24`
- Atau IP + subnet mask: `192.168.1.0 255.255.255.0`

### Output
| Field | Contoh |
|---|---|
| Network Address | 192.168.1.0 |
| Broadcast Address | 192.168.1.255 |
| First Host | 192.168.1.1 |
| Last Host | 192.168.1.254 |
| Subnet Mask | 255.255.255.0 |
| Total Hosts | 254 |

- Tombol Copy per baris
- Validasi input — pesan error jika CIDR tidak valid
- **Pure frontend** — tidak membutuhkan koneksi atau backend

---

## 13. Routing Table

**Lokasi:** Sidebar → Routing Table

### Kolom
| Kolom | Deskripsi |
|---|---|
| Destination | Network tujuan |
| Gateway | Router berikutnya |
| Interface | Interface yang digunakan |
| Metric | Metric/cost rute |
| Protocol | Sumber rute (kernel/static/dhcp) |

### Filter
- Dropdown filter by interface
- Tampilkan semua atau filter per interface

### Kontrol
- Tombol **Refresh**
- Jumlah total routes

**Command:** `ip -j route show`

---

## 14. ARP Table

**Lokasi:** Sidebar → ARP Table

### Kolom
| Kolom | Deskripsi |
|---|---|
| IP Address | IP address tetangga |
| MAC Address | Hardware address |
| Vendor | Nama vendor dari OUI (jika wireshark terinstall) |
| Interface | Interface yang digunakan |
| State | Status ARP entry |

### Warna state
- **Hijau**: REACHABLE
- **Kuning**: STALE, DELAY
- **Merah**: FAILED, INCOMPLETE

### MAC Vendor Lookup
Otomatis lookup vendor dari prefix MAC menggunakan database `/usr/share/wireshark/manuf`.

### Kontrol
- Tombol **Refresh**

**Command:** `ip -j neigh show`

---

## 15. Open Ports

**Lokasi:** Sidebar → Open Ports

### Kolom
| Kolom | Deskripsi |
|---|---|
| Protocol | TCP / UDP (dengan badge berwarna) |
| Address | Local address |
| Port | Port number (bold) |
| State | LISTEN / UNCONN / dll. |
| PID | Process ID |
| Process | Nama proses |

### Filter
- Toggle **ALL / TCP / UDP** — filter by protocol
- Toggle **Listening Only** — tampilkan hanya port dengan state LISTEN

### Kontrol
- Tombol **Refresh**
- Jumlah port aktif setelah filter

**Command:** `ss -tulnp`

---

## 16. SSH Quick Connect

**Lokasi:** Sidebar → SSH Connect

### Quick Connect
Form cepat: `user @ host : port` → tombol **Connect**

### Saved Hosts
- Simpan koneksi dengan display name
- Data: Nama, Username, Host/IP, Port
- Tombol **Add Host** → dialog form
- Tombol **SSH** per host → buka di terminal emulator
- Tombol hapus (trash icon)
- Data disimpan di localStorage (persisten)

### Recent Connections
- 8 koneksi terakhir otomatis tersimpan
- Relative time (5s ago, 2m ago, 1h ago)
- Tombol **SSH** → reconnect
- Tombol **Clear** untuk hapus semua history

### Terminal Emulator
Script otomatis mendeteksi terminal yang tersedia (urut prioritas):
`kitty` → `alacritty` → `gnome-terminal` → `xterm` → `konsole`

**Command yang dibuka:** `ssh -p {port} {user}@{host}`

---

## 17. Context Menu

**Cara akses:** Klik kanan pada nama adapter di sidebar

### Menu items

**Copy section:**
- Copy IPv4 → salin ke clipboard
- Copy IPv6 → salin ke clipboard
- Copy Gateway → salin ke clipboard
- Copy DNS → salin ke clipboard (semua DNS, dipisah koma)
- Copy MAC → salin ke clipboard

**Adapter actions:**
- Enable / Disable (toggle sesuai state saat ini)
- Renew DHCP

**Diagnostics:**
- **Ping Gateway** → buka Diagnostics tab Ping dengan target = gateway adapter
- **Ping 8.8.8.8** → buka Diagnostics tab Ping dengan target = 8.8.8.8
- **Traceroute 8.8.8.8** → buka Diagnostics tab Traceroute

**System:**
- **Open Terminal** → buka terminal emulator baru di background

---

## 18. Status Bar

Terletak di bagian bawah aplikasi, selalu terlihat.

### 4 Segmen
1. **↓ Download speed** — realtime dari `/proc/net/dev`, delta per detik
2. **↑ Upload speed** — realtime
3. **Uptime** — dari `/proc/uptime`, format Xh XXm XXs
4. **Internet status** — ping ke 1.1.1.1 setiap 30 detik
   - **Internet: Online** (hijau) — koneksi tersedia
   - **Internet: Offline** (merah) — tidak ada koneksi

### Format kecepatan
- `X.X KB/s` jika < 1 MB/s
- `X.XX MB/s` jika ≥ 1 MB/s

---

## 19. Menu Bar

Terletak di bawah titlebar. Setiap item membuka dropdown.

### File
- **Exit** — tutup aplikasi

### View
- **Refresh** — refresh data halaman aktif
- **Dashboard** — buka halaman Dashboard
- **Adapters** — buka halaman Adapters

### Tools
- **Diagnostics** — buka Diagnostics (tab Ping)
- **DNS Lookup** — buka Diagnostics tab DNS
- **IP Calculator** — buka Diagnostics tab Calculator
- **Routing Table** — buka halaman Routing
- **ARP Table** — buka halaman ARP
- **Open Ports** — buka halaman Ports
- **Open Terminal** — buka terminal emulator
- **SSH Quick Connect** — buka halaman SSH
- **Open Wireshark** — launch Wireshark (jika terinstall)

### Help
- **Settings** — buka halaman Settings
- **About** — tampilkan info versi via toast

---

## 20. Toolbar

Terletak di bawah MenuBar. Tombol state-aware.

| Tombol | Fungsi | Kondisi aktif |
|---|---|---|
| Properties | Buka Properties popup | Ada adapter dipilih |
| Enable | Aktifkan adapter | Adapter disconnected & bukan loopback |
| Disable | Nonaktifkan adapter | Adapter connected & bukan loopback |
| Renew DHCP | Perbarui lease DHCP | Adapter connected |
| Terminal | Buka terminal emulator | Selalu aktif |
| Diagnostics | Buka halaman Diagnostics | Selalu aktif |
| Dashboard | Buka halaman Dashboard | Selalu aktif |

---

## 21. Notifications

Sistem toast notification non-blocking di pojok kanan bawah.

### Jenis notifikasi
- 🟢 **Success** — operasi berhasil (enable/disable/apply config)
- 🟡 **Warning** — peringatan (adapter disconnected notification)
- 🔴 **Error** — operasi gagal dengan pesan detail
- 🔵 **Info** — informasi umum (About, versi)

### Perilaku
- Muncul otomatis saat adapter connect/disconnect (polling setiap 5 detik)
- Auto-dismiss setelah 4 detik
- Tombol × untuk menutup manual
- Multiple toast ditampilkan vertikal

---

## 22. Export Report

Tersedia di panel Ping, Traceroute, dan MTR.

### Format output
File teks plain (`.txt`) dengan:
- Header: nama fitur, target, timestamp
- Separator garis
- Isi output (per baris untuk Ping/Traceroute, tabel untuk MTR)
- Summary (untuk Ping)

### Lokasi simpan
- `~/Downloads/` (jika ada)
- `~/Documents/` (fallback)

### Penamaan file
- `ping-{target}-{YYYY-MM-DD_HH-MM-SS}.txt`
- `traceroute-{target}-{YYYY-MM-DD_HH-MM-SS}.txt`
- `mtr-{target}-{YYYY-MM-DD_HH-MM-SS}.txt`

---

## 23. Settings

**Lokasi:** Sidebar → Settings (atau `Ctrl+,`)

### External Tools
| Setting | Deskripsi |
|---|---|
| WinBox Binary Path | Path ke WinBox executable + tombol Launch |
| Cisco Packet Tracer Path | Path ke CPT executable + tombol Launch |
| Terminal Emulator | Pilih: Auto-detect, Kitty, Alacritty, GNOME Terminal, XTerm |

### Behaviour
| Setting | Deskripsi |
|---|---|
| Adapter Refresh Interval | 1–60 detik (default: 5 detik) |

### Keyboard Shortcuts Reference
Ditampilkan sebagai tabel referensi di halaman Settings.

### Penyimpanan
- Settings disimpan di `localStorage` browser WebView
- Dimuat otomatis saat aplikasi dibuka
- Tombol **Save Settings** + **Reset Defaults**

---

## 24. Keyboard Shortcuts

| Shortcut | Aksi |
|---|---|
| `Ctrl+D` | Buka Diagnostics (tab Ping) |
| `Ctrl+R` | Refresh halaman aktif |
| `F5` | Refresh halaman aktif |
| `Ctrl+,` | Buka Settings |

### Halaman yang di-refresh (`Ctrl+R` / `F5`)
- Adapters → invalidate adapter list query
- Routing Table → invalidate routing query
- ARP Table → invalidate ARP query
- Open Ports → invalidate ports query
- Dashboard → invalidate system info query

> Shortcut tidak aktif saat fokus ada di input/textarea/select

---

## 25. Properties Popup

**Cara akses:** 
- Tombol **Properties** di toolbar
- Tombol **Properties** di AdapterHeader (detail pane)

### Data yang ditampilkan

**General:**
- Interface name
- Display name
- Type (ethernet/wifi/vpn/virtual)
- State

**Addressing:**
- IPv4 Address + prefix (dengan Copy)
- Subnet Mask
- Default Gateway (dengan Copy)
- IPv6 Address (dengan Copy)

**DNS:**
- Preferred DNS (dengan Copy)
- Alternate DNS 1, 2, ... (dengan Copy)

**Hardware:**
- MAC Address (dengan Copy)
- MTU
- Speed
- Driver

**Traffic:**
- Bytes Received (human-readable)
- Bytes Sent (human-readable)

### Kontrol
- Klik backdrop atau tombol **Close** / **×** untuk menutup

---

## Backend Commands (Rust)

Semua command terdaftar dan dipanggil via Tauri IPC `invoke()`:

| Command | Fungsi |
|---|---|
| `list_adapters` | Adapter list dari `ip -j addr show` + gateway + DNS + traffic |
| `enable_adapter` | `nmcli device connect {iface}` |
| `disable_adapter` | `nmcli device disconnect {iface}` |
| `renew_dhcp` | `nmcli device reapply {iface}` |
| `get_ipv4_config` | Query NM config via `nmcli -t -f ipv4.*` |
| `apply_ipv4_config` | `nmcli connection modify ... && nmcli connection up` |
| `get_ipv6_config` | Query NM config via `nmcli -t -f ipv6.*` |
| `apply_ipv6_config` | `nmcli connection modify ... ipv6.* && nmcli connection up` |
| `apply_dns_config` | `nmcli connection modify ... ipv4.dns ...` |
| `run_ping` | Streaming `ping -c N target` via events |
| `run_traceroute` | Streaming `traceroute -n target` via events |
| `run_mtr` | Streaming `mtr --raw -n -c N target` via events |
| `run_dns_lookup` | `dig +short -t TYPE hostname` |
| `run_whois` | `whois target` |
| `get_system_info` | hostname + distro + kernel + uptime + NM status |
| `get_routing_table` | `ip -j route show` |
| `get_arp_table` | `ip -j neigh show` |
| `get_open_ports` | `ss -tulnp` dengan custom parser |
| `get_traffic_snapshot` | `/proc/net/dev` parser |
| `check_internet` | `ping -c 1 -W 3 1.1.1.1` |
| `get_uptime` | `/proc/uptime` |
| `open_terminal` | Detect + launch terminal emulator |
| `launch_wireshark` | `wireshark &` atau `wireshark -i IFACE &` |
| `ssh_connect` | Buka terminal dengan `ssh -p PORT USER@HOST` |
| `lookup_mac_vendor` | Baca dari `/usr/share/wireshark/manuf` |
| `save_report` | Tulis file ke `~/Downloads/` atau `~/Documents/` |
| `launch_winbox` | Jalankan WinBox binary dari path yang dikonfigurasi |
| `launch_packet_tracer` | Jalankan Cisco PT binary dari path yang dikonfigurasi |
| `open_nm_connection_editor` | `nm-connection-editor` untuk edit koneksi advanced |
| `run_nmcli_command` | Generic nmcli wrapper (connection/device/radio/networking) |

---

*Network Control Panel v0.1.0 — Built with Tauri v2, React 19, TypeScript, Rust*

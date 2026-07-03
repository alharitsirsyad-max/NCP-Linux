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
26. [Speed Test](#26-speed-test)
27. [LAN Scanner](#27-lan-scanner)
28. [DNS Benchmark](#28-dns-benchmark)
29. [Wake-on-LAN](#29-wake-on-lan)
30. [Wi-Fi Analyzer](#30-wi-fi-analyzer)
31. [Traffic Monitor](#31-traffic-monitor)
32. [VLAN Info](#32-vlan-info)
33. [Packet Capture](#33-packet-capture)
34. [Firewall Manager](#34-firewall-manager)
35. [Bandwidth Monitor per Process](#35-bandwidth-monitor-per-process)
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

## 16. Speed Test

**Lokasi:** Sidebar → Speed Test

Mengukur kecepatan internet menggunakan `speedtest-cli`.

### Tampilan
- Tiga gauge: **Ping** (ms), **Download** (Mbps), **Upload** (Mbps)
- Progress bar dengan warna per stage: oranye=ping, biru=download, hijau=upload
- Info server dan ISP muncul setelah test selesai
- "Last result" bar di bawah menampilkan hasil terakhir dengan timestamp

### Kontrol
- **START TEST** → mulai test, tombol berubah jadi **STOP** (merah)
- **STOP** → hentikan proses, kembali ke idle

### Animasi
- Angka pada gauge naik secara counter animation saat hasil tiba
- Border gauge pulse saat stage sedang aktif
- Progress bar smooth CSS transition

### Fallback
- Jika `speedtest-cli` tidak terinstall → tampilkan instruksi install per distro

**Command:** `speedtest-cli --json --secure`

> Install: `sudo pacman -S speedtest-cli` (Arch) atau `sudo apt install speedtest-cli` (Ubuntu)

---

## 17. SSH Quick Connect**Lokasi:** Sidebar → SSH Connect

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
| `check_speedtest_available` | Cek apakah `speedtest-cli` tersedia di sistem |
| `run_speedtest` | Jalankan speed test via `speedtest-cli --json`, streaming progress events |
| `run_nmcli_command` | Generic nmcli wrapper (connection/device/radio/networking) |
| `check_nmap_available` | Cek apakah `nmap` tersedia |
| `get_local_networks` | Deteksi subnet lokal dari `ip -j addr show` |
| `run_lan_scan` | Scan jaringan via `nmap -sn --oX` + emit events per device |
| `cancel_lan_scan` | Batalkan scan yang sedang berjalan |
| `get_default_dns_servers` | Return daftar DNS server publik + ISP DNS dari `/etc/resolv.conf` |
| `run_dns_benchmark` | Benchmark latency tiap DNS server via `dig`, emit progress per server |
| `get_isp_dns` | Baca nameserver dari `/etc/resolv.conf` |
| `send_wol` | Kirim magic packet via UDP broadcast (pure Rust) |
| `save_wol_targets` | Simpan daftar WoL device ke `~/.local/share/network.control.panel/wol_targets.json` |
| `load_wol_targets` | Load daftar WoL device dari disk |
| `validate_mac` | Validasi format MAC address |
| `scan_wifi_networks` | Scan Wi-Fi via `nmcli device wifi list`, parse output |
| `check_wifi_available` | Cek apakah ada adapter Wi-Fi |
| `list_traffic_interfaces` | List interface dari `/proc/net/dev` |
| `start_traffic_monitor` | Mulai polling `/proc/net/dev` tiap detik, emit `traffic_update` events |
| `get_traffic_history` | Return history buffer traffic per interface |
| `stop_traffic_monitor` | Hentikan monitoring traffic |
| `get_vlan_info` | List VLAN interface via `ip -j link show type vlan` |
| `check_tcpdump_available` | Cek apakah `tcpdump` tersedia |
| `check_wireshark_available` | Cek apakah `wireshark` tersedia |
| `start_capture` | Mulai capture via `sudo tcpdump`, emit `capture_progress` tiap detik |
| `stop_capture` | Hentikan tcpdump, return path file output |
| `open_in_wireshark` | Buka file `.pcap` di Wireshark |
| `expand_capture_path` | Expand `~/` ke path absolut |
| `detect_firewall` | Deteksi backend firewall: ufw / nftables / iptables / none |
| `get_ufw_status` | Ambil status UFW (active, default policies, logging) |
| `get_ufw_rules` | Ambil daftar rules UFW dengan nomor |
| `ufw_allow` | Tambah rule ALLOW (e.g. `80/tcp`) |
| `ufw_deny` | Tambah rule DENY |
| `ufw_delete_rule` | Hapus rule by nomor |
| `ufw_enable` | Aktifkan UFW |
| `ufw_disable` | Nonaktifkan UFW |
| `ufw_reset` | Reset semua rules UFW |
| `check_nethogs_available` | Cek apakah `nethogs` tersedia |
| `start_bandwidth_monitor` | Mulai `sudo nethogs -t`, parse output, emit `bandwidth_update` |
| `stop_bandwidth_monitor` | Hentikan nethogs |

---

## 26. Speed Test

**Lokasi:** Sidebar → Speed Test

Mengukur kecepatan internet menggunakan `speedtest-cli`.

### Tampilan
- Tiga gauge: **Ping** (ms), **Download** (Mbps), **Upload** (Mbps)
- Progress bar dengan warna per stage: oranye=ping, biru=download, hijau=upload
- Info server dan ISP muncul setelah test selesai
- "Last result" bar menampilkan hasil terakhir dengan timestamp

### Kontrol
- **START TEST** → mulai test, berubah jadi **STOP** (merah) saat berjalan
- **STOP** → hentikan, kembali ke idle

**Command:** `speedtest-cli --json --secure`

> Install: `sudo pacman -S speedtest-cli` atau `sudo apt install speedtest-cli`

---

## 27. LAN Scanner

**Lokasi:** Sidebar → LAN Scanner

Scan semua perangkat aktif di jaringan lokal menggunakan `nmap`.

### Tampilan
- Dropdown network: otomatis terisi dari `get_local_networks()`
- Disclaimer banner kuning permanen (pengingat legal)
- Tabel realtime — row ditambah satu per satu saat device ditemukan
- Kolom: IP Address, MAC Address, Vendor, Hostname, Latency

### Context Menu per Row
- Copy IP / Copy MAC
- Ping device → buka Diagnostics pre-fill
- Traceroute → buka Diagnostics tab Traceroute
- SSH to device → buka SSH Quick Connect
- Add to Wake-on-LAN → buka WoL page pre-fill MAC

### Kontrol
- Tombol **Start Scan** / **Stop**
- Tombol **Export** → simpan ke TXT di `~/Downloads`
- Info jika MAC tidak tersedia (butuh sudo untuk `nmap -sn`)

**Command:** `sudo nmap -sn --oX - {network}` (fallback tanpa sudo)

> Install: `sudo pacman -S nmap` atau `sudo apt install nmap`

---

## 28. DNS Benchmark

**Lokasi:** Sidebar → DNS Benchmark

Bandingkan latency berbagai DNS server menggunakan `dig`.

### Server yang ditest (default)
- Cloudflare (1.1.1.1), Cloudflare Alt (1.0.0.1)
- Google (8.8.8.8), Google Alt (8.8.4.4)
- Quad9 (9.9.9.9)
- OpenDNS (208.67.222.222)
- AdGuard (94.140.14.14)
- ISP DNS (otomatis dari `/etc/resolv.conf`)
- Custom server: bisa ditambah manual

### Tampilan
- Progress row: server sedang ditest + query counter `X/N`
- Tabel hasil realtime (muncul row per row):
  - Rank: 🥇🥈🥉 untuk 3 terbaik
  - Bar chart proporsional, warna HSL green→yellow→red
  - Success rate per server
- Klik row → expand detail: tiap query latency individual, min/max/avg
- Banner rekomendasi di bawah setelah selesai

### Konfigurasi
- Test domain (default: `google.com`)
- Query count per server: 3, 5, 10
- Tambah/hapus custom DNS server

**Command:** `dig @{server_ip} {domain} +time=3 +tries=1 +noall +stats`

---

## 29. Wake-on-LAN

**Lokasi:** Sidebar → Wake-on-LAN

Kirim magic packet untuk menyalakan perangkat lain di jaringan.

### Saved Devices
- Daftar device yang disimpan ke disk (`~/.local/share/network.control.panel/wol_targets.json`)
- Tombol **Wake** per device → kirim magic packet + toast konfirmasi
- Tombol Delete
- Tombol **Add Device** → modal form: Name, MAC, Broadcast IP, Port

### Quick Wake
- Input MAC address langsung + kirim tanpa menyimpan
- Validasi format MAC sebelum kirim

### Magic Packet
- Implementasi pure Rust — tidak butuh binary eksternal
- Format: 6×0xFF + MAC×16 = 102 bytes
- Dikirim via UDP ke `{broadcast}:{port}` (default port 9)

### Integrasi LAN Scanner
- Context menu LAN Scanner → "Add to Wake-on-LAN" → buka modal dengan MAC pre-filled

---

## 30. Wi-Fi Analyzer

**Lokasi:** Sidebar → Wi-Fi Analyzer

Tampilkan semua jaringan Wi-Fi di sekitar beserta detail teknisnya.

### Kolom Tabel
| Kolom | Deskripsi |
|---|---|
| SSID | Nama jaringan (✅ = currently connected) |
| Signal | Bar 5 kotak + persentase, warna: hijau/kuning/merah |
| Channel | Nomor channel |
| Band | Badge berwarna: 2.4 GHz (oranye) / 5 GHz (biru) / 6 GHz (ungu) |
| Security | Badge: WPA3 (hijau), WPA2 (biru), WEP (oranye), Open ⚠ (merah) |
| BSSID | MAC address access point |

### Channel Usage Chart
- Bar horizontal per channel
- Merah + label "crowded!" jika ≥2 network di channel yang sama
- Terpisah per band (2.4 GHz / 5 GHz)

### Kontrol
- Tombol **Scan** + auto-scan saat halaman dibuka
- Fallback informatif jika tidak ada adapter Wi-Fi

**Command:** `nmcli -t -f IN-USE,BSSID,SSID,MODE,CHAN,FREQ,SIGNAL,SECURITY device wifi list`

---

## 31. Traffic Monitor

**Lokasi:** Sidebar → Traffic Monitor

Grafik realtime download/upload per interface dengan history.

### Grafik
- SVG native (tanpa library eksternal)
- Download (biru) + Upload (hijau), area fill semi-transparan
- Auto-scale Y-axis dengan format KB/s atau MB/s
- X-axis: timestamp HH:MM:SS
- Toggle durasi: **1m** / **5m** / **1h**

### Stats Cards
- Current Download / Upload speed
- Session RX / TX bytes (sejak monitoring dimulai)
- Total interface bytes sejak boot

### Kontrol
- Dropdown pilih interface
- Indikator "Live" dengan dot animasi
- Auto-mulai saat interface dipilih

**Data source:** `/proc/net/dev`, polling setiap 1 detik

---

## 32. VLAN Info

**Lokasi:** Sidebar → VLAN Info

Tampilkan semua VLAN sub-interface yang terkonfigurasi di sistem.

### Kolom
| Kolom | Deskripsi |
|---|---|
| Interface | Nama VLAN interface (e.g. `eth0.10`) |
| VLAN ID | ID numerik (badge biru) |
| Parent | Interface fisik induk |
| IP Address | Alamat IP jika terkonfigurasi |
| MAC | MAC address |
| Status | Badge UP (hijau) / DOWN (abu) |

### Empty State
Jika tidak ada VLAN: tampilkan penjelasan VLAN + 3 cara membuat (nmcli, ip link, nm-connection-editor) lengkap dengan contoh command.

**Command:** `ip -j link show type vlan` + `ip -j addr show`

---

## 33. Packet Capture

**Lokasi:** Sidebar → Packet Capture

Capture paket jaringan tanpa perlu membuka Wireshark.

### Konfigurasi
- **Interface**: dropdown semua interface
- **BPF Filter**: input teks + quick-pick buttons (HTTP, HTTPS, DNS, TCP, UDP, ICMP, No SSH, host)
- **Output file**: path `.pcap` dengan tombol Browse
- **Stop condition**: Manual / Setelah N packets / Setelah N seconds (dengan countdown)

### Status & Progress
- Packets captured (estimasi dari file size)
- File size realtime
- Elapsed time

### Tombol "Open in Wireshark"
Muncul setelah capture selesai jika Wireshark terinstall.

### BPF Filter Reference
Panel referensi built-in dengan contoh: `port 80`, `host 8.8.8.8`, `tcp`, `not port 22`, dll.

**Command:** `sudo tcpdump -n -i {iface} -w {output.pcap} [{filter}] [-c {count}]`

> Requires: `sudo tcpdump` (passwordless sudo recommended)

---

## 34. Firewall Manager

**Lokasi:** Sidebar → Firewall

GUI untuk melihat dan mengelola rules firewall UFW.

### Status Header
- Badge ACTIVE (hijau) / INACTIVE (merah)
- Default incoming/outgoing policy
- Logging level

### Rules Table
| Kolom | Deskripsi |
|---|---|
| # | Nomor rule |
| To | Port/service tujuan |
| Action | Badge ALLOW (hijau) / DENY (merah) |
| From | Sumber traffic |
| Protocol | TCP / UDP |

### Aksi
- **Add Rule** → modal: pilih port, protocol (TCP/UDP/Any), action (ALLOW/DENY)
- **Delete Rule** → konfirmasi dialog wajib
- **Enable/Disable Firewall** → konfirmasi dialog wajib

> ⚠️ **Semua aksi destruktif** (delete, disable) wajib melalui confirm dialog.

### Fallback
- Jika nftables/iptables terdeteksi → info install UFW
- Jika tidak ada firewall → instruksi install + enable

**Commands:** `sudo ufw status verbose/numbered`, `sudo ufw allow/deny/delete/enable/disable`

---

## 35. Bandwidth Monitor per Process

**Lokasi:** Sidebar → Bandwidth/Process

Tampilkan proses mana yang paling banyak menggunakan bandwidth, realtime.

### Tabel
| Kolom | Deskripsi |
|---|---|
| Process | Nama proses + path |
| PID | Process ID |
| Download ↓ | Receive rate (KB/s atau MB/s) |
| Upload ↑ | Send rate |
| Bar | Bar chart proporsional (biru=download, hijau=upload) |

### Perilaku
- Update realtime setiap nethogs refresh (~1 detik)
- Diurutkan berdasarkan total bandwidth tertinggi
- Hanya proses dengan traffic aktif yang ditampilkan
- Total aggregate ↓/↑ di header toolbar

### Kontrol
- Dropdown pilih interface
- Tombol **Start** / **Stop**

**Command:** `sudo nethogs -t -d 1 {iface}`

> Install: `sudo pacman -S nethogs` atau `sudo apt install nethogs`  
> Requires: passwordless sudo untuk nethogs

---

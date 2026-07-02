# TASKS_ADDITIONAL_FEATURES.md — Fitur Tambahan
# Network Control Panel — Addendum Task v2

> File ini berisi seluruh fitur tambahan yang akan dikerjakan setelah TASKS.md dan TASKS_SPEEDTEST.md selesai.
> Kerjakan Phase demi Phase secara berurutan.
> Setiap Phase selesai, laporkan ke user dan tunggu konfirmasi sebelum lanjut.

---

## Daftar Phase

| Phase | Fitur | Prioritas |
|---|---|---|
| AF-1 | LAN Scanner | 🔴 Tinggi |
| AF-2 | DNS Benchmark | 🔴 Tinggi |
| AF-3 | Wake-on-LAN | 🔴 Tinggi |
| AF-4 | Wi-Fi Analyzer | 🟡 Sedang |
| AF-5 | Interface Traffic Graph | 🟡 Sedang |
| AF-6 | VLAN Info | 🟡 Sedang |
| AF-7 | Packet Capture Sederhana | 🟡 Sedang |
| AF-8 | Firewall Manager | 🟠 Kompleks |
| AF-9 | Bandwidth Monitor per Process | 🟠 Kompleks |

---

## Phase AF-1 — LAN Scanner

> Tujuan: Scan seluruh perangkat aktif di jaringan lokal dan tampilkan dalam tabel lengkap.
> Tool: `nmap`
> Install: `sudo pacman -S nmap`
> Disclaimer: fitur ini hanya untuk digunakan di jaringan milik sendiri.

### Task AF-1.1 — Cek Dependency nmap

Buat `src-tauri/src/commands/lan_scanner.rs`.

```rust
#[tauri::command]
pub async fn check_nmap_available() -> bool {
    // jalankan: which nmap
    // return true jika ada
}
```

- [ ] Command `check_nmap_available` dibuat dan di-register

---

### Task AF-1.2 — Deteksi Network Range Otomatis

Sebelum scan, aplikasi harus tahu subnet yang akan di-scan.

```rust
#[tauri::command]
pub async fn get_local_networks() -> Result<Vec<LocalNetwork>, String> {
    // parse output: ip -j addr show
    // filter: hanya interface yang connected, bukan loopback
    // return: list network dengan CIDR notation
    // contoh: ["192.168.1.0/24", "192.168.56.0/24", "172.17.0.0/16"]
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalNetwork {
    pub interface: String,    // "enp5s0"
    pub network: String,      // "192.168.1.0/24"
    pub gateway: Option<String>,
}
```

- [ ] Command `get_local_networks` dibuat
- [ ] Test: return subnet yang benar sesuai adapter aktif

---

### Task AF-1.3 — Command `run_lan_scan` dengan Streaming

```rust
#[derive(Debug, Clone, Serialize)]
pub struct LanDevice {
    pub ip: String,
    pub mac: Option<String>,
    pub vendor: Option<String>,
    pub hostname: Option<String>,
    pub latency_ms: Option<f64>,
    pub status: String,       // "online"
}

#[derive(Debug, Clone, Serialize)]
pub struct LanScanProgress {
    pub devices_found: u32,
    pub percent: u8,
    pub message: String,
}

#[tauri::command]
pub async fn run_lan_scan(
    app: tauri::AppHandle,
    network: String,          // "192.168.1.0/24"
) -> Result<Vec<LanDevice>, String> {
    // 1. jalankan: sudo nmap -sn --oX - {network}
    //    --oX - → output XML ke stdout (mudah di-parse)
    // 2. parse XML output per host yang ditemukan
    // 3. emit event "lan_scan_progress" per device ditemukan
    // 4. emit event "lan_scan_done" saat selesai
    // 5. return Vec<LanDevice>
    //
    // Fallback tanpa sudo: nmap -sn {network} (tanpa MAC address)
    // Coba dengan sudo dulu, jika gagal fallback tanpa sudo
}
```

Parse XML output nmap, field yang diambil:
- `host/address[@addrtype='ipv4']` → IP
- `host/address[@addrtype='mac']` → MAC
- `host/address[@addrtype='mac']/@vendor` → Vendor
- `host/hostnames/hostname/@name` → Hostname
- `host/times/@rtt` → latency (microseconds, konversi ke ms)

- [ ] Command `run_lan_scan` dibuat dengan streaming progress
- [ ] XML parser nmap berfungsi
- [ ] Fallback tanpa sudo berfungsi (tanpa MAC)
- [ ] Test: scan jaringan lokal, device terdeteksi

---

### Task AF-1.4 — Hook `useLanScanner`

Buat `src/hooks/useLanScanner.ts`.

```ts
interface LanScannerState {
  status: 'idle' | 'running' | 'done' | 'error'
  devices: LanDevice[]
  progress: LanScanProgress | null
  networks: LocalNetwork[]
  selectedNetwork: string | null
  error: string | null
}

export function useLanScanner() {
  // load available networks saat mount
  // start(network): invoke run_lan_scan + listen events
  // stop(): batalkan scan
  // reset(): kembali ke idle
}
```

- [ ] Hook `useLanScanner` dibuat
- [ ] Networks di-load otomatis saat komponen mount
- [ ] Event listener di-cleanup saat unmount

---

### Task AF-1.5 — Halaman LAN Scanner

Buat `src/pages/LanScannerPage.tsx`.

Layout:

```
┌─ LAN Scanner ──────────────────────────────────────────────┐
│ ⚠️  Gunakan hanya di jaringan milik sendiri               │
│                                                             │
│ Network: [192.168.1.0/24 ▼]  [▶ Start Scan]  Nmap v7.94  │
├─────────────────────────────────────────────────────────────┤
│ [████████████░░░░░] 65%  Scanning...  12 devices found     │
├─────────────────────────────────────────────────────────────┤
│ IP Address     │ MAC Address        │ Vendor      │ Host   │
├─────────────────────────────────────────────────────────────┤
│ 192.168.1.1    │ e4:5f:01:ab:cd:12  │ TP-Link     │ router │
│ 192.168.1.100  │ a0:b1:c2:d3:e4:f5  │ Intel Corp  │ laptop │
│ 192.168.1.101  │ b8:27:eb:12:34:56  │ Raspberry   │ raspi  │
├─────────────────────────────────────────────────────────────┤
│ 12 devices found · Scan completed in 8.2s                  │
└─────────────────────────────────────────────────────────────┘
```

Spesifikasi:
- Dropdown network: otomatis terisi dari `get_local_networks()`
- Disclaimer banner kuning di atas (tidak bisa di-dismiss)
- Tabel muncul realtime — row ditambahkan satu per satu saat device ditemukan
- Klik kanan per row (context menu):
  - Copy IP
  - Copy MAC
  - Ping device ini → buka DiagnosticsPage, pre-fill target
  - SSH ke device ini → buka SSH Quick Connect, pre-fill IP
  - Traceroute ke device ini → buka DiagnosticsPage tab Traceroute
- Tombol Export: simpan hasil ke file TXT sederhana
- Jika nmap tidak ada: tampilkan instruksi install
- Jika scan butuh sudo: tampilkan info "MAC address tidak tersedia tanpa sudo"

- [ ] Halaman `LanScannerPage.tsx` lengkap
- [ ] Realtime row update berfungsi
- [ ] Context menu per device berfungsi
- [ ] Disclaimer selalu tampil
- [ ] Fallback UI jika nmap tidak ada

---

### Task AF-1.6 — Integrasi Navigasi

- [ ] Tambahkan "🔍 LAN Scanner" di sidebar section Tools
- [ ] Tambahkan `'lan_scanner'` ke `uiStore` selectedPage
- [ ] Routing di `AppLayout` disambungkan

---

> **Checkpoint AF-1:** LAN Scanner berjalan, device terdeteksi realtime, context menu berfungsi. Konfirmasi ke user.

---

## Phase AF-2 — DNS Benchmark

> Tujuan: Bandingkan latency berbagai DNS server dan tampilkan hasilnya secara visual.
> Tool: `dig` (sudah tersedia sebagai dependency NCP)
> Tidak butuh dependency tambahan.

### Task AF-2.1 — Command `run_dns_benchmark`

Buat `src-tauri/src/commands/dns_benchmark.rs`.

```rust
#[derive(Debug, Clone, Serialize)]
pub struct DnsServer {
    pub name: String,         // "Cloudflare"
    pub ip: String,           // "1.1.1.1"
    pub category: String,     // "Public" | "ISP" | "Custom"
}

#[derive(Debug, Clone, Serialize)]
pub struct DnsBenchmarkResult {
    pub server: DnsServer,
    pub latency_ms: Vec<f64>,   // hasil 5x query
    pub avg_ms: f64,
    pub min_ms: f64,
    pub max_ms: f64,
    pub success_rate: f64,      // persentase query yang berhasil
    pub status: String,         // "done" | "error" | "timeout"
}

#[tauri::command]
pub async fn run_dns_benchmark(
    app: tauri::AppHandle,
    servers: Vec<DnsServer>,
    test_domain: String,        // domain untuk di-query, default: "google.com"
    query_count: u32,           // jumlah query per server, default: 5
) -> Result<Vec<DnsBenchmarkResult>, String> {
    // untuk setiap server:
    //   jalankan: dig @{server_ip} {domain} +time=3 +tries=1
    //   parse "Query time: X msec" dari output
    //   ulangi query_count kali
    //   emit event "dns_benchmark_progress" setelah setiap server selesai
    // return semua hasil, diurutkan dari latency terendah
}
```

Default server list yang sudah di-hardcode:
- Cloudflare: 1.1.1.1
- Cloudflare Alt: 1.0.0.1
- Google: 8.8.8.8
- Google Alt: 8.8.4.4
- Quad9: 9.9.9.9
- OpenDNS: 208.67.222.222
- AdGuard: 94.140.14.14
- (ISP DNS: diambil dari `/etc/resolv.conf` secara otomatis)

- [ ] Command `run_dns_benchmark` dibuat dan di-register
- [ ] Parser output `dig` untuk query time berfungsi
- [ ] Emit progress per server selesai
- [ ] ISP DNS otomatis terdeteksi

---

### Task AF-2.2 — Halaman DNS Benchmark

Buat `src/pages/DnsBenchmarkPage.tsx`.

Layout:

```
┌─ DNS Benchmark ──────────────────────────────────────────┐
│ Test domain: [google.com]  Queries: [5▼]  [▶ Run Test]  │
├──────────────────────────────────────────────────────────┤
│ Testing Cloudflare (1.1.1.1)... [3/5]                   │
├──────────────────────────────────────────────────────────┤
│ Rank │ Server          │ IP            │ Avg   │ Bar     │
├──────────────────────────────────────────────────────────┤
│  🥇  │ Cloudflare      │ 1.1.1.1       │ 8ms   │ ██      │
│  🥈  │ Google          │ 8.8.8.8       │ 12ms  │ ███     │
│  🥉  │ Quad9           │ 9.9.9.9       │ 15ms  │ ████    │
│   4  │ ISP DNS         │ 202.x.x.x     │ 28ms  │ ███████ │
│   5  │ OpenDNS         │ 208.67.x.x    │ 35ms  │ █████████│
├──────────────────────────────────────────────────────────┤
│ ✅ Rekomendasi: Cloudflare (1.1.1.1) — latency terendah │
└──────────────────────────────────────────────────────────┘
```

Spesifikasi:
- Bar horizontal per server, panjang proporsional terhadap latency
- Warna bar: hijau (terbaik) → kuning → merah (terburuk), gradasi otomatis
- Row muncul satu per satu saat setiap server selesai ditest
- Klik row: tampilkan detail (5 hasil query individual, min/max/avg)
- Tombol "Set as DNS": buka nm-connection-editor atau instruksi cara ganti DNS
- Tambahkan custom server: input field + tombol Add

- [ ] Halaman `DnsBenchmarkPage.tsx` lengkap
- [ ] Bar chart proporsional dan warna gradasi berfungsi
- [ ] Row muncul realtime
- [ ] Detail per server bisa dibuka

---

### Task AF-2.3 — Integrasi Navigasi

- [ ] Tambahkan "📊 DNS Benchmark" di sidebar section Tools
- [ ] Routing disambungkan

---

> **Checkpoint AF-2:** DNS Benchmark berjalan, hasil tampil dengan ranking dan bar chart. Konfirmasi ke user.

---

## Phase AF-3 — Wake-on-LAN

> Tujuan: Kirim magic packet untuk menyalakan perangkat lain dari jaringan.
> Tool: Pure Rust — tidak butuh binary eksternal sama sekali.
> Implementasi: kirim UDP broadcast ke port 9 dengan magic packet (6x 0xFF + 16x MAC address).

### Task AF-3.1 — Command `send_wol`

Buat `src-tauri/src/commands/wol.rs`.

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WolTarget {
    pub name: String,           // label perangkat, contoh: "PC Lab 1"
    pub mac: String,            // "e4:5f:01:ab:cd:12"
    pub broadcast: String,      // "192.168.1.255" atau "255.255.255.255"
    pub port: u16,              // default: 9
}

#[tauri::command]
pub async fn send_wol(target: WolTarget) -> Result<String, String> {
    // 1. parse MAC address → [u8; 6]
    // 2. buat magic packet: [0xFF; 6] + MAC × 16 = 102 bytes
    // 3. kirim via UDP socket ke broadcast:port
    // 4. return "Magic packet sent to {mac}"
    //
    // Catatan: WoL tidak ada konfirmasi — kita hanya bisa tahu packet terkirim,
    // tidak bisa tahu apakah perangkat berhasil menyala
}

#[tauri::command]
pub async fn save_wol_targets(targets: Vec<WolTarget>) -> Result<(), String> {
    // simpan ke file JSON via Tauri path API
    // path: app_data_dir/wol_targets.json
}

#[tauri::command]
pub async fn load_wol_targets() -> Result<Vec<WolTarget>, String> {
    // load dari file JSON
    // return vec kosong jika file belum ada
}
```

- [ ] Magic packet builder benar (102 bytes: 6xFF + MAC×16)
- [ ] UDP send berfungsi
- [ ] Save/load targets ke disk berfungsi
- [ ] Test: kirim ke MAC address perangkat yang support WoL

---

### Task AF-3.2 — Halaman Wake-on-LAN

Buat `src/pages/WolPage.tsx`.

Layout:

```
┌─ Wake-on-LAN ──────────────────────────────────────────┐
│                                                         │
│  Saved Devices                          [+ Add Device]  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 💻 PC Lab 1        e4:5f:01:ab:cd:12   [Wake] [🗑] │ │
│ │ 🖥 Server Utama    a0:b1:c2:d3:e4:f5   [Wake] [🗑] │ │
│ │ 🖨 Printer Kantor  08:00:27:00:ab:cd   [Wake] [🗑] │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│  Quick Wake (tanpa simpan)                              │
│  MAC: [___________________]  [⚡ Send Magic Packet]    │
│                                                         │
│  ℹ️  Perangkat harus support Wake-on-LAN dan           │
│     terhubung ke jaringan yang sama                     │
└─────────────────────────────────────────────────────────┘
```

Spesifikasi:
- Daftar saved devices: load dari disk saat mount
- Tombol Wake: kirim magic packet + tampilkan toast "Magic packet sent!"
- Tambah device: modal form (Name, MAC address, Broadcast IP, Port)
- Validasi format MAC address sebelum kirim
- Quick Wake: kirim langsung tanpa menyimpan
- Info banner di bawah: penjelasan singkat syarat WoL

- [ ] Halaman `WolPage.tsx` lengkap
- [ ] Add/delete saved device berfungsi dan tersimpan ke disk
- [ ] Validasi MAC address berfungsi
- [ ] Quick Wake berfungsi
- [ ] Toast notifikasi muncul setelah send

---

### Task AF-3.3 — Integrasi dari LAN Scanner

Update context menu di `LanScannerPage`:
- Tambahkan item: "Wake-on-LAN → Add to WoL list"
- Saat diklik: buka modal Add Device di WolPage dengan MAC address pre-filled

- [ ] Integrasi LAN Scanner → WoL berfungsi
- [ ] Routing disambungkan di sidebar

---

> **Checkpoint AF-3:** WoL bisa kirim magic packet, saved devices tersimpan ke disk. Konfirmasi ke user.

---

## Phase AF-4 — Wi-Fi Analyzer

> Tujuan: Tampilkan semua jaringan Wi-Fi di sekitar beserta detail teknisnya.
> Tool: `nmcli device wifi list` dan `iwlist scan`
> Catatan: butuh adapter Wi-Fi aktif. Jika tidak ada, tampilkan pesan informatif.

### Task AF-4.1 — Command `scan_wifi_networks`

Buat `src-tauri/src/commands/wifi_analyzer.rs`.

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WifiNetwork {
    pub ssid: String,
    pub bssid: String,          // MAC access point
    pub signal_strength: i32,   // dBm, contoh: -65
    pub signal_percent: u8,     // 0–100
    pub channel: u8,
    pub frequency_mhz: u32,     // 2412, 5180, dll
    pub band: String,           // "2.4 GHz" | "5 GHz" | "6 GHz"
    pub security: String,       // "WPA2" | "WPA3" | "Open" | dll
    pub mode: String,           // "Infrastructure" | "Ad-Hoc"
    pub in_use: bool,           // apakah ini yang sedang dipakai
}

#[tauri::command]
pub async fn scan_wifi_networks() -> Result<Vec<WifiNetwork>, String> {
    // jalankan: nmcli -t -f SSID,BSSID,SIGNAL,CHAN,FREQ,SECURITY,IN-USE device wifi list
    // parse output
    // urutkan: in_use dulu, lalu signal strength tertinggi
}
```

- [ ] Command `scan_wifi_networks` dibuat dan di-register
- [ ] Parser nmcli wifi output berfungsi
- [ ] Konversi signal strength ke persentase: `(100 + dBm) * 2` clamped 0–100
- [ ] Band detection dari frekuensi: < 3000 MHz = 2.4GHz, 5000-6000 = 5GHz, > 6000 = 6GHz

---

### Task AF-4.2 — Halaman Wi-Fi Analyzer

Buat `src/pages/WifiAnalyzerPage.tsx`.

Layout:

```
┌─ Wi-Fi Analyzer ──────────────────────────────── [🔄 Scan] ┐
│                                                              │
│ SSID              │ Signal    │ Channel │ Band   │ Security │
├──────────────────────────────────────────────────────────────┤
│ ✅ HomeNetwork    │ ████░ 78% │ CH 6    │ 2.4GHz │ WPA2    │
│    OfficeWifi     │ ███░░ 62% │ CH 36   │ 5GHz   │ WPA3    │
│    Neighbor_2.4   │ ██░░░ 45% │ CH 6    │ 2.4GHz │ WPA2    │
│    FreeWifi       │ █░░░░ 20% │ CH 11   │ 2.4GHz │ Open    │
├──────────────────────────────────────────────────────────────┤
│ Channel Usage (2.4 GHz)                                      │
│ CH1  ░░░░░░                                                  │
│ CH6  ████████ (2 networks)  ← crowded!                      │
│ CH11 ██                                                      │
└──────────────────────────────────────────────────────────────┘
```

Spesifikasi:
- Signal bar visual (5 kotak) + persentase
- Baris `in_use` di-highlight dan ada ikon ✅
- Security "Open" ditandai warna oranye/merah sebagai peringatan
- Section "Channel Usage" di bawah: bar horizontal per channel, tampilkan jika ada 2+ network di channel yang sama dengan label "crowded!"
- Tombol Scan: refresh list
- Auto-scan saat halaman dibuka
- Jika tidak ada adapter Wi-Fi: tampilkan pesan informatif

- [ ] Halaman `WifiAnalyzerPage.tsx` lengkap
- [ ] Signal bar visual berfungsi
- [ ] Channel usage section tampil
- [ ] "Crowded" warning berfungsi

---

### Task AF-4.3 — Integrasi Navigasi

- [ ] Tambahkan "📶 Wi-Fi Analyzer" di sidebar
- [ ] Routing disambungkan

---

> **Checkpoint AF-4:** Wi-Fi Analyzer tampil daftar jaringan dengan signal strength dan channel info. Konfirmasi ke user.

---

## Phase AF-5 — Interface Traffic Graph

> Tujuan: Grafik realtime download/upload per interface dengan history.
> Tool: `/proc/net/dev` — sudah dipakai di StatusBar, tinggal diperluas.
> Library chart: recharts (sudah tersedia di React environment NCP)

### Task AF-5.1 — Command `get_traffic_history`

Data traffic sudah ada dari `/proc/net/dev`. Yang perlu ditambahkan adalah **history buffer** di sisi Rust.

Buat `src-tauri/src/commands/traffic_monitor.rs`:

```rust
// Simpan history traffic di memory (tidak ke disk)
// Buffer: 60 data points per interface (1 menit jika poll tiap detik)

#[derive(Debug, Clone, Serialize)]
pub struct TrafficPoint {
    pub timestamp: u64,       // unix timestamp ms
    pub rx_bytes_per_sec: f64,
    pub tx_bytes_per_sec: f64,
}

#[tauri::command]
pub async fn get_traffic_history(
    iface: String,
    duration_seconds: u32,    // 60 | 300 | 3600
) -> Result<Vec<TrafficPoint>, String> {
    // return history dari buffer in-memory
    // jika duration > buffer yang tersedia, return semua yang ada
}

#[tauri::command]
pub async fn start_traffic_monitor(
    app: tauri::AppHandle,
    iface: String,
) -> Result<(), String> {
    // mulai polling /proc/net/dev setiap 1 detik
    // simpan ke buffer
    // emit event "traffic_update" setiap detik
}
```

- [ ] Buffer history traffic di-implement di Rust (in-memory, reset saat app restart)
- [ ] Command `get_traffic_history` dan `start_traffic_monitor` dibuat

---

### Task AF-5.2 — Komponen TrafficGraph

Buat `src/components/traffic/TrafficGraph.tsx`.

Gunakan `recharts` (LineChart).

Props:
```ts
interface TrafficGraphProps {
  iface: string
  duration: 60 | 300 | 3600   // 1 menit | 5 menit | 1 jam
}
```

Spesifikasi:
- Dua line: Download (biru) dan Upload (hijau)
- Y-axis: auto-scale, format KB/s atau MB/s
- X-axis: waktu (HH:MM:SS)
- Tooltip saat hover: nilai download + upload di titik tersebut
- Toggle duration: tombol "1m | 5m | 1h" di pojok kanan atas
- Area fill semi-transparan di bawah tiap line

- [ ] Komponen `TrafficGraph.tsx` dibuat dengan recharts
- [ ] Auto-scale Y-axis berfungsi
- [ ] Toggle duration berfungsi

---

### Task AF-5.3 — Halaman Traffic Monitor

Buat `src/pages/TrafficMonitorPage.tsx`.

Layout:
- Dropdown pilih interface di atas
- Graph besar (full width)
- Di bawah graph: stats ringkas (current RX, current TX, total RX session, total TX session)
- Otomatis mulai monitor interface yang dipilih

- [ ] Halaman `TrafficMonitorPage.tsx` lengkap
- [ ] Ganti interface → graph reset dan mulai dari awal
- [ ] Routing disambungkan di sidebar

---

> **Checkpoint AF-5:** Traffic graph realtime berjalan, data muncul setiap detik. Konfirmasi ke user.

---

## Phase AF-6 — VLAN Info

> Tujuan: Tampilkan informasi VLAN yang terkonfigurasi di sistem.
> Tool: `ip link show type vlan`, `cat /proc/net/vlan/config`
> Relevan untuk pelajar TKJ dan pengguna MikroTik/Cisco.

### Task AF-6.1 — Command `get_vlan_info`

Buat `src-tauri/src/commands/vlan.rs`:

```rust
#[derive(Debug, Clone, Serialize)]
pub struct VlanInterface {
    pub name: String,           // "eth0.10"
    pub vlan_id: u16,           // 10
    pub parent_interface: String, // "eth0"
    pub state: String,
    pub ipv4: Option<String>,
    pub mac: Option<String>,
}

#[tauri::command]
pub async fn get_vlan_info() -> Result<Vec<VlanInterface>, String> {
    // jalankan: ip -j link show type vlan
    // parse output JSON
    // untuk setiap VLAN interface, ambil juga IP dari ip -j addr show {name}
}
```

- [ ] Command `get_vlan_info` dibuat
- [ ] Return list kosong (bukan error) jika tidak ada VLAN terkonfigurasi

---

### Task AF-6.2 — Halaman VLAN Info

Buat `src/pages/VlanPage.tsx`.

Layout:
```
┌─ VLAN Interfaces ─────────────────────────────────────────┐
│                                                            │
│ Interface  │ VLAN ID │ Parent  │ IP Address  │ Status    │
├────────────────────────────────────────────────────────────┤
│ eth0.10    │ 10      │ eth0    │ 10.0.10.1   │ UP        │
│ eth0.20    │ 20      │ eth0    │ 10.0.20.1   │ UP        │
│ eth0.99    │ 99      │ eth0    │ —           │ DOWN      │
├────────────────────────────────────────────────────────────┤
│ 3 VLAN interfaces found                                    │
│                                                            │
│ ℹ️  Untuk membuat VLAN baru, gunakan nm-connection-editor │
└────────────────────────────────────────────────────────────┘
```

Jika tidak ada VLAN: tampilkan empty state dengan penjelasan singkat apa itu VLAN dan cara membuatnya.

- [ ] Halaman `VlanPage.tsx` lengkap
- [ ] Empty state informatif
- [ ] Routing disambungkan di sidebar

---

> **Checkpoint AF-6:** VLAN info tampil. Konfirmasi ke user.

---

## Phase AF-7 — Packet Capture Sederhana

> Tujuan: Capture paket jaringan tanpa perlu membuka Wireshark.
> Tool: `tcpdump`
> Catatan: butuh sudo. File `.pcap` disimpan ke lokasi yang dipilih user.

### Task AF-7.1 — Command `run_packet_capture`

Buat `src-tauri/src/commands/packet_capture.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureConfig {
    pub interface: String,       // "enp5s0"
    pub filter: Option<String>,  // BPF filter, contoh: "port 80" atau "host 8.8.8.8"
    pub packet_count: Option<u32>, // stop setelah N paket, None = manual stop
    pub output_path: String,     // path file .pcap output
}

#[derive(Debug, Clone, Serialize)]
pub struct CaptureProgress {
    pub packets_captured: u32,
    pub file_size_bytes: u64,
    pub message: String,
}

#[tauri::command]
pub async fn start_capture(
    app: tauri::AppHandle,
    config: CaptureConfig,
) -> Result<(), String> {
    // jalankan: sudo tcpdump -i {iface} {filter} -w {output_path} -c {count}
    // emit event "capture_progress" setiap 1 detik
}

#[tauri::command]
pub async fn stop_capture() -> Result<String, String> {
    // kill proses tcpdump
    // return path file output
}
```

- [ ] Command `start_capture` dan `stop_capture` dibuat
- [ ] File `.pcap` tersimpan di path yang ditentukan
- [ ] Emit progress setiap detik

---

### Task AF-7.2 — Halaman Packet Capture

Buat `src/pages/PacketCapturePage.tsx`.

Layout:
```
┌─ Packet Capture ───────────────────────────────────────────┐
│                                                             │
│ Interface: [enp5s0 ▼]  Filter: [port 80         ]         │
│ Output:    [~/captures/capture_2026.pcap] [Browse]         │
│ Stop after: [○ Manual  ● 100 packets  ○ 60 seconds]        │
│                                                             │
│             [ ⏺ Start Capture ]                            │
│                                                             │
│ ─────────────────────────────────────────────────          │
│ Status: Capturing...                                        │
│ Packets: 47  │  File size: 12.4 KB                         │
│                                                             │
│ ℹ️  Filter examples:                                       │
│    port 80          → HTTP traffic                         │
│    host 8.8.8.8     → traffic to/from 8.8.8.8             │
│    tcp              → TCP only                             │
│    not port 22      → exclude SSH                          │
│                                                             │
│ [ Open in Wireshark ]  (jika Wireshark terinstall)         │
└─────────────────────────────────────────────────────────────┘
```

- [ ] Halaman `PacketCapturePage.tsx` lengkap
- [ ] File browser untuk output path berfungsi (Tauri dialog API)
- [ ] Progress capture tampil realtime
- [ ] Tombol "Open in Wireshark" muncul jika Wireshark tersedia
- [ ] Routing disambungkan

---

> **Checkpoint AF-7:** Packet capture berjalan, file .pcap tersimpan, bisa dibuka di Wireshark. Konfirmasi ke user.

---

## Phase AF-8 — Firewall Manager

> Tujuan: GUI untuk melihat dan mengelola rules firewall.
> Tool: `ufw` (primary), `nftables` (fallback)
> ⚠️ Phase ini paling kompleks dan menyentuh security layer — kerjakan dengan ekstra hati-hati.
> Setiap aksi yang mengubah rules HARUS ada konfirmasi dialog.

### Task AF-8.1 — Deteksi Firewall Backend

```rust
#[derive(Debug, Serialize)]
pub enum FirewallBackend {
    Ufw,
    Nftables,
    Iptables,
    None,
}

#[tauri::command]
pub async fn detect_firewall() -> FirewallBackend {
    // cek: which ufw → jika ada dan aktif, return Ufw
    // cek: which nft → jika ada, return Nftables
    // cek: which iptables → return Iptables
    // else: return None
}
```

- [ ] Deteksi firewall backend berfungsi

---

### Task AF-8.2 — Command untuk UFW (Primary)

```rust
#[tauri::command]
pub async fn get_ufw_status() -> Result<UfwStatus, String>
// jalankan: sudo ufw status verbose

#[tauri::command]
pub async fn get_ufw_rules() -> Result<Vec<UfwRule>, String>
// jalankan: sudo ufw status numbered

#[tauri::command]
pub async fn ufw_allow(port: u16, protocol: Option<String>) -> Result<(), String>
// jalankan: sudo ufw allow {port}/{proto}

#[tauri::command]
pub async fn ufw_deny(port: u16, protocol: Option<String>) -> Result<(), String>

#[tauri::command]
pub async fn ufw_delete_rule(rule_number: u32) -> Result<(), String>
// jalankan: sudo ufw delete {number}

#[tauri::command]
pub async fn ufw_enable() -> Result<(), String>
#[tauri::command]
pub async fn ufw_disable() -> Result<(), String>
```

- [ ] Semua command UFW dibuat
- [ ] Semua command yang mengubah state di-guard dengan konfirmasi di level frontend

---

### Task AF-8.3 — Halaman Firewall Manager

Buat `src/pages/FirewallPage.tsx`.

Layout:
```
┌─ Firewall Manager ──────────────────────── Status: ACTIVE ─┐
│ Backend: UFW                    [Disable Firewall]          │
├─────────────────────────────────────────────────────────────┤
│ [+ Add Rule]                                                │
│                                                             │
│ # │ To          │ Action │ From      │ Protocol            │
├─────────────────────────────────────────────────────────────┤
│ 1 │ 22/tcp      │ ALLOW  │ Anywhere  │ TCP    [Delete]     │
│ 2 │ 80/tcp      │ ALLOW  │ Anywhere  │ TCP    [Delete]     │
│ 3 │ 443/tcp     │ ALLOW  │ Anywhere  │ TCP    [Delete]     │
│ 4 │ 8080/tcp    │ DENY   │ Anywhere  │ TCP    [Delete]     │
├─────────────────────────────────────────────────────────────┤
│ ⚠️  Perubahan firewall bersifat permanen dan                │
│    dapat mempengaruhi koneksi aktif                         │
└─────────────────────────────────────────────────────────────┘
```

- [ ] Halaman `FirewallPage.tsx` lengkap
- [ ] Setiap aksi destruktif (delete, disable) wajib konfirmasi dialog
- [ ] Status ACTIVE/INACTIVE tampil dengan warna jelas
- [ ] Warning banner selalu tampil
- [ ] Routing disambungkan

---

> **Checkpoint AF-8:** Firewall Manager bisa menampilkan dan mengelola rules UFW. Konfirmasi ke user dengan ekstra teliti.

---

## Phase AF-9 — Bandwidth Monitor per Process

> Tujuan: Tampilkan proses mana yang paling banyak menggunakan bandwidth.
> Tool: `nethogs`
> Install: `sudo pacman -S nethogs`
> Butuh: sudo

### Task AF-9.1 — Command `run_nethogs`

Buat `src-tauri/src/commands/bandwidth_monitor.rs`:

```rust
#[derive(Debug, Clone, Serialize)]
pub struct ProcessBandwidth {
    pub pid: u32,
    pub process_name: String,
    pub program_path: String,
    pub sent_kb_per_sec: f64,
    pub received_kb_per_sec: f64,
    pub total_sent_mb: f64,
    pub total_received_mb: f64,
}

#[tauri::command]
pub async fn start_bandwidth_monitor(
    app: tauri::AppHandle,
    iface: String,
) -> Result<(), String> {
    // jalankan: sudo nethogs -t {iface}
    //   -t = troff mode (machine-readable output)
    // parse output per proses
    // emit event "bandwidth_update" setiap update dari nethogs
}

#[tauri::command]
pub async fn stop_bandwidth_monitor() -> Result<(), String>
```

- [ ] Command dibuat, nethogs di-spawn dan di-parse
- [ ] Event emit berfungsi

---

### Task AF-9.2 — Halaman Bandwidth Monitor

Buat `src/pages/BandwidthMonitorPage.tsx`.

Layout:
```
┌─ Bandwidth Monitor ───────────── Interface: [enp5s0▼] [▶] ─┐
│                                                              │
│ Process           │ PID   │ Download    │ Upload    │ Total  │
├──────────────────────────────────────────────────────────────┤
│ firefox           │ 1234  │ 2.4 MB/s   │ 0.1 MB/s  │ 45 MB │
│ spotify           │ 5678  │ 0.8 MB/s   │ 0.0 MB/s  │ 12 MB │
│ code              │ 9012  │ 0.2 MB/s   │ 0.1 MB/s  │ 3 MB  │
│ curl              │ 3456  │ 0.1 MB/s   │ 0.0 MB/s  │ 1 MB  │
├──────────────────────────────────────────────────────────────┤
│ Total: ↓ 3.5 MB/s  ↑ 0.2 MB/s                              │
└──────────────────────────────────────────────────────────────┘
```

Spesifikasi:
- Update realtime setiap nethogs emit data baru
- Diurutkan berdasarkan total bandwidth (download + upload) tertinggi
- Bar mini di kolom Download dan Upload (proporsional)
- Total row di bawah
- Jika nethogs tidak terinstall: tampilkan instruksi install

- [ ] Halaman `BandwidthMonitorPage.tsx` lengkap
- [ ] Realtime update berfungsi
- [ ] Sorting otomatis per bandwidth tertinggi
- [ ] Routing disambungkan

---

> **Checkpoint AF-9 — FINAL:** Semua fitur tambahan selesai. Demo lengkap semua Phase AF ke user.

---

## Ringkasan Sidebar Navigation (Setelah Semua Phase Selesai)

```
NETWORK ADAPTERS
  🔌 Ethernet (enp5s0)
  📶 Wi-Fi (wlan0)
  🖥 VirtualBox Host-Only
  🐳 Docker (docker0)
  🛡 Tailscale

TOOLS
  🩺 Diagnostics
  🗺 Routing Table
  📋 ARP Table
  🚪 Open Ports
  🔍 DNS Lookup
  🚀 Speed Test        ← TASKS_SPEEDTEST.md
  🔎 LAN Scanner       ← AF-1
  📊 DNS Benchmark     ← AF-2
  ⚡ Wake-on-LAN       ← AF-3
  📶 Wi-Fi Analyzer    ← AF-4
  📈 Traffic Graph     ← AF-5
  🏷 VLAN Info         ← AF-6
  📦 Packet Capture    ← AF-7
  🔥 Firewall          ← AF-8
  📊 Bandwidth Monitor ← AF-9

INTEGRATIONS
  🦈 Wireshark
  💻 WinBox
  📁 Packet Tracer
  🔐 SSH Quick Connect

SYSTEM
  📊 Dashboard
  ⚙️  Settings
```

---

*Kerjakan Phase demi Phase. Laporkan ke user setelah setiap checkpoint.*
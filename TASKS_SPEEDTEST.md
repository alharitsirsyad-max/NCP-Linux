# TASKS_SPEEDTEST.md — Fitur Speed Test
# Network Control Panel — Addendum Task

> File ini adalah tambahan terpisah dari `TASKS.md` utama.
> Kerjakan setelah Phase 2.5 selesai, bisa disisipkan sebagai **Phase 6.5** (sebelum Phase 7 — Context Menu).
>
> **Aturan pengerjaan:**
> - Kerjakan satu task dalam satu waktu
> - Setiap task punya checklist — centang setelah selesai dan diverifikasi
> - Laporkan ke user setelah seluruh Phase ini selesai

---

## Phase 6.5 — Speed Test

> Tujuan: Tambahkan halaman Speed Test yang bisa mengukur ping, download speed, dan upload speed menggunakan `speedtest-cli` sebagai backend engine.
>
> Tool: `speedtest-cli` (binary sistem, install via `sudo pacman -S speedtest-cli`)
> Data: tidak ada file yang tersimpan ke disk — semua hasil hanya di memory selama sesi berjalan

---

### Task 6.5.1 — Cek & Validasi Dependency

Buat helper Rust untuk mengecek apakah `speedtest-cli` tersedia di sistem.

Di `src-tauri/src/commands/speedtest.rs`, buat:

```rust
#[tauri::command]
pub async fn check_speedtest_available() -> bool {
    // jalankan: which speedtest-cli
    // return true jika exit code 0, false jika tidak ditemukan
}
```

- [ ] Command `check_speedtest_available` dibuat dan di-register di `lib.rs`
- [ ] Test via console: `invoke('check_speedtest_available')` return `true` jika binary ada

---

### Task 6.5.2 — Tauri Command: `run_speedtest` dengan Streaming

Ini command utama. Karena speed test berjalan 20–40 detik, harus streaming progress ke frontend via events — jangan blocking.

Buat struct hasil di `src-tauri/src/models.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeedTestResult {
    pub ping: f64,          // ms
    pub download: f64,      // Mbps
    pub upload: f64,        // Mbps
    pub server_name: String,
    pub server_country: String,
    pub isp: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpeedTestProgress {
    pub stage: String,      // "ping" | "download" | "upload" | "done" | "error"
    pub percent: u8,        // 0-100
    pub current_value: Option<f64>, // nilai sementara saat download/upload berjalan
    pub message: String,
}
```

Buat command:

```rust
#[tauri::command]
pub async fn run_speedtest(app: tauri::AppHandle) -> Result<SpeedTestResult, String> {
    // 1. emit progress: stage="ping", percent=10, message="Testing ping..."
    // 2. jalankan: speedtest-cli --json --secure
    //    --secure memaksa HTTPS, --json output dalam format JSON
    // 3. emit progress bertahap selama proses berjalan:
    //    - "ping"     → percent 10–30
    //    - "download" → percent 30–70
    //    - "upload"   → percent 70–95
    //    - "done"     → percent 100
    // 4. parse stdout JSON saat proses selesai
    // 5. return SpeedTestResult
    //
    // Catatan: speedtest-cli --json tidak streaming, jadi emit progress
    // berdasarkan timer estimasi (setiap 2 detik naik beberapa persen)
    // sambil menunggu proses selesai
}
```

Format JSON output `speedtest-cli` yang perlu di-parse:
```json
{
  "ping": 12.345,
  "download": 94123456.78,
  "upload": 45678901.23,
  "server": {
    "name": "Jakarta",
    "country": "Indonesia",
    "sponsor": "Biznet"
  },
  "client": {
    "isp": "Telkom Indonesia"
  },
  "timestamp": "2026-01-01T00:00:00Z"
}
```

Konversi: `download` dan `upload` dari output adalah bits/second — konversi ke Mbps dengan dibagi `1_000_000`.

- [ ] Struct `SpeedTestResult` dan `SpeedTestProgress` dibuat di `models.rs`
- [ ] File `src-tauri/src/commands/speedtest.rs` dibuat
- [ ] Command `run_speedtest` dibuat dan di-register di `lib.rs`
- [ ] Progress events ter-emit selama test berjalan
- [ ] Konversi bits/s → Mbps benar
- [ ] Test manual via console browser: `invoke('run_speedtest')` mengembalikan data lengkap

---

### Task 6.5.3 — Hook: `useSpeedTest`

Buat `src/hooks/useSpeedTest.ts`.

```ts
interface SpeedTestState {
  status: 'idle' | 'running' | 'done' | 'error'
  stage: 'ping' | 'download' | 'upload' | null
  percent: number
  currentValue: number | null
  result: SpeedTestResult | null
  error: string | null
}

export function useSpeedTest() {
  // state di atas
  // fungsi start() — invoke run_speedtest + listen events
  // fungsi reset() — kembalikan ke idle
  // cleanup listener saat unmount
}
```

- [ ] Hook `useSpeedTest` dibuat
- [ ] State management bersih (tidak ada memory leak dari event listener)
- [ ] `start()` dan `reset()` berfungsi

---

### Task 6.5.4 — Komponen SpeedGauge

Buat `src/components/speedtest/SpeedGauge.tsx`.

Komponen visual untuk menampilkan satu angka kecepatan (dipakai 3x: ping, download, upload).

Props:
```ts
interface SpeedGaugeProps {
  label: string        // "Download" | "Upload" | "Ping"
  value: number | null // angka hasil, null = belum ada
  unit: string         // "Mbps" | "ms"
  color: string        // CSS color untuk accent gauge
  isActive: boolean    // true = stage ini sedang berjalan (animasi pulse)
}
```

Tampilan per gauge:
```
┌─────────────────┐
│                 │
│   94.5          │  ← angka besar, monospace
│   Mbps          │  ← unit kecil
│                 │
│  Download       │  ← label bawah
└─────────────────┘
```

- Jika `value === null` dan `isActive === false`: tampilkan `--` (abu)
- Jika `isActive === true`: tampilkan animasi angka naik (counter dari 0 ke nilai akhir, durasi 1 detik) + border pulse
- Warna: Download = biru, Upload = hijau, Ping = oranye

- [ ] Komponen `SpeedGauge.tsx` dibuat
- [ ] Animasi counter angka berfungsi saat `isActive` berubah jadi `true`
- [ ] State null ditampilkan sebagai `--`

---

### Task 6.5.5 — Komponen ProgressBar Speed Test

Buat `src/components/speedtest/SpeedTestProgress.tsx`.

Komponen progress bar yang tampil saat test sedang berjalan.

Tampilan:
```
Testing download speed...
[████████████░░░░░░░░] 60%
```

Props:
```ts
interface SpeedTestProgressProps {
  stage: string
  percent: number
  message: string
}
```

- Bar menggunakan warna sesuai stage: ping=oranye, download=biru, upload=hijau
- Animasi smooth CSS transition pada lebar bar
- Teks stage dan pesan di atas bar

- [ ] Komponen `SpeedTestProgress.tsx` dibuat
- [ ] Animasi bar smooth
- [ ] Warna berubah sesuai stage

---

### Task 6.5.6 — Halaman SpeedTest

Buat `src/pages/SpeedTestPage.tsx`.

Layout lengkap:

```
┌─ Speed Test ────────────────────────────────────────────┐
│                                                          │
│   [ISP: Telkom Indonesia]  [Server: Biznet, Jakarta]    │
│              (tampil setelah test selesai)               │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  12.3    │  │  94.5    │  │  45.2    │              │
│  │  ms      │  │  Mbps    │  │  Mbps    │              │
│  │  Ping    │  │ Download │  │  Upload  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                          │
│         [████████████░░░░░░] 60%                        │
│         Testing download speed...                        │
│                                                          │
│              [ ▶  START TEST ]                           │
│                                                          │
│  ─────────────────────────────────────────────          │
│  Last result: Today 14:32 · 94.5↓  45.2↑  12ms         │
└──────────────────────────────────────────────────────────┘
```

Spesifikasi:
- Tombol **START TEST**: besar, centered, biru — saat diklik berubah jadi "STOP" (warna merah)
- Tombol **STOP**: hentikan proses, kembalikan ke idle state (result sebelumnya tetap tampil)
- Progress bar tampil hanya saat `status === 'running'`, hilang saat done/idle
- Tiga gauge selalu tampil — nilai `--` saat belum ada hasil
- Info server dan ISP tampil di atas setelah test selesai
- "Last result" bar di bawah: menampilkan hasil terakhir dengan timestamp (simpan di `useState`, hilang saat refresh aplikasi — tidak perlu persist ke disk)
- Jika `speedtest-cli` tidak terinstall: tampilkan pesan instruksi install beserta command-nya:
  ```
  speedtest-cli tidak ditemukan.
  Install dengan: sudo pacman -S speedtest-cli
  ```

- [ ] `SpeedTestPage.tsx` dibuat dengan semua elemen di atas
- [ ] Tombol START/STOP berfungsi
- [ ] Progress bar tampil dan hilang sesuai state
- [ ] Info server tampil setelah test selesai
- [ ] "Last result" bar tampil setelah test pertama
- [ ] Fallback UI jika speedtest-cli tidak ada

---

### Task 6.5.7 — Integrasi ke Navigasi

Update `src/components/layout/Sidebar.tsx`:
- Tambahkan item baru di section **Tools**:
  ```
  🚀 Speed Test
  ```
  Disisipkan setelah "DNS Lookup", sebelum item lainnya

Update `src/stores/uiStore.ts`:
- Tambahkan `'speedtest'` ke union type `selectedPage`

Update `src/components/layout/AppLayout.tsx`:
- Tambahkan case `speedtest` → render `<SpeedTestPage />`

- [ ] Menu Speed Test tampil di sidebar
- [ ] Klik menu → halaman Speed Test terbuka
- [ ] Tidak ada regresi di halaman lain

---

> **Checkpoint Phase 6.5 — SELESAI:**
> Speed Test berjalan end-to-end: klik Start → progress berjalan → tiga gauge terisi → hasil tampil.
> Verifikasi: jalankan test nyata, bandingkan hasilnya dengan speedtest.net di browser — angka harus dalam range yang wajar.
> Screenshot hasil dan konfirmasi ke user sebelum lanjut ke Phase 7.

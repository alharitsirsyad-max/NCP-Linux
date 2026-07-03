use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;
use tokio::time::{interval, Duration};

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct TrafficPoint {
    pub timestamp: u64,       // unix timestamp ms
    pub rx_bytes_per_sec: f64,
    pub tx_bytes_per_sec: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrafficUpdate {
    pub iface: String,
    pub point: TrafficPoint,
    pub total_rx_bytes: u64,
    pub total_tx_bytes: u64,
}

// ─── In-memory state ──────────────────────────────────────────────────────────

// Per-interface: (last_rx_bytes, last_tx_bytes, last_timestamp_ms, history buffer)
type IfaceState = (u64, u64, u64, Vec<TrafficPoint>);

static STATE: Mutex<Option<HashMap<String, IfaceState>>> = Mutex::new(None);

const MAX_HISTORY: usize = 3600; // up to 1 hour at 1s resolution

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Start polling /proc/net/dev every second for the given interface.
/// Emits "traffic_update" events.  Safe to call multiple times — will restart
/// if called for a different interface.
#[tauri::command]
pub async fn start_traffic_monitor(
    app: tauri::AppHandle,
    iface: String,
) -> Result<(), String> {
    // Reset state for this interface
    {
        let mut guard = STATE.lock().unwrap();
        let map = guard.get_or_insert_with(HashMap::new);
        map.remove(&iface);
    }

    let iface_clone = iface.clone();
    tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(1));
        loop {
            ticker.tick().await;

            let snapshot = match read_iface_bytes(&iface_clone) {
                Some(v) => v,
                None => continue,
            };
            let (rx_bytes, tx_bytes) = snapshot;
            let now_ms = now_ms();

            let (rx_per_sec, tx_per_sec) = {
                let mut guard = STATE.lock().unwrap();
                let map = guard.get_or_insert_with(HashMap::new);

                if let Some((prev_rx, prev_tx, prev_ts, history)) = map.get_mut(&iface_clone) {
                    let elapsed = (now_ms - *prev_ts) as f64 / 1000.0;
                    let rx_ps = if elapsed > 0.0 {
                        (rx_bytes.saturating_sub(*prev_rx) as f64) / elapsed
                    } else {
                        0.0
                    };
                    let tx_ps = if elapsed > 0.0 {
                        (tx_bytes.saturating_sub(*prev_tx) as f64) / elapsed
                    } else {
                        0.0
                    };

                    let point = TrafficPoint {
                        timestamp: now_ms,
                        rx_bytes_per_sec: rx_ps,
                        tx_bytes_per_sec: tx_ps,
                    };
                    history.push(point.clone());
                    if history.len() > MAX_HISTORY {
                        history.remove(0);
                    }

                    *prev_rx = rx_bytes;
                    *prev_tx = tx_bytes;
                    *prev_ts = now_ms;
                    (rx_ps, tx_ps)
                } else {
                    // First sample — just record baseline
                    map.insert(iface_clone.clone(), (rx_bytes, tx_bytes, now_ms, Vec::new()));
                    continue;
                }
            };

            let update = TrafficUpdate {
                iface: iface_clone.clone(),
                point: TrafficPoint {
                    timestamp: now_ms,
                    rx_bytes_per_sec: rx_per_sec,
                    tx_bytes_per_sec: tx_ps(rx_per_sec, tx_per_sec),
                },
                total_rx_bytes: rx_bytes,
                total_tx_bytes: tx_bytes,
            };

            let _ = app.emit("traffic_update", update);
        }
    });

    Ok(())
}

// small helper to avoid confusing closures
fn tx_ps(_rx: f64, tx: f64) -> f64 { tx }

/// Return stored history for an interface.
/// `duration_seconds` limits how many data points are returned (most recent).
#[tauri::command]
pub fn get_traffic_history(
    iface: String,
    duration_seconds: u32,
) -> Result<Vec<TrafficPoint>, String> {
    let guard = STATE.lock().unwrap();
    let map = match guard.as_ref() {
        Some(m) => m,
        None => return Ok(Vec::new()),
    };

    let history = match map.get(&iface) {
        Some((_, _, _, h)) => h,
        None => return Ok(Vec::new()),
    };

    let limit = duration_seconds as usize;
    let start = if history.len() > limit {
        history.len() - limit
    } else {
        0
    };

    Ok(history[start..].to_vec())
}

/// Stop monitoring the given interface (drops state).
#[tauri::command]
pub fn stop_traffic_monitor(iface: String) {
    let mut guard = STATE.lock().unwrap();
    if let Some(map) = guard.as_mut() {
        map.remove(&iface);
    }
}

/// List network interfaces from /proc/net/dev.
#[tauri::command]
pub fn list_traffic_interfaces() -> Vec<String> {
    let content = match std::fs::read_to_string("/proc/net/dev") {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let mut ifaces: Vec<String> = content
        .lines()
        .skip(2) // skip header lines
        .filter_map(|line| {
            let name = line.trim().split(':').next()?.trim().to_string();
            if name.is_empty() { None } else { Some(name) }
        })
        .filter(|name| name != "lo") // skip loopback
        .collect();

    ifaces.sort();
    ifaces
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn read_iface_bytes(iface: &str) -> Option<(u64, u64)> {
    let content = std::fs::read_to_string("/proc/net/dev").ok()?;
    for line in content.lines().skip(2) {
        let line = line.trim();
        let (name, rest) = line.split_once(':')?;
        if name.trim() != iface {
            continue;
        }
        let cols: Vec<&str> = rest.split_whitespace().collect();
        if cols.len() >= 9 {
            let rx = cols[0].parse::<u64>().ok()?;
            let tx = cols[8].parse::<u64>().ok()?;
            return Some((rx, tx));
        }
    }
    None
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

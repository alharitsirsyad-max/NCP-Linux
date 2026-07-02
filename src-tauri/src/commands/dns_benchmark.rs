use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsServer {
    pub name: String,
    pub ip: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DnsBenchmarkResult {
    pub server: DnsServer,
    pub latency_ms: Vec<f64>,
    pub avg_ms: f64,
    pub min_ms: f64,
    pub max_ms: f64,
    pub success_rate: f64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DnsBenchmarkProgress {
    pub server_name: String,
    pub server_index: u32,
    pub total_servers: u32,
    pub query_index: u32,
    pub total_queries: u32,
    pub current_latency_ms: Option<f64>,
}

/// Read /etc/resolv.conf, parse nameserver lines, return Vec<String> of IP addresses.
#[tauri::command]
pub async fn get_isp_dns() -> Result<Vec<String>, String> {
    let content = tokio::fs::read_to_string("/etc/resolv.conf")
        .await
        .map_err(|e| e.to_string())?;

    let ips: Vec<String> = content
        .lines()
        .filter(|line| line.trim_start().starts_with("nameserver"))
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                Some(parts[1].to_string())
            } else {
                None
            }
        })
        .collect();

    Ok(ips)
}

/// Return hardcoded list of well-known DNS servers plus auto-detected ISP DNS.
#[tauri::command]
pub async fn get_default_dns_servers() -> Result<Vec<DnsServer>, String> {
    let mut servers = vec![
        DnsServer { name: "Cloudflare".to_string(),    ip: "1.1.1.1".to_string(),         category: "Public".to_string() },
        DnsServer { name: "Cloudflare Alt".to_string(), ip: "1.0.0.1".to_string(),        category: "Public".to_string() },
        DnsServer { name: "Google".to_string(),         ip: "8.8.8.8".to_string(),         category: "Public".to_string() },
        DnsServer { name: "Google Alt".to_string(),     ip: "8.8.4.4".to_string(),         category: "Public".to_string() },
        DnsServer { name: "Quad9".to_string(),          ip: "9.9.9.9".to_string(),         category: "Public".to_string() },
        DnsServer { name: "OpenDNS".to_string(),        ip: "208.67.222.222".to_string(),  category: "Public".to_string() },
        DnsServer { name: "AdGuard".to_string(),        ip: "94.140.14.14".to_string(),    category: "Public".to_string() },
    ];

    // Auto-detect ISP DNS
    if let Ok(isp_ips) = get_isp_dns().await {
        // Deduplicate against known public servers
        let known: std::collections::HashSet<&str> = [
            "1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4",
            "9.9.9.9", "208.67.222.222", "94.140.14.14",
        ]
        .iter()
        .cloned()
        .collect();

        for (i, ip) in isp_ips.iter().enumerate() {
            if !known.contains(ip.as_str()) {
                let label = if i == 0 {
                    "ISP DNS".to_string()
                } else {
                    format!("ISP DNS {}", i + 1)
                };
                servers.push(DnsServer {
                    name: label,
                    ip: ip.clone(),
                    category: "ISP".to_string(),
                });
            }
        }
    }

    Ok(servers)
}

/// Run DNS benchmark against a list of servers.
///
/// For each server, runs `query_count` queries using `dig` and emits:
/// - `dns_benchmark_progress` after each individual query
/// - `dns_benchmark_server_done` after each server finishes
///
/// Returns sorted results by avg_ms ascending (failed servers last).
#[tauri::command]
pub async fn run_dns_benchmark(
    app: tauri::AppHandle,
    servers: Vec<DnsServer>,
    test_domain: String,
    query_count: u32,
) -> Result<Vec<DnsBenchmarkResult>, String> {
    let total_servers = servers.len() as u32;
    let mut results: Vec<DnsBenchmarkResult> = Vec::new();

    for (server_index, server) in servers.iter().enumerate() {
        let mut latencies: Vec<f64> = Vec::new();
        let mut failures = 0u32;

        for query_index in 0..query_count {
            // Run: dig @{ip} {domain} +time=3 +tries=1 +noall +stats
            let output = Command::new("dig")
                .args([
                    &format!("@{}", server.ip),
                    &test_domain,
                    "+time=3",
                    "+tries=1",
                    "+noall",
                    "+stats",
                ])
                .output()
                .await;

            let latency_ms: Option<f64> = match output {
                Ok(out) if out.status.success() => {
                    let stdout = String::from_utf8_lossy(&out.stdout);
                    parse_dig_query_time(&stdout)
                }
                Ok(out) => {
                    // dig returned non-zero (e.g., SERVFAIL, timeout)
                    let stdout = String::from_utf8_lossy(&out.stdout);
                    // Still try to parse — dig can exit non-zero but include timing
                    parse_dig_query_time(&stdout)
                }
                Err(_) => None,
            };

            if let Some(ms) = latency_ms {
                latencies.push(ms);
            } else {
                failures += 1;
                latencies.push(-1.0);
            }

            let _ = app.emit(
                "dns_benchmark_progress",
                DnsBenchmarkProgress {
                    server_name: server.name.clone(),
                    server_index: server_index as u32,
                    total_servers,
                    query_index,
                    total_queries: query_count,
                    current_latency_ms: latency_ms,
                },
            );
        }

        // Calculate stats from successful queries only
        let successful: Vec<f64> = latencies.iter().copied().filter(|&v| v >= 0.0).collect();
        let success_count = successful.len();
        let success_rate = success_count as f64 / query_count as f64;

        let (avg_ms, min_ms, max_ms, status) = if success_count > 0 {
            let avg = successful.iter().sum::<f64>() / success_count as f64;
            let min = successful.iter().cloned().fold(f64::INFINITY, f64::min);
            let max = successful.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            let status = if failures == 0 { "done" } else { "partial" }.to_string();
            (avg, min, max, status)
        } else {
            (f64::INFINITY, f64::INFINITY, f64::INFINITY, "error".to_string())
        };

        let result = DnsBenchmarkResult {
            server: server.clone(),
            latency_ms: latencies,
            avg_ms,
            min_ms,
            max_ms,
            success_rate,
            status,
        };

        let _ = app.emit("dns_benchmark_server_done", result.clone());
        results.push(result);
    }

    // Sort: successful servers by avg_ms ascending, failed/timeout servers last
    results.sort_by(|a, b| {
        let a_failed = a.status == "error";
        let b_failed = b.status == "error";
        match (a_failed, b_failed) {
            (true, false) => std::cmp::Ordering::Greater,
            (false, true) => std::cmp::Ordering::Less,
            _ => a.avg_ms.partial_cmp(&b.avg_ms).unwrap_or(std::cmp::Ordering::Equal),
        }
    });

    Ok(results)
}

/// Parse "Query time: X msec" from dig +stats output.
fn parse_dig_query_time(output: &str) -> Option<f64> {
    for line in output.lines() {
        let line = line.trim();
        // dig outputs: ";; Query time: 8 msec"
        if line.contains("Query time:") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            // Find the number after "time:"
            for (i, part) in parts.iter().enumerate() {
                if *part == "time:" {
                    if let Some(ms_str) = parts.get(i + 1) {
                        if let Ok(ms) = ms_str.parse::<f64>() {
                            return Some(ms);
                        }
                    }
                }
            }
        }
    }
    None
}

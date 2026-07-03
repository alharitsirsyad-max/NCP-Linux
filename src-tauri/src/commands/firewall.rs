use serde::{Deserialize, Serialize};
use tokio::process::Command;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FirewallBackend {
    Ufw,
    Nftables,
    Iptables,
    None,
}

#[derive(Debug, Clone, Serialize)]
pub struct UfwStatus {
    pub active: bool,
    pub default_incoming: String, // "deny" | "allow" | "disabled"
    pub default_outgoing: String,
    pub logging: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct UfwRule {
    pub number: u32,
    pub to: String,       // destination port/address
    pub action: String,   // "ALLOW" | "DENY" | "REJECT" | "LIMIT"
    pub from: String,     // source
    pub protocol: Option<String>,
    pub comment: Option<String>,
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Detect which firewall backend is installed.
#[tauri::command]
pub async fn detect_firewall() -> FirewallBackend {
    if which_exists("ufw").await {
        return FirewallBackend::Ufw;
    }
    if which_exists("nft").await {
        return FirewallBackend::Nftables;
    }
    if which_exists("iptables").await {
        return FirewallBackend::Iptables;
    }
    FirewallBackend::None
}

/// Get UFW status (active/inactive + defaults).
#[tauri::command]
pub async fn get_ufw_status() -> Result<UfwStatus, String> {
    let output = Command::new("sudo")
        .args(["-n", "ufw", "status", "verbose"])
        .output()
        .await
        .map_err(|e| format!("Failed to run ufw: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() && !stdout.contains("Status:") {
        return Err(format!(
            "ufw error (sudo may need NOPASSWD): {}",
            stderr.trim()
        ));
    }

    Ok(parse_ufw_status(&stdout))
}

/// Get numbered UFW rules.
#[tauri::command]
pub async fn get_ufw_rules() -> Result<Vec<UfwRule>, String> {
    let output = Command::new("sudo")
        .args(["-n", "ufw", "status", "numbered"])
        .output()
        .await
        .map_err(|e| format!("Failed to run ufw: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    if !output.status.success() && stdout.trim().is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("ufw error: {}", stderr.trim()));
    }

    Ok(parse_ufw_rules_numbered(&stdout))
}

/// Allow a port (e.g. "80/tcp", "22", "8080/udp").
#[tauri::command]
pub async fn ufw_allow(rule: String) -> Result<String, String> {
    run_ufw_cmd(&["allow", &rule]).await
}

/// Deny a port.
#[tauri::command]
pub async fn ufw_deny(rule: String) -> Result<String, String> {
    run_ufw_cmd(&["deny", &rule]).await
}

/// Delete a rule by its number (from `ufw status numbered`).
#[tauri::command]
pub async fn ufw_delete_rule(rule_number: u32) -> Result<String, String> {
    // ufw delete N requires "yes" confirmation — use `--force` flag
    run_ufw_cmd(&["--force", "delete", &rule_number.to_string()]).await
}

/// Enable UFW.
#[tauri::command]
pub async fn ufw_enable() -> Result<String, String> {
    run_ufw_cmd(&["--force", "enable"]).await
}

/// Disable UFW.
#[tauri::command]
pub async fn ufw_disable() -> Result<String, String> {
    run_ufw_cmd(&["--force", "disable"]).await
}

/// Reset UFW to defaults (DANGEROUS — clears all rules).
#[tauri::command]
pub async fn ufw_reset() -> Result<String, String> {
    run_ufw_cmd(&["--force", "reset"]).await
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async fn run_ufw_cmd(args: &[&str]) -> Result<String, String> {
    let mut cmd_args = vec!["-n", "ufw"];
    cmd_args.extend_from_slice(args);

    let output = Command::new("sudo")
        .args(&cmd_args)
        .output()
        .await
        .map_err(|e| format!("Failed to run ufw: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !output.status.success() {
        return Err(if !stderr.is_empty() { stderr } else { stdout });
    }

    Ok(if stdout.is_empty() { "OK".to_string() } else { stdout })
}

async fn which_exists(binary: &str) -> bool {
    Command::new("which")
        .arg(binary)
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Parse `ufw status verbose` output.
fn parse_ufw_status(output: &str) -> UfwStatus {
    let lower = output.to_lowercase();
    let active = lower.contains("status: active");

    let default_incoming = output
        .lines()
        .find(|l| l.to_lowercase().contains("default:") && l.to_lowercase().contains("incoming"))
        .and_then(|l| {
            // "Default: deny (incoming), allow (outgoing), disabled (routed)"
            let after_default = l.splitn(2, ':').nth(1)?;
            let before_paren = after_default.split('(').nth(1)?;
            let word = before_paren.split(')').next()?.trim().to_lowercase();
            Some(word)
        })
        .unwrap_or_else(|| "unknown".to_string());

    let default_outgoing = output
        .lines()
        .find(|l| l.to_lowercase().contains("default:") && l.to_lowercase().contains("outgoing"))
        .and_then(|l| {
            let parts: Vec<&str> = l.split('(').collect();
            // second '(' contains outgoing value
            let word = parts.get(2)?.split(')').next()?.trim().to_lowercase();
            Some(word)
        })
        .unwrap_or_else(|| "unknown".to_string());

    let logging = output
        .lines()
        .find(|l| l.to_lowercase().starts_with("logging:"))
        .and_then(|l| l.splitn(2, ':').nth(1))
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "off".to_string());

    UfwStatus {
        active,
        default_incoming,
        default_outgoing,
        logging,
    }
}

/// Parse `ufw status numbered` output into UfwRule list.
///
/// Example lines:
/// ```
///      [ 1] 22/tcp                     ALLOW IN    Anywhere
///      [ 2] 80/tcp                     ALLOW IN    Anywhere
///      [ 3] Anywhere on eth0           ALLOW FWD   Anywhere
/// ```
fn parse_ufw_rules_numbered(output: &str) -> Vec<UfwRule> {
    let mut rules = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        // Must start with '['
        if !line.starts_with('[') {
            continue;
        }

        // Extract rule number
        let close = match line.find(']') {
            Some(i) => i,
            None => continue,
        };
        let num_str = line[1..close].trim();
        let number: u32 = match num_str.parse() {
            Ok(n) => n,
            Err(_) => continue,
        };

        let rest = line[close + 1..].trim();

        // Split into columns by 2+ spaces (UFW output column widths vary)
        let cols: Vec<&str> = rest
            .split("  ")
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();

        if cols.len() < 3 {
            continue;
        }

        // cols[0] = "To" (port/service)
        // cols[1] = "Action" (ALLOW IN, DENY IN, etc.)
        // cols[2] = "From"
        let to = cols[0].to_string();
        let action_raw = cols[1].to_uppercase();
        let from = cols.get(2).unwrap_or(&"Anywhere").to_string();

        // Simplify action: "ALLOW IN" → "ALLOW"
        let action = action_raw
            .split_whitespace()
            .next()
            .unwrap_or("ALLOW")
            .to_string();

        // Extract protocol from "22/tcp"
        let protocol = if to.contains('/') {
            to.split('/').nth(1).map(|s| s.to_uppercase())
        } else {
            None
        };

        rules.push(UfwRule {
            number,
            to,
            action,
            from,
            protocol,
            comment: None,
        });
    }

    rules
}

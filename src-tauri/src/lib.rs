mod models;
mod commands;

use commands::adapter::{list_adapters, enable_adapter, disable_adapter, renew_dhcp, run_nmcli_command, get_ipv4_config, apply_ipv4_config, get_ipv6_config, apply_ipv6_config, apply_dns_config};
use commands::diagnostics::{run_ping, run_dns_lookup, run_traceroute, get_system_info, run_mtr, run_whois};
use commands::dns_benchmark::{get_isp_dns, run_dns_benchmark, get_default_dns_servers};
use commands::lan_scanner::{check_nmap_available, get_local_networks, run_lan_scan, cancel_lan_scan};
use commands::speedtest::{check_speedtest_available, run_speedtest};
use commands::network_tables::{
    get_routing_table, get_arp_table, get_open_ports,
    get_traffic_snapshot, check_internet, get_uptime,
    open_terminal, launch_wireshark,
    ssh_connect, lookup_mac_vendor, save_report,
    launch_winbox, launch_packet_tracer,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_adapters,
            enable_adapter,
            disable_adapter,
            renew_dhcp,
            run_nmcli_command,
            get_ipv4_config,
            apply_ipv4_config,
            get_ipv6_config,
            apply_ipv6_config,
            apply_dns_config,
            run_ping,
            run_dns_lookup,
            run_traceroute,
            get_system_info,
            run_mtr,
            run_whois,
            get_routing_table,
            get_arp_table,
            get_open_ports,
            get_traffic_snapshot,
            check_internet,
            get_uptime,
            open_terminal,
            launch_wireshark,
            ssh_connect,
            lookup_mac_vendor,
            save_report,
            launch_winbox,
            launch_packet_tracer,
            check_speedtest_available,
            run_speedtest,
            check_nmap_available,
            get_local_networks,
            run_lan_scan,
            cancel_lan_scan,
            get_isp_dns,
            run_dns_benchmark,
            get_default_dns_servers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

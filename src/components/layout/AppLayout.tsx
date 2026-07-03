import TitleBar from "./TitleBar";
import MenuBar from "./MenuBar";
import ToolBar from "./ToolBar";
import Sidebar from "./Sidebar";
import StatusBar from "./StatusBar";
import ToastContainer from "../shared/ToastContainer";
import { useUIStore } from "../../stores/uiStore";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useAdapterNotifications } from "../../hooks/useAdapterNotifications";
import AdaptersPage from "../../pages/AdaptersPage";
import DiagnosticsPage from "../../pages/DiagnosticsPage";
import DashboardPage from "../../pages/DashboardPage";
import RoutingPage from "../../pages/RoutingPage";
import ArpPage from "../../pages/ArpPage";
import PortsPage from "../../pages/PortsPage";
import SettingsPage from "../../pages/SettingsPage";
import SSHPage from "../../pages/SSHPage";
import SpeedTestPage from "../../pages/SpeedTestPage";
import LanScannerPage from "../../pages/LanScannerPage";
import DnsBenchmarkPage from "../../pages/DnsBenchmarkPage";
import WolPage from "../../pages/WolPage";
import WifiAnalyzerPage from "../../pages/WifiAnalyzerPage";
import TrafficMonitorPage from "../../pages/TrafficMonitorPage";
import VlanPage from "../../pages/VlanPage";
import PacketCapturePage from "../../pages/PacketCapturePage";
import ComingSoonPage from "../shared/ComingSoonPage";

function PageContent() {
  const { selectedPage } = useUIStore();

  switch (selectedPage) {
    case "adapters":    return <AdaptersPage />;
    case "diagnostics": return <DiagnosticsPage />;
    case "dashboard":   return <DashboardPage />;
    case "routing":     return <RoutingPage />;
    case "arp":         return <ArpPage />;
    case "ports":       return <PortsPage />;
    case "settings":    return <SettingsPage />;
    case "ssh":         return <SSHPage />;
    case "speedtest":   return <SpeedTestPage />;
    case "lan_scanner": return <LanScannerPage />;
    case "dns_benchmark": return <DnsBenchmarkPage />;
    case "wol":           return <WolPage />;
    case "wifi_analyzer": return <WifiAnalyzerPage />;
    case "traffic_monitor": return <TrafficMonitorPage />;
    case "vlan":            return <VlanPage />;
    case "packet_capture":  return <PacketCapturePage />;
    default:            return <ComingSoonPage pageName={selectedPage} />;
  }
}

export default function AppLayout() {
  // Register global keyboard shortcuts
  useKeyboardShortcuts();
  useAdapterNotifications();

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-0)",
        overflow: "hidden",
      }}
    >
      <TitleBar />
      <MenuBar />
      <ToolBar />

      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
        <Sidebar />
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            background: "var(--surface-1)",
            minWidth: 0,
          }}
        >
          <PageContent />
        </div>
      </div>

      <StatusBar />
      <ToastContainer />
    </div>
  );
}

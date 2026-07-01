import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Maximize2, Minimize2, X, Network } from "lucide-react";
import { useState, useEffect } from "react";

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    win.isMaximized().then(setIsMaximized);

    const unlisten = win.onResized(async () => {
      setIsMaximized(await win.isMaximized());
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = () => getCurrentWindow().minimize();
  const handleMaximize = () => getCurrentWindow().toggleMaximize();
  const handleClose = () => getCurrentWindow().close();

  return (
    <div
      data-tauri-drag-region
      style={{
        height: "var(--titlebar-height)",
        background: "var(--accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: "10px",
        paddingRight: "0",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {/* Left: icon + title */}
      <div
        data-tauri-drag-region
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: "var(--on-accent)",
          fontSize: "12px",
          fontWeight: 500,
          pointerEvents: "none",
        }}
      >
        <Network size={14} />
        <span>Network Control Panel</span>
      </div>

      {/* Right: window controls */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <TitleBarButton onClick={handleMinimize} label="Minimize">
          <Minus size={12} />
        </TitleBarButton>
        <TitleBarButton onClick={handleMaximize} label="Maximize">
          {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </TitleBarButton>
        <TitleBarButton onClick={handleClose} label="Close" isClose>
          <X size={12} />
        </TitleBarButton>
      </div>
    </div>
  );
}

interface TitleBarButtonProps {
  onClick: () => void;
  label: string;
  isClose?: boolean;
  children: React.ReactNode;
}

function TitleBarButton({ onClick, label, isClose, children }: TitleBarButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "46px",
        height: "var(--titlebar-height)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: hovered
          ? isClose
            ? "#c42b1c"
            : "rgba(255,255,255,0.15)"
          : "transparent",
        color: "var(--on-accent)",
        border: "none",
        cursor: "pointer",
        transition: "background 0.1s",
      }}
    >
      {children}
    </button>
  );
}

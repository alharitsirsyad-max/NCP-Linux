import { Construction } from "lucide-react";

interface ComingSoonPageProps {
  pageName: string;
}

export default function ComingSoonPage({ pageName }: ComingSoonPageProps) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        color: "var(--text-muted)",
      }}
    >
      <Construction size={32} style={{ opacity: 0.4 }} />
      <div style={{ fontSize: "14px", fontWeight: 500 }}>{pageName}</div>
      <div style={{ fontSize: "12px" }}>Coming soon</div>
    </div>
  );
}

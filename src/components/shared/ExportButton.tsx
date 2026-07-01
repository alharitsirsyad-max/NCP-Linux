import { useState } from "react";
import { Download } from "lucide-react";
import { exportReport, reportTimestamp } from "../../hooks/useExportReport";

interface ExportButtonProps {
  label?: string;
  getContent: () => string;
  filenamePrefix: string;
  disabled?: boolean;
}

export default function ExportButton({ label = "Export", getContent, filenamePrefix, disabled }: ExportButtonProps) {
  const [saving, setSaving] = useState(false);

  const handleExport = async () => {
    setSaving(true);
    const content = getContent();
    if (!content.trim()) {
      setSaving(false);
      return;
    }
    await exportReport(content, `${filenamePrefix}-${reportTimestamp()}.txt`);
    setSaving(false);
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled || saving}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "5px",
        padding: "4px 12px",
        background: "transparent",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-sm)",
        fontSize: "11px",
        color: disabled ? "var(--text-muted)" : "var(--text-secondary)",
        cursor: disabled || saving ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Download size={12} />
      {saving ? "Saving..." : label}
    </button>
  );
}

import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  dangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  dangerous = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    // Backdrop
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      {/* Dialog box */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-lg)",
          padding: "20px",
          minWidth: "320px",
          maxWidth: "420px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          {dangerous && (
            <AlertTriangle size={18} style={{ color: "var(--color-warning)", flexShrink: 0 }} />
          )}
          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
            {title}
          </span>
        </div>

        {/* Message */}
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "18px", lineHeight: 1.5 }}>
          {message}
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "6px 16px",
              borderRadius: "var(--radius-sm)",
              fontSize: "12px",
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-strong)",
              cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "6px 16px",
              borderRadius: "var(--radius-sm)",
              fontSize: "12px",
              background: dangerous ? "var(--color-error)" : "var(--accent)",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { useToastStore, type Toast, type ToastType } from "../../stores/toastStore";

function toastColors(type: ToastType) {
  switch (type) {
    case "error":   return { bg: "rgba(196,43,28,0.08)",  border: "rgba(196,43,28,0.3)",  icon: "var(--color-error)",   text: "var(--color-error)" };
    case "warning": return { bg: "rgba(157,93,0,0.08)",  border: "rgba(157,93,0,0.3)",   icon: "var(--color-warning)", text: "var(--color-warning)" };
    case "success": return { bg: "rgba(16,124,16,0.08)", border: "rgba(16,124,16,0.3)",  icon: "var(--color-success)", text: "var(--color-success)" };
    case "info":    return { bg: "rgba(0,103,192,0.08)", border: "rgba(0,103,192,0.3)",  icon: "var(--color-info)",    text: "var(--color-info)" };
  }
}

function ToastIcon({ type }: { type: ToastType }) {
  const size = 14;
  switch (type) {
    case "error":   return <AlertCircle size={size} />;
    case "warning": return <AlertTriangle size={size} />;
    case "success": return <CheckCircle size={size} />;
    case "info":    return <Info size={size} />;
  }
}

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToastStore();
  const colors = toastColors(toast.type);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "10px 12px",
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: "var(--radius-md)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        minWidth: "260px",
        maxWidth: "360px",
        animation: "slideIn 0.15s ease-out",
      }}
    >
      <span style={{ color: colors.icon, flexShrink: 0, marginTop: "1px" }}>
        <ToastIcon type={toast.type} />
      </span>
      <span style={{ flex: 1, fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.4 }}>
        {toast.message}
      </span>
      <button
        onClick={() => removeToast(toast.id)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "0", flexShrink: 0, lineHeight: 1 }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "calc(var(--statusbar-height) + 12px)",
        right: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        zIndex: 10000,
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

// Inline message. tone: "error" | "info"
export default function Notice({ tone = "info", children, onDismiss }) {
  if (!children) return null;
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <p>{children}</p>
      {onDismiss && (
        <button type="button" className="notice-close" onClick={onDismiss} aria-label="Dismiss message">
          ×
        </button>
      )}
    </div>
  );
}

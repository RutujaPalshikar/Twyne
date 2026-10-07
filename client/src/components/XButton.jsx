// Red X used to remove an item. `label` is read by screen readers ("Remove report.pdf").
export default function XButton({ label, onClick }) {
  return (
    <button type="button" className="x-btn" onClick={onClick} aria-label={label} title={label}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      </svg>
    </button>
  );
}

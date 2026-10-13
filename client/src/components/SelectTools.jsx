export default function SelectTools({
  selectedCount,
  selectableCount,
  onSelectAll,
  onDeselectAll,
  children,
}) {
  return (
    <div className="panel-tools">
      <button
        type="button"
        className="btn btn-ghost btn-small"
        onClick={onSelectAll}
        disabled={selectableCount === 0 || selectedCount === selectableCount}
      >
        Select all
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-small"
        onClick={onDeselectAll}
        disabled={selectedCount === 0}
      >
        Deselect all
      </button>
      <span className="hint spacer" aria-live="polite">
        {selectedCount} selected{children}
      </span>
    </div>
  );
}

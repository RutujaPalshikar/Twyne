import { useRef } from "react";
import { formatBytes } from "../utils/format.js";
import SelectTools from "./SelectTools.jsx";
import XButton from "./XButton.jsx";
import Notice from "./Notice.jsx";

// Files live only in this tab's memory. Nothing is uploaded at this stage.
export default function FilesPanel({ files, selectedIds, max, maxFileSize, error, onPick, onToggle, onSelectAll, onDeselectAll, onRemove }) {
  const inputRef = useRef(null);
  const full = files.length >= max;

  return (
    <section className="panel" aria-labelledby="files-heading">
      <div className="panel-title">
        <h2 id="files-heading">Files</h2>
        <span className="count">{files.length} of {max}</span>
      </div>

      <input ref={inputRef} type="file" multiple className="sr-only" tabIndex={-1} onChange={onPick} />
      <button type="button" className="btn btn-secondary btn-block" onClick={() => inputRef.current.click()} disabled={full}>
        {full ? `Limit of ${max} files reached` : "Choose files"}
      </button>
      <p className="hint">Up to {max} files, {formatBytes(maxFileSize)} each. Files stay in this browser tab and are sent in small pieces when you press SHARE.</p>
      <Notice tone="error">{error}</Notice>

      {files.length === 0 ? (
        <p className="empty">No files yet. Choose up to {max} files from your device.</p>
      ) : (
        <>
          <SelectTools
            selectedCount={selectedIds.size}
            selectableCount={files.length}
            onSelectAll={onSelectAll}
            onDeselectAll={onDeselectAll}
          />
          <ul className="items">
            {files.map((f) => (
              <li key={f.id}>
                <label className="check">
                  <input type="checkbox" checked={selectedIds.has(f.id)} onChange={() => onToggle(f.id)} />
                  <span className="check-text">
                    <strong>{f.file.name}</strong>
                    <span className="muted small">{formatBytes(f.file.size)}</span>
                  </span>
                </label>
                <XButton label={`Remove ${f.file.name}`} onClick={() => onRemove(f)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

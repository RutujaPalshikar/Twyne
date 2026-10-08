import { formatBytes } from "../utils/format.js";

// Files the sender has shared with THIS participant. Chunks are kept in browser memory and
// rebuilt as a Blob; "Download" saves that Blob to the participant's device.
export default function ReceivedFiles({ items, onDismiss }) {
  return (
    <section className={`panel ${items.length === 0 ? "panel-dashed" : ""}`} aria-labelledby="received-heading">
      <h2 id="received-heading">Received files</h2>
      {items.length === 0 ? (
        <p className="empty">Files the sender shares with you will appear here.</p>
      ) : (
        <ul className="items received-list">
          {items.map((item) => {
            const pct = Math.round((item.receivedChunks / item.totalChunks) * 100);
            return (
              <li key={item.id}>
                <div className="check-text">
                  <strong>{item.filename}</strong>
                  <span className="muted small">{formatBytes(item.size)}</span>
                </div>
                <div className="received-state">
                  {item.status === "waiting" && <span className="state state-wait">Waiting</span>}
                  {item.status === "receiving" && (
                    <div className="received-progress">
                      <div className="progress" role="progressbar" aria-label={`Receiving ${item.filename}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                        <span style={{ width: `${pct}%` }} />
                      </div>
                      <span className="muted small">Receiving {pct}%</span>
                    </div>
                  )}
                  {item.status === "ready" && (
                    <>
                      <a className="btn btn-primary btn-small" href={item.url} download={item.filename}>Download</a>
                      <button type="button" className="btn btn-ghost btn-small" onClick={() => onDismiss(item.id)}>
                        Remove
                      </button>
                    </>
                  )}
                  {item.status === "failed" && (
                    <>
                      <span className="state state-failed">NOT RECEIVED</span>
                      <span className="muted small">{item.error}</span>
                      <button type="button" className="btn btn-ghost btn-small" onClick={() => onDismiss(item.id)}>
                        Dismiss
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {items.some((i) => i.status === "ready") && (
        <p className="hint">Received files are kept in this browser tab only. Download them before you leave the room.</p>
      )}
    </section>
  );
}

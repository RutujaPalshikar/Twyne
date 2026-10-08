import { formatBytes, formatTime } from "../utils/format.js";

// Rows come from the server (GET /history): real status and real progress, nothing simulated.
//   row:       { id, filename, size, status, totalChunks, chunkSize, uploadedChunks, createdAt, recipients }
//   recipient: { participantId, name, status, ackedChunks, error }
const ROW_STATUS = {
  queued: ["Waiting", "wait"],
  uploading: ["Sending", "active"],
  completed: ["SENT", "done"],
  partial: ["PARTLY SENT", "partial"],
  failed: ["NOT RECEIVED", "failed"],
  aborted: ["NOT RECEIVED", "failed"],
};

function recipientChip(r, row) {
  if (r.status === "completed") return ["SENT", "done"];
  if (r.status === "failed") return ["NOT RECEIVED", "failed"];
  if (r.ackedChunks > 0) return [`${Math.round((r.ackedChunks / row.totalChunks) * 100)}%`, "active"];
  return ["Waiting", "wait"];
}

function progressCaption(row, received) {
  const n = row.recipients.length;
  if (row.status === "queued") return "Waiting to start";
  if (row.status === "uploading") {
    const sent = Math.min(row.size, row.uploadedChunks * row.chunkSize);
    return `${formatBytes(sent)} of ${formatBytes(row.size)} uploaded`;
  }
  return `Received by ${received} of ${n}`;
}

export default function TransferHistory({ rows }) {
  return (
    <section className="panel" aria-labelledby="history-heading">
      <h2 id="history-heading">Transfer history</h2>
      {rows.length === 0 ? (
        <p className="empty">Nothing here yet. Select files and participants, then press SHARE.</p>
      ) : (
        <div className="table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th scope="col">File</th>
                <th scope="col">Recipients</th>
                <th scope="col">Progress</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const [label, tone] = ROW_STATUS[row.status] ?? ROW_STATUS.failed;
                const received = row.recipients.filter((r) => r.status === "completed").length;
                const pct = Math.round((row.uploadedChunks / row.totalChunks) * 100);
                const barTone = row.status === "completed" ? "ok" : row.status === "failed" || row.status === "aborted" ? "bad" : "";
                return (
                  <tr key={row.id}>
                    <td data-label="File">
                      <div className="cell">
                        <strong>{row.filename}</strong>
                        <div className="muted small">{formatBytes(row.size)}, shared at {formatTime(row.createdAt)}</div>
                      </div>
                    </td>
                    <td data-label="Recipients">
                      <ul className="cell recipient-list">
                        {row.recipients.map((r) => {
                          const [text, rTone] = recipientChip(r, row);
                          return (
                            <li key={r.participantId}>
                              <span>{r.name}</span>
                              <span className={`state state-${rTone}`} title={r.error || undefined}>{text}</span>
                              {r.status === "failed" && r.error && <span className="muted small">{r.error}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    </td>
                    <td data-label="Progress">
                      <div className="cell">
                        <div className={`progress ${barTone ? `progress-${barTone}` : ""}`} role="progressbar" aria-label={`Upload progress for ${row.filename}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                          <span style={{ width: `${pct}%` }} />
                        </div>
                        <span className="muted small">{progressCaption(row, received)}</span>
                      </div>
                    </td>
                    <td data-label="Status">
                      <div className="cell">
                        <span className={`state state-${tone}`}>{label}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

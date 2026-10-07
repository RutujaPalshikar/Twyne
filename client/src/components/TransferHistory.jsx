import { formatBytes, formatTime } from "../utils/format.js";

// Rows: { id, filename, size, createdAt, recipients: [{ name, status }] }
// Statuses come straight from the data. Nothing here is simulated: until the
// transfer engine exists, every row simply reads "Ready to send".
const LABELS = {
  pending: "Ready to send",
  transferring: "In progress",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};
const TONES = { pending: "ready", transferring: "active", completed: "done", failed: "failed", cancelled: "failed" };

function summarize(recipients) {
  if (recipients.length === 0) return "pending";
  if (recipients.some((r) => r.status === "failed")) return "failed";
  if (recipients.every((r) => r.status === "completed")) return "completed";
  if (recipients.every((r) => r.status === "cancelled")) return "cancelled";
  if (recipients.some((r) => r.status === "transferring")) return "transferring";
  return "pending";
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
                const status = summarize(row.recipients);
                const done = row.recipients.filter((r) => r.status === "completed").length;
                const pct = row.recipients.length ? Math.round((done / row.recipients.length) * 100) : 0;
                return (
                  <tr key={row.id}>
                    <td data-label="File">
                      <div className="cell">
                        <strong>{row.filename}</strong>
                        <div className="muted small">{formatBytes(row.size)}, added {formatTime(row.createdAt)}</div>
                      </div>
                    </td>
                    <td data-label="Recipients">
                      <div className="cell">{row.recipients.map((r) => r.name).join(", ") || "None"}</div>
                    </td>
                    <td data-label="Progress">
                      <div className="cell">
                        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                          <span style={{ width: `${pct}%` }} />
                        </div>
                        <span className="muted small">
                          {status === "pending" ? "Not started" : `${done} of ${row.recipients.length} received`}
                        </span>
                      </div>
                    </td>
                    <td data-label="Status">
                      <div className="cell">
                        <span className={`state state-${TONES[status]}`}>{LABELS[status]}</span>
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

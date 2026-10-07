import { useState } from "react";
import SelectTools from "./SelectTools.jsx";
import XButton from "./XButton.jsx";
import CopyButton from "./CopyButton.jsx";
import Notice from "./Notice.jsx";

function StatusBadge({ participant }) {
  if (participant.active) return <span className="status status-active">Active</span>;
  if (participant.joined) return <span className="status status-idle">Inactive</span>;
  return <span className="status status-waiting">Not joined yet</span>;
}

// Only ACTIVE participants can be ticked: inactive ones are disabled.
export default function ParticipantsPanel({
  participants, max, selectedIds, inviteText,
  onAdd, onToggle, onSelectAll, onDeselectAll, onRemove,
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const full = participants.length >= max;
  const activeCount = participants.filter((p) => p.active).length;

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    setAdding(true);
    try {
      await onAdd(name);
      setName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="people-heading">
      <div className="panel-title">
        <h2 id="people-heading">Participants</h2>
        <span className="count">{participants.length} of {max}</span>
      </div>

      <form onSubmit={handleAdd} className="inline-form">
        <label htmlFor="pname" className="sr-only">Participant name</label>
        <input
          id="pname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder={full ? "Room is full" : "Participant name"}
          autoComplete="off"
          disabled={full}
        />
        <button className="btn btn-primary" disabled={adding || full || !name.trim()}>
          {adding ? "Adding…" : "Add participant"}
        </button>
      </form>
      <Notice tone="error">{error}</Notice>

      {participants.length === 0 ? (
        <p className="empty">No participants yet. Add a name above and Twyne will generate an ID for that person.</p>
      ) : (
        <>
          <SelectTools
            selectedCount={selectedIds.size}
            selectableCount={activeCount}
            onSelectAll={onSelectAll}
            onDeselectAll={onDeselectAll}
          >
            {activeCount < participants.length && `, ${activeCount} active`}
          </SelectTools>
          <ul className="items">
            {participants.map((p) => (
              <li key={p.id}>
                <label className={`check ${p.active ? "" : "check-disabled"}`}>
                  <input
                    type="checkbox"
                    checked={p.active && selectedIds.has(p.id)}
                    disabled={!p.active}
                    onChange={() => onToggle(p.id)}
                  />
                  <span className="check-text">
                    <strong>{p.name}</strong>
                    <StatusBadge participant={p} />
                  </span>
                </label>
                <XButton label={`Remove ${p.name}`} onClick={() => onRemove(p)} />
                <div className="person-extra">
                  <div className="roster-id">
                    <span className="muted small">Participant ID</span>
                    <code>{p.participantId}</code>
                  </div>
                  <CopyButton text={inviteText(p)} label="Copy invite" />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

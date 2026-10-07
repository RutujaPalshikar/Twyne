import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useSession } from "../context/SessionContext.jsx";
import usePolling from "../hooks/usePolling.js";
import { DEFAULT_HEARTBEAT_INTERVAL_MS, DEFAULT_MAX_PARTICIPANTS } from "../config.js";
import { formatBytes, formatTime } from "../utils/format.js";
import CopyButton from "../components/CopyButton.jsx";
import Notice from "../components/Notice.jsx";
import FilePanelPlaceholder from "../components/FilePanelPlaceholder.jsx";

function StatusBadge({ participant }) {
  if (participant.active) return <span className="status status-active">Active</span>;
  if (participant.joined) return <span className="status status-idle">Inactive</span>;
  return <span className="status status-waiting">Not joined yet</span>;
}

// Guard: only the sender of THIS room may see the workspace.
export default function SenderRoom() {
  const { session } = useSession();
  const { roomCode } = useParams();
  if (!session || session.role !== "sender" || session.roomCode !== roomCode) {
    return <Navigate to="/" replace />;
  }
  return <SenderWorkspace session={session} />;
}

function SenderWorkspace({ session }) {
  const { endSession } = useSession();
  const [participants, setParticipants] = useState([]);
  const [history, setHistory] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [offline, setOffline] = useState(false);

  const max = session.config?.maxParticipants ?? DEFAULT_MAX_PARTICIPANTS;
  const pollMs = session.config?.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const full = participants.length >= max;

  async function load() {
    try {
      const [people, hist] = await Promise.all([api.listParticipants(session), api.getHistory(session)]);
      setParticipants(people.participants);
      setHistory(hist.history);
      setOffline(false);
    } catch (err) {
      if (err.status === 404 || err.status === 401) {
        endSession("Your room was closed. Its data was deleted.");
      } else {
        setOffline(true);
      }
    }
  }
  usePolling(load, pollMs);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    setAdding(true);
    try {
      await api.addParticipant(session, name);
      setName("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(p) {
    if (!window.confirm(`Remove ${p.name} from this room? Their ID will stop working.`)) return;
    try {
      await api.removeParticipant(session, p.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleClose() {
    if (!window.confirm("Close this room? Everyone is disconnected and the room's history is deleted.")) return;
    try {
      await api.closeRoom(session);
    } catch (err) {
      if (err.status !== 404) return setError(err.message);
    }
    endSession("Room closed. All of its temporary data was deleted.");
  }

  const inviteText = (p) =>
    `Join my Twyne room "${session.roomName}". Room code: ${session.roomCode}. Your name: ${p.name}. Participant ID: ${p.participantId}.`;

  return (
    <main className="container page">
      <header className="room-head">
        <div>
          <p className="muted small">Sender workspace</p>
          <h1>{session.roomName}</h1>
        </div>
        <div className="code-block">
          <span className="muted small">Room code</span>
          <strong className="room-code">{session.roomCode}</strong>
          <CopyButton text={session.roomCode} label="Copy code" />
        </div>
      </header>

      {offline && <Notice tone="info">Connection lost. Retrying… The room closes if you stay offline for about 15 seconds.</Notice>}

      <div className="workspace">
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
            <p className="empty">
              No participants yet. Add a name above and Twyne will generate an ID for that person.
            </p>
          ) : (
            <ul className="roster">
              {participants.map((p) => (
                <li key={p.id}>
                  <div className="roster-who">
                    <strong>{p.name}</strong>
                    <StatusBadge participant={p} />
                  </div>
                  <div className="roster-id">
                    <span className="muted small">Participant ID</span>
                    <code>{p.participantId}</code>
                  </div>
                  <div className="roster-actions">
                    <CopyButton text={inviteText(p)} label="Copy invite" />
                    <button type="button" className="btn btn-ghost btn-small btn-danger-text" onClick={() => handleRemove(p)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="side">
          <FilePanelPlaceholder>
            Sending files to selected participants arrives in the next stage.
          </FilePanelPlaceholder>

          <section className="panel" aria-labelledby="history-heading">
            <h2 id="history-heading">Transfer history</h2>
            {history.length === 0 ? (
              <p className="empty">Nothing has been sent yet.</p>
            ) : (
              <ul className="history">
                {history.map((h) => (
                  <li key={h.id}>
                    <strong>{h.filename}</strong>
                    <span className="muted small">
                      {formatBytes(h.size)}, sent to {h.recipients.length} at {formatTime(h.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel" aria-labelledby="close-heading">
            <h2 id="close-heading">Close room</h2>
            <p className="muted">
              Closing deletes the room, its participants and its history. Nobody can join it again.
            </p>
            <button type="button" className="btn btn-danger" onClick={handleClose}>Close room</button>
          </section>
        </div>
      </div>
    </main>
  );
}

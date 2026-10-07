import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useSession } from "../context/SessionContext.jsx";
import usePolling from "../hooks/usePolling.js";
import { DEFAULT_HEARTBEAT_INTERVAL_MS } from "../config.js";
import Notice from "../components/Notice.jsx";
import FilePanelPlaceholder from "../components/FilePanelPlaceholder.jsx";

// Guard: only a participant who joined THIS room may see it.
export default function ParticipantRoom() {
  const { session } = useSession();
  const { roomCode } = useParams();
  if (!session || session.role !== "participant" || session.roomCode !== roomCode) {
    return <Navigate to="/" replace />;
  }
  return <ParticipantWorkspace session={session} />;
}

function ParticipantWorkspace({ session }) {
  const { endSession } = useSession();
  const [people, setPeople] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const pollMs = session.config?.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;

  async function load() {
    try {
      const data = await api.getActiveParticipants(session);
      setPeople(data.participants);
      setLoaded(true);
      setOffline(false);
    } catch (err) {
      if (err.status === 404) endSession("This room was closed by the sender.");
      else if (err.status === 401) endSession("The sender removed you from this room.");
      else setOffline(true);
    }
  }
  usePolling(load, pollMs);

  async function handleLeave() {
    try {
      await api.leaveRoom(session);
    } catch {
      /* the room may already be gone; leaving locally is enough */
    }
    endSession("You left the room.");
  }

  return (
    <main className="container page">
      <header className="room-head">
        <div>
          <p className="muted small">Participant room</p>
          <h1>{session.roomName}</h1>
          <p className="muted">
            Room {session.roomCode}. You're connected as <strong>{session.participantName}</strong>.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={handleLeave}>Leave room</button>
      </header>

      {offline && <Notice tone="info">Connection lost. Retrying…</Notice>}

      <div className="workspace">
        <FilePanelPlaceholder>
          Files sent to you will appear here. Receiving files arrives in the next stage.
        </FilePanelPlaceholder>

        <section className="panel" aria-labelledby="here-heading">
          <div className="panel-title">
            <h2 id="here-heading">Connected now</h2>
            <span className="count">{loaded ? people.length : "…"}</span>
          </div>
          <p className="status status-active sender-line">The sender is online</p>
          {loaded && people.length === 0 ? (
            <p className="empty">Nobody is connected right now.</p>
          ) : (
            <ul className="history">
              {people.map((p) => (
                <li key={p.id}>
                  <strong>{p.name}{p.isYou ? " (you)" : ""}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

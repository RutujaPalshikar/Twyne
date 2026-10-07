import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useSession } from "../context/SessionContext.jsx";
import usePolling from "../hooks/usePolling.js";
import { DEFAULT_HEARTBEAT_INTERVAL_MS } from "../config.js";

// Guard: only a participant who joined THIS room may see it.
export default function ParticipantRoom() {
  const { session } = useSession();
  const { roomCode } = useParams();
  if (!session || session.role !== "participant" || session.roomCode !== roomCode) {
    return <Navigate to="/" replace />;
  }
  return <ParticipantWorkspace session={session} />;
}

// A participant sees only: the room name, their own name, connection status and an
// area for received files. No participant IDs, sender file list, history or controls.
function ParticipantWorkspace({ session }) {
  const { endSession } = useSession();
  const [connected, setConnected] = useState(true);
  const pollMs = session.config?.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;

  // Lightweight check that doubles as the connection indicator.
  async function check() {
    try {
      await api.getActiveParticipants(session);
      setConnected(true);
    } catch (err) {
      if (err.status === 404) endSession("This room was closed by the sender.");
      else if (err.status === 401) endSession("The sender removed you from this room.");
      else setConnected(false);
    }
  }
  usePolling(check, pollMs);

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
          <p className="muted">You're joined as <strong>{session.participantName}</strong>.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={handleLeave}>Leave room</button>
      </header>

      <div className="workspace">
        <section className="panel" aria-labelledby="status-heading">
          <h2 id="status-heading">Connection</h2>
          <p className={`status ${connected ? "status-active" : "status-idle"}`} role="status">
            {connected ? "Connected" : "Reconnecting…"}
          </p>
          <p className="muted small">
            {connected
              ? "You're online and the sender can see you. Keep this tab open to stay in the room."
              : "Can't reach the server. You'll leave the room if this lasts about 15 seconds."}
          </p>
        </section>

        <section className="panel panel-dashed" aria-labelledby="received-heading">
          <h2 id="received-heading">Received files</h2>
          <p className="empty">Files the sender shares with you will appear here. Receiving isn't available yet.</p>
        </section>
      </div>
    </main>
  );
}

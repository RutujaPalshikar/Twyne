import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useSession } from "../context/SessionContext.jsx";
import Notice from "../components/Notice.jsx";

export default function CreateRoom() {
  const { session, startSession } = useSession();
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api.createRoom(roomName);
      startSession({
        role: "sender",
        roomCode: data.room.roomCode,
        roomName: data.room.roomName,
        token: data.senderToken,
        config: data.config,
      });
      navigate(`/sender/${data.room.roomCode}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="container page narrow">
      <h1>Create a room</h1>
      <p className="lead-small">
        You'll be the sender. Give the room a name, then add the people who may join it.
      </p>

      {session && (
        <Notice tone="info">
          This tab is already in room {session.roomCode}. Creating a new room leaves it
          {session.role === "sender" ? ", and that room will close shortly after." : "."}
        </Notice>
      )}

      <form onSubmit={handleSubmit} className="form">
        <label htmlFor="roomName">Room name</label>
        <input
          id="roomName"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          maxLength={40}
          placeholder="Group project files"
          autoComplete="off"
          required
        />
        <Notice tone="error">{error}</Notice>
        <button className="btn btn-primary" disabled={busy || !roomName.trim()}>
          {busy ? "Creating…" : "Create room"}
        </button>
      </form>
    </main>
  );
}

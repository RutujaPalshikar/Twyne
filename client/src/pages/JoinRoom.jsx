import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useSession } from "../context/SessionContext.jsx";
import Notice from "../components/Notice.jsx";

export default function JoinRoom() {
  const { session, startSession } = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState("code"); // "code" -> "details"
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function checkCode(e) {
    e.preventDefault();
    setError("");
    if (!/^\d{4}$/.test(code)) return setError("Enter the 4-digit room code.");
    setBusy(true);
    try {
      await api.getRoomStatus(code);
      setStep("details");
    } catch (err) {
      setError(err.status === 404 ? "No open room has that code. Check it with the sender." : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function join(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api.joinRoom(code, name, participantId);
      startSession({
        role: "participant",
        roomCode: code,
        roomName: data.room.roomName,
        participantName: data.participant.name,
        token: data.participantToken,
        config: data.config,
      });
      navigate(`/room/${code}`);
    } catch (err) {
      if (err.status === 404) {
        setStep("code");
        setError("This room has closed.");
      } else {
        setError(err.message);
      }
      setBusy(false);
    }
  }

  return (
    <main className="container page narrow">
      <h1>Join a room</h1>
      <p className="lead-small">
        {step === "code"
          ? "Enter the room code the sender gave you."
          : `Room ${code} is open. Enter your name and participant ID exactly as the sender gave them.`}
      </p>

      {session && (
        <Notice tone="info">
          This tab is already in room {session.roomCode}. Joining another room leaves it.
        </Notice>
      )}

      {step === "code" ? (
        <form onSubmit={checkCode} className="form">
          <label htmlFor="roomCode">Room code</label>
          <input
            id="roomCode"
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            placeholder="0000"
            autoComplete="off"
            required
          />
          <Notice tone="error">{error}</Notice>
          <button className="btn btn-primary" disabled={busy || code.length !== 4}>
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>
      ) : (
        <form onSubmit={join} className="form">
          <label htmlFor="name">Your name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            autoComplete="off"
            required
          />
          <label htmlFor="participantId">Participant ID</label>
          <input
            id="participantId"
            className="id-input"
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value.toUpperCase().replace(/\s/g, ""))}
            maxLength={8}
            autoCapitalize="characters"
            spellCheck={false}
            autoComplete="off"
            required
          />
          <Notice tone="error">{error}</Notice>
          <button className="btn btn-primary" disabled={busy || !name.trim() || participantId.length !== 8}>
            {busy ? "Joining…" : "Join room"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setStep("code");
              setError("");
            }}
          >
            Use a different code
          </button>
        </form>
      )}
    </main>
  );
}

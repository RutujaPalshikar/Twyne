import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useSession } from "../context/SessionContext.jsx";
import usePolling from "../hooks/usePolling.js";
import { DEFAULT_HEARTBEAT_INTERVAL_MS, DEFAULT_MAX_PARTICIPANTS, MAX_FILES } from "../config.js";
import { formatBytes } from "../utils/format.js";
import CopyButton from "../components/CopyButton.jsx";
import Notice from "../components/Notice.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import FilesPanel from "../components/FilesPanel.jsx";
import ParticipantsPanel from "../components/ParticipantsPanel.jsx";
import TransferHistory from "../components/TransferHistory.jsx";

// crypto.randomUUID only exists on secure origins (https / localhost); phones testing over
// a plain-http LAN address need the fallback.
let counter = 0;
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `f${Date.now()}-${counter++}`);
const fileKey = (f) => `${f.name}|${f.size}|${f.lastModified}`;

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

  // Server data
  const [participants, setParticipants] = useState([]);
  const [history, setHistory] = useState([]);
  const [offline, setOffline] = useState(false);

  // Browser-memory files: [{ id, file }]. Selection is a Set of ids.
  const [files, setFiles] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState(() => new Set());
  const [selectedPeopleIds, setSelectedPeopleIds] = useState(() => new Set());
  const [fileError, setFileError] = useState("");

  // Dialogs and share results
  const [fileToRemove, setFileToRemove] = useState(null);
  const [personToRemove, setPersonToRemove] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [prepared, setPrepared] = useState([]); // shares confirmed in this tab (no transfer yet)
  const [shareNotice, setShareNotice] = useState("");
  const [roomError, setRoomError] = useState("");

  const max = session.config?.maxParticipants ?? DEFAULT_MAX_PARTICIPANTS;
  const pollMs = session.config?.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;

  async function load() {
    try {
      const [people, hist] = await Promise.all([api.listParticipants(session), api.getHistory(session)]);
      setParticipants(people.participants);
      setHistory(hist.history);
      setOffline(false);
    } catch (err) {
      if (err.status === 404 || err.status === 401) endSession("Your room was closed. Its data was deleted.");
      else setOffline(true);
    }
  }
  usePolling(load, pollMs);

  // A participant who goes inactive or is removed can no longer be selected.
  // Dropping them here also stops them from silently re-selecting if they come back.
  useEffect(() => {
    const selectable = new Set(participants.filter((p) => p.active).map((p) => p.id));
    setSelectedPeopleIds((prev) => {
      const next = new Set([...prev].filter((id) => selectable.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [participants]);

  // ---------- Files ----------
  function handlePick(e) {
    const picked = Array.from(e.target.files);
    e.target.value = ""; // lets the same file be chosen again later
    if (picked.length === 0) return;

    const known = new Set(files.map((f) => fileKey(f.file)));
    const fresh = [];
    let duplicates = 0;
    for (const file of picked) {
      const key = fileKey(file);
      if (known.has(key)) duplicates++;
      else {
        known.add(key);
        fresh.push({ id: newId(), file });
      }
    }
    const accepted = fresh.slice(0, MAX_FILES - files.length);
    const skipped = fresh.length - accepted.length;

    const notes = [];
    if (skipped) notes.push(`Only ${MAX_FILES} files are allowed, so ${skipped} ${skipped === 1 ? "file was" : "files were"} skipped.`);
    if (duplicates) notes.push(`${duplicates} already added ${duplicates === 1 ? "file was" : "files were"} ignored.`);
    setFileError(notes.join(" "));

    setFiles((prev) => [...prev, ...accepted]);
    setSelectedFileIds((prev) => new Set([...prev, ...accepted.map((f) => f.id)])); // new files start selected
  }

  function confirmRemoveFile() {
    const id = fileToRemove.id;
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setFileToRemove(null);
    setFileError("");
  }

  const toggle = (setter) => (id) =>
    setter((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ---------- Participants ----------
  async function addParticipant(name) {
    await api.addParticipant(session, name);
    await load();
  }

  async function confirmRemovePerson() {
    const person = personToRemove;
    setPersonToRemove(null);
    try {
      await api.removeParticipant(session, person.id);
      setSelectedPeopleIds((prev) => {
        const next = new Set(prev);
        next.delete(person.id);
        return next;
      });
      await load();
    } catch (err) {
      setRoomError(err.message);
    }
  }

  const inviteText = (p) =>
    `Join my Twyne room "${session.roomName}". Room code: ${session.roomCode}. Your name: ${p.name}. Participant ID: ${p.participantId}.`;

  // ---------- Share ----------
  // Effective selection = what is ticked AND still exists/active right now.
  const chosenFiles = files.filter((f) => selectedFileIds.has(f.id));
  const chosenPeople = participants.filter((p) => p.active && selectedPeopleIds.has(p.id));
  const canShare = chosenFiles.length > 0 && chosenPeople.length > 0;

  const problems = [];
  if (chosenFiles.length === 0) problems.push("Select at least one file.");
  if (chosenPeople.length === 0) problems.push("Select at least one active participant.");

  function confirmShare() {
    const now = new Date().toISOString();
    const rows = chosenFiles.map((f) => ({
      id: `${f.id}-${now}`,
      filename: f.file.name,
      size: f.file.size,
      createdAt: now,
      recipients: chosenPeople.map((p) => ({ name: p.name, status: "pending" })),
    }));
    setPrepared((prev) => [...rows, ...prev]);
    setShareOpen(false);
    setShareNotice(
      `Share confirmed: ${chosenFiles.length} ${chosenFiles.length === 1 ? "file" : "files"} for ${chosenPeople.length} ${
        chosenPeople.length === 1 ? "participant" : "participants"
      }. Sending isn't available yet, so they are listed as Ready to send.`
    );
  }

  // ---------- Close room ----------
  async function handleClose() {
    if (!window.confirm("Close this room? Everyone is disconnected and the room's history is deleted.")) return;
    try {
      await api.closeRoom(session);
    } catch (err) {
      if (err.status !== 404) return setRoomError(err.message);
    }
    endSession("Room closed. All of its temporary data was deleted.");
  }

  const historyRows = [
    ...prepared,
    ...history.map((h) => ({
      id: h.id,
      filename: h.filename,
      size: h.size,
      createdAt: h.createdAt,
      recipients: h.recipients.map((r) => ({ name: r.participantName, status: r.status })),
    })),
  ];

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
      <Notice tone="error" onDismiss={roomError ? () => setRoomError("") : undefined}>{roomError}</Notice>

      <div className="panels-2">
        <FilesPanel
          files={files}
          selectedIds={selectedFileIds}
          max={MAX_FILES}
          error={fileError}
          onPick={handlePick}
          onToggle={toggle(setSelectedFileIds)}
          onSelectAll={() => setSelectedFileIds(new Set(files.map((f) => f.id)))}
          onDeselectAll={() => setSelectedFileIds(new Set())}
          onRemove={setFileToRemove}
        />
        <ParticipantsPanel
          participants={participants}
          max={max}
          selectedIds={new Set(chosenPeople.map((p) => p.id))}
          inviteText={inviteText}
          onAdd={addParticipant}
          onToggle={toggle(setSelectedPeopleIds)}
          onSelectAll={() => setSelectedPeopleIds(new Set(participants.filter((p) => p.active).map((p) => p.id)))}
          onDeselectAll={() => setSelectedPeopleIds(new Set())}
          onRemove={setPersonToRemove}
        />
      </div>

      <div className="share-bar">
        <div>
          <p className="share-summary">
            {chosenFiles.length} {chosenFiles.length === 1 ? "file" : "files"} for {chosenPeople.length}{" "}
            {chosenPeople.length === 1 ? "participant" : "participants"}
          </p>
          {problems.length > 0 && (
            <p className="share-hint" id="share-problems">{problems.join(" ")}</p>
          )}
        </div>
        <button
          type="button"
          className="btn btn-share"
          disabled={!canShare}
          aria-describedby={problems.length ? "share-problems" : undefined}
          onClick={() => setShareOpen(true)}
        >
          SHARE
        </button>
      </div>
      <Notice tone="info" onDismiss={shareNotice ? () => setShareNotice("") : undefined}>{shareNotice}</Notice>

      <TransferHistory rows={historyRows} />

      <section className="panel panel-close" aria-labelledby="close-heading">
        <h2 id="close-heading">Close room</h2>
        <p className="muted">Closing deletes the room, its participants and its history. Nobody can join it again.</p>
        <button type="button" className="btn btn-danger" onClick={handleClose}>Close room</button>
      </section>

      {fileToRemove && (
        <ConfirmDialog
          title="Do you want to remove the file?"
          tone="danger"
          confirmLabel="Remove"
          onConfirm={confirmRemoveFile}
          onCancel={() => setFileToRemove(null)}
        >
          <p className="dialog-detail"><strong>{fileToRemove.file.name}</strong> ({formatBytes(fileToRemove.file.size)})</p>
        </ConfirmDialog>
      )}

      {personToRemove && (
        <ConfirmDialog
          title="Do you want to remove the participant?"
          tone="danger"
          confirmLabel="Remove"
          onConfirm={confirmRemovePerson}
          onCancel={() => setPersonToRemove(null)}
        >
          <p className="dialog-detail"><strong>{personToRemove.name}</strong> will lose access and their ID will stop working.</p>
        </ConfirmDialog>
      )}

      {shareOpen && canShare && (
        <ConfirmDialog
          title="Share these files?"
          confirmLabel="Confirm share"
          onConfirm={confirmShare}
          onCancel={() => setShareOpen(false)}
        >
          <p className="muted">
            Each file below goes to each participant listed: {chosenFiles.length} × {chosenPeople.length} ={" "}
            {chosenFiles.length * chosenPeople.length} transfers.
          </p>
          <div className="share-map">
            <div>
              <h3>Files</h3>
              <ul>
                {chosenFiles.map((f) => (
                  <li key={f.id}>{f.file.name} <span className="muted small">({formatBytes(f.file.size)})</span></li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Participants</h3>
              <ul className="chips">
                {chosenPeople.map((p) => <li key={p.id} className="chip">{p.name}</li>)}
              </ul>
            </div>
          </div>
        </ConfirmDialog>
      )}
    </main>
  );
}

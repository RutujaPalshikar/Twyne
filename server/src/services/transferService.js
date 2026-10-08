import crypto from "node:crypto";
import mongoose from "mongoose";
import Transfer from "../models/Transfer.js";
import Participant from "../models/Participant.js";
import {
  CHUNK_SIZE_BYTES,
  RECEIVER_IDLE_TIMEOUT_MS,
  SENDER_STALL_TIMEOUT_MS,
  TRANSFER_SWEEP_INTERVAL_MS,
} from "../config/constants.js";
import { isFresh } from "../utils/presence.js";

// ---------------------------------------------------------------------------
// Live transfer state. This is the ONLY place file bytes ever exist on the server,
// and only for chunks that some active receiver has not acknowledged yet.
//
//   live: transferId -> {
//     id, roomId, fileId, filename, mimeType, size, chunkSize, totalChunks,
//     status, order, createdAt, queuedAt, seq, lastSenderActivity,
//     uploadedCount,                 // chunks received from the sender so far
//     chunks: Map<index, Buffer>,    // un-acked chunks only
//     recipients: Map<participantId, { participantId, name, acked, status, error, updatedAt }>
//   }
// ---------------------------------------------------------------------------
const live = new Map();
const lastPoll = new Map(); // "roomId:participantId" -> last time that receiver talked to us
let orderCounter = 0;

const isDone = (r) => r.status === "completed" || r.status === "failed";
const pollKey = (roomId, pid) => `${roomId}:${pid}`;

export const getLive = (roomId, transferId) => {
  const state = live.get(transferId);
  return state && state.roomId === roomId ? state : null;
};

export const chunkLength = (state, index) =>
  index === state.totalChunks - 1 ? state.size - index * state.chunkSize : state.chunkSize;

// Lowest "chunks acknowledged" count among receivers still being served.
export function minAcked(state) {
  let min = Infinity;
  for (const r of state.recipients.values()) if (!isDone(r)) min = Math.min(min, r.acked);
  return min === Infinity ? state.totalChunks : min;
}

// Drop every chunk that all remaining receivers already have.
function freeChunks(state) {
  const floor = minAcked(state);
  for (const index of state.chunks.keys()) if (index < floor) state.chunks.delete(index);
}

// ---------- Persistence: metadata snapshots only ----------
function snapshot(state) {
  return {
    status: state.status,
    uploadedChunks: state.uploadedCount,
    recipients: [...state.recipients.values()].map((r) => ({
      participant: r.participantId,
      participantName: r.name,
      status: r.status,
      ackedChunks: r.acked,
      error: r.error,
      updatedAt: new Date(r.updatedAt),
    })),
  };
}

// Snapshots are written one at a time per transfer so an older one can't overwrite a newer one.
export function persist(state) {
  state.persistChain = state.persistChain
    .then(() => Transfer.updateOne({ _id: state.id }, { $set: snapshot(state) }))
    .catch((err) => console.error("Could not save transfer metadata:", err.message));
  return state.persistChain;
}

// ---------- State changes ----------
function finishIfDone(state) {
  if (state.finished) return;
  const recipients = [...state.recipients.values()];
  if (recipients.some((r) => !isDone(r))) return;

  const completed = recipients.filter((r) => r.status === "completed").length;
  state.status =
    completed === recipients.length ? "completed" : completed > 0 ? "partial" : state.aborted ? "aborted" : "failed";
  state.finished = true;
  state.chunks.clear(); // nothing left to deliver: release all memory
  // Keep the (chunk-free) state visible until its final metadata is saved, then forget it.
  persist(state).then(() => live.delete(state.id));
}

export function failRecipient(state, participantId, reason) {
  const r = state.recipients.get(participantId);
  if (!r || isDone(r)) return;
  r.status = "failed";
  r.error = reason;
  r.updatedAt = Date.now();
  freeChunks(state);
  persist(state);
  finishIfDone(state);
}

export function abortTransfer(state, reason) {
  state.aborted = true;
  for (const r of state.recipients.values()) {
    if (!isDone(r)) {
      r.status = "failed";
      r.error = reason;
      r.updatedAt = Date.now();
    }
  }
  finishIfDone(state);
}

export function storeChunk(state, index, buffer) {
  state.chunks.set(index, buffer);
  state.uploadedCount += 1;
  state.lastSenderActivity = Date.now();
  if (state.status === "queued") {
    state.status = "uploading";
    persist(state);
  }
}

// Receiver confirms it has chunk `index`. Idempotent for already-acknowledged chunks.
export function ackChunk(state, participantId, index) {
  const r = state.recipients.get(participantId);
  if (index < r.acked) return r;
  r.acked += 1;
  r.updatedAt = Date.now();
  if (r.acked === state.totalChunks) {
    r.status = "completed";
    persist(state);
  } else {
    r.status = "transferring";
  }
  freeChunks(state);
  finishIfDone(state);
  return r;
}

export function touchReceiver(roomId, participantId) {
  lastPoll.set(pollKey(roomId, participantId), Date.now());
}

// ---------- Creating transfers ----------
export async function createTransfers({ room, files, participants }) {
  const roomId = String(room._id);
  const batchId = crypto.randomUUID();
  const queuedAt = new Date();
  const created = [];

  for (let seq = 0; seq < files.length; seq++) {
    const f = files[seq];
    const totalChunks = Math.ceil(f.size / CHUNK_SIZE_BYTES);
    const doc = await Transfer.create({
      room: room._id,
      fileId: crypto.randomUUID(),
      filename: f.name,
      mimeType: f.mimeType,
      size: f.size,
      chunkSize: CHUNK_SIZE_BYTES,
      totalChunks,
      status: "queued",
      batchId,
      seq,
      queuedAt,
      recipients: participants.map((p) => ({ participant: p._id, participantName: p.name, status: "pending" })),
    });

    const state = {
      id: String(doc._id),
      roomId,
      fileId: doc.fileId,
      filename: f.name,
      mimeType: f.mimeType,
      size: f.size,
      chunkSize: CHUNK_SIZE_BYTES,
      totalChunks,
      status: "queued",
      order: ++orderCounter,
      createdAt: Date.now(),
      queuedAt,
      seq,
      lastSenderActivity: Date.now(),
      uploadedCount: 0,
      chunks: new Map(),
      finished: false,
      aborted: false,
      persistChain: Promise.resolve(),
      recipients: new Map(
        participants.map((p) => [
          String(p._id),
          { participantId: String(p._id), name: p.name, acked: 0, status: "pending", error: null, updatedAt: Date.now() },
        ])
      ),
    };
    live.set(state.id, state);
    for (const p of participants) touchReceiver(roomId, String(p._id));
    created.push({ id: state.id, fileId: state.fileId, filename: f.name, size: f.size, totalChunks, chunkSize: CHUNK_SIZE_BYTES });
  }
  return created;
}

export const countUnfinished = (roomId) =>
  [...live.values()].filter((s) => s.roomId === roomId && !s.finished).length;

// ---------- Reading state ----------
const serialize = (state) => ({
  id: state.id,
  fileId: state.fileId,
  filename: state.filename,
  size: state.size,
  status: state.status,
  totalChunks: state.totalChunks,
  chunkSize: state.chunkSize,
  uploadedChunks: state.uploadedCount,
  createdAt: state.queuedAt,
  seq: state.seq,
  recipients: [...state.recipients.values()].map((r) => ({
    participantId: r.participantId,
    name: r.name,
    status: r.status,
    ackedChunks: r.acked,
    error: r.error,
  })),
});

// A saved transfer that is not in memory and never finished was interrupted (e.g. server restart).
function fromDoc(doc) {
  const interrupted = doc.status === "queued" || doc.status === "uploading";
  return {
    id: String(doc._id),
    fileId: doc.fileId,
    filename: doc.filename,
    size: doc.size,
    status: interrupted ? "aborted" : doc.status,
    totalChunks: doc.totalChunks,
    chunkSize: doc.chunkSize,
    uploadedChunks: doc.uploadedChunks,
    createdAt: doc.queuedAt,
    seq: doc.seq,
    recipients: doc.recipients.map((r) => ({
      participantId: String(r.participant),
      name: r.participantName,
      status: interrupted && r.status !== "completed" ? "failed" : r.status,
      ackedChunks: r.ackedChunks ?? 0,
      error: interrupted && r.status !== "completed" ? "Transfer interrupted" : r.error,
    })),
  };
}

// Sender's history: live in-memory state wins over the saved snapshot.
export async function historyForRoom(roomId) {
  const docs = await Transfer.find({ room: roomId }).lean();
  const rows = docs.map((d) => {
    const state = getLive(String(roomId), String(d._id));
    return state ? serialize(state) : fromDoc(d);
  });
  return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || a.seq - b.seq);
}

// What a receiver may fetch: only transfers it is a recipient of and has not finished.
export function incomingFor(roomId, participantId) {
  touchReceiver(roomId, participantId);
  return [...live.values()]
    .filter((s) => s.roomId === roomId && !s.finished && s.recipients.has(participantId) && !isDone(s.recipients.get(participantId)))
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      id: s.id,
      filename: s.filename,
      mimeType: s.mimeType,
      size: s.size,
      chunkSize: s.chunkSize,
      totalChunks: s.totalChunks,
    }));
}

export function failParticipant(roomId, participantId, reason) {
  for (const state of live.values()) {
    if (state.roomId === roomId) failRecipient(state, participantId, reason);
  }
}

// Room closed (or sender inactive): forget everything, chunks included.
export function dropRoom(roomId) {
  for (const [id, state] of live) {
    if (state.roomId === roomId) {
      state.finished = true;
      state.chunks.clear();
      live.delete(id);
    }
  }
  for (const key of lastPoll.keys()) if (key.startsWith(`${roomId}:`)) lastPoll.delete(key);
}

export function stats() {
  let bufferedBytes = 0;
  let active = 0;
  for (const s of live.values()) {
    if (!s.finished) active++;
    for (const c of s.chunks.values()) bufferedBytes += c.length;
  }
  return { activeTransfers: active, bufferedBytes };
}

// ---------- Background checks ----------
// Runs every couple of seconds: stalled senders abort their file; receivers that
// disconnected, were removed or stopped polling are failed individually.
export async function sweepTransfers() {
  const now = Date.now();
  const watched = new Set();

  for (const state of [...live.values()]) {
    if (state.finished) continue;
    if (state.uploadedCount < state.totalChunks && now - state.lastSenderActivity > SENDER_STALL_TIMEOUT_MS) {
      abortTransfer(state, "The sender stopped sending");
      continue;
    }
    for (const r of state.recipients.values()) if (!isDone(r)) watched.add(r.participantId);
  }

  if (watched.size === 0) {
    lastPoll.clear();
    return;
  }

  const docs = await Participant.find({ _id: { $in: [...watched] } }).select("lastSeen isActive");
  const byId = new Map(docs.map((d) => [String(d._id), d]));

  for (const state of [...live.values()]) {
    if (state.finished) continue;
    for (const r of [...state.recipients.values()]) {
      if (isDone(r)) continue;
      const person = byId.get(r.participantId);
      const polled = lastPoll.get(pollKey(state.roomId, r.participantId)) ?? state.createdAt;
      if (!person) failRecipient(state, r.participantId, "Removed from the room");
      else if (!(person.isActive && isFresh(person.lastSeen))) failRecipient(state, r.participantId, "Disconnected");
      else if (now - polled > RECEIVER_IDLE_TIMEOUT_MS) failRecipient(state, r.participantId, "Disconnected");
    }
  }
}

export function startTransferSweeper() {
  const timer = setInterval(() => {
    sweepTransfers().catch((err) => console.error("Transfer sweep failed:", err));
  }, TRANSFER_SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}

// After a server restart nothing is in memory: mark unfinished saved transfers as aborted.
export async function markInterruptedTransfers() {
  await Transfer.updateMany({ status: { $in: ["queued", "uploading"] } }, { $set: { status: "aborted" } });
}

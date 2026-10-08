import express from "express";
import mongoose from "mongoose";
import Participant from "../models/Participant.js";
import {
  BUFFER_WINDOW_CHUNKS,
  CHUNK_SIZE_BYTES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_SHARE,
  MAX_PARTICIPANTS,
  MAX_UNFINISHED_TRANSFERS,
} from "../config/constants.js";
import { HttpError } from "../utils/httpError.js";
import { cleanString } from "../utils/validate.js";
import { isFresh } from "../utils/presence.js";
import * as transfers from "../services/transferService.js";

const bad = (message, code = "VALIDATION") => new HttpError(400, message, code);
const gone = () => new HttpError(410, "This transfer is no longer active.", "TRANSFER_CLOSED");
const mb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;

// Sender chunks arrive as raw bytes. The limit is one chunk, so oversized bodies are refused.
export const rawChunkParser = express.raw({ type: "application/octet-stream", limit: CHUNK_SIZE_BYTES });

const roomIdOf = (req) => String(req.room._id);

// Transfer must belong to THIS room (the room code in the URL was already validated).
function transferOr404(req) {
  const state = transfers.getLive(roomIdOf(req), req.params.transferId);
  if (!state) throw new HttpError(404, "Transfer not found.", "TRANSFER_NOT_FOUND");
  return state;
}

function parseIndex(raw, state) {
  if (!/^\d+$/.test(raw) || Number(raw) >= state.totalChunks) throw bad("Invalid chunk number.", "BAD_INDEX");
  return Number(raw);
}

// ===================== Sender =====================

// POST /transfers  { files: [{name,size,type}], participantIds: [...] }
// Validates every limit BEFORE any data is sent, then registers one transfer per file.
export async function createTransfers(req, res) {
  const { files, participantIds } = req.body ?? {};

  if (!Array.isArray(files) || files.length === 0) throw bad("Choose at least one file.");
  if (files.length > MAX_FILES_PER_SHARE) throw bad(`You can share at most ${MAX_FILES_PER_SHARE} files at a time.`, "TOO_MANY_FILES");

  const cleanFiles = files.map((f) => {
    const name = cleanString(f?.name, 255, "File name");
    if (!Number.isInteger(f?.size) || f.size <= 0) throw bad(`${name} is empty or has an invalid size.`, "BAD_SIZE");
    if (f.size > MAX_FILE_SIZE_BYTES) {
      throw new HttpError(413, `${name} is larger than the ${mb(MAX_FILE_SIZE_BYTES)} MB limit.`, "FILE_TOO_LARGE");
    }
    return { name, size: f.size, mimeType: typeof f.type === "string" ? f.type.slice(0, 100) : "" };
  });

  if (!Array.isArray(participantIds) || participantIds.length === 0) throw bad("Select at least one participant.");
  if (participantIds.length > MAX_PARTICIPANTS) throw bad("Too many participants selected.");
  if (!participantIds.every((id) => typeof id === "string" && mongoose.isValidObjectId(id))) {
    throw bad("Invalid participant selection.");
  }
  const ids = [...new Set(participantIds)];

  const participants = await Participant.find({ room: req.room._id, _id: { $in: ids } });
  if (participants.length !== ids.length) throw bad("A selected participant is not in this room.", "UNKNOWN_PARTICIPANT");

  // Only active participants can receive files.
  const inactive = participants.filter((p) => !(p.isActive && isFresh(p.lastSeen)));
  if (inactive.length > 0) {
    throw new HttpError(
      409,
      `${inactive.map((p) => p.name).join(", ")} ${inactive.length === 1 ? "is" : "are"} not active right now.`,
      "PARTICIPANT_INACTIVE"
    );
  }

  if (transfers.countUnfinished(roomIdOf(req)) + cleanFiles.length > MAX_UNFINISHED_TRANSFERS) {
    throw new HttpError(429, "Too many files are still being sent. Wait for some to finish.", "TOO_MANY_TRANSFERS");
  }

  const created = await transfers.createTransfers({ room: req.room, files: cleanFiles, participants });
  res.status(201).json({ transfers: created, chunkSize: CHUNK_SIZE_BYTES });
}

// Runs BEFORE the body is read, so a rejected chunk costs no bandwidth.
export function uploadGate(req, res, next) {
  const state = transferOr404(req);
  if (state.finished) throw gone();
  const index = parseIndex(req.params.index, state);
  state.lastSenderActivity = Date.now();

  // A retry of a chunk we already have: accept without storing again.
  if (index < state.uploadedCount) {
    return res.json({ ok: true, duplicate: true, uploadedChunks: state.uploadedCount, minAcked: transfers.minAcked(state) });
  }
  if (index > state.uploadedCount) throw new HttpError(409, "Chunks must be sent in order.", "OUT_OF_ORDER");
  // Flow control: don't run further ahead of the slowest receiver than the window allows.
  if (index >= transfers.minAcked(state) + BUFFER_WINDOW_CHUNKS) {
    throw new HttpError(429, "Receivers are still catching up. Retry shortly.", "BUFFER_FULL");
  }
  req.transferState = state;
  req.chunkIndex = index;
  next();
}

// PUT /transfers/:transferId/chunks/:index  (raw bytes)
export function uploadChunk(req, res) {
  const state = req.transferState;
  const index = req.chunkIndex;
  if (state.finished) throw gone();
  if (!Buffer.isBuffer(req.body) || req.body.length !== transfers.chunkLength(state, index)) {
    throw bad("Chunk has the wrong size.", "BAD_CHUNK");
  }
  if (index === state.uploadedCount) transfers.storeChunk(state, index, req.body);
  res.json({ ok: true, uploadedChunks: state.uploadedCount, minAcked: transfers.minAcked(state) });
}

// GET /transfers/:transferId/state  (cheap poll used by the sender while waiting on the window)
export function getUploadState(req, res) {
  const state = transfers.getLive(roomIdOf(req), req.params.transferId);
  if (!state || state.finished) return res.json({ closed: true });
  state.lastSenderActivity = Date.now();
  res.json({ closed: false, uploadedChunks: state.uploadedCount, minAcked: transfers.minAcked(state) });
}

// POST /transfers/:transferId/abort
export function abort(req, res) {
  const state = transfers.getLive(roomIdOf(req), req.params.transferId);
  if (state) transfers.abortTransfer(state, "Cancelled by the sender");
  res.json({ aborted: Boolean(state) });
}

// ===================== Receiver (participant) =====================

// GET /transfers/incoming
export function getIncoming(req, res) {
  res.json({ transfers: transfers.incomingFor(roomIdOf(req), String(req.participant._id)) });
}

function recipientOr404(req) {
  const state = transferOr404(req);
  const recipient = state.recipients.get(String(req.participant._id));
  if (!recipient) throw new HttpError(404, "Transfer not found.", "TRANSFER_NOT_FOUND"); // not addressed to you
  transfers.touchReceiver(roomIdOf(req), String(req.participant._id));
  return { state, recipient };
}

// GET /transfers/:transferId/chunks/:index
// Receivers must fetch strictly in order. 204 means "not uploaded yet, poll again".
export function getChunk(req, res) {
  const { state, recipient } = recipientOr404(req);
  if (recipient.status === "failed") throw new HttpError(410, "Delivery to you was stopped.", "RECIPIENT_FAILED");
  if (recipient.status === "completed") throw new HttpError(409, "You already received this file.", "ALREADY_DONE");
  const index = parseIndex(req.params.index, state);
  if (index !== recipient.acked) throw new HttpError(409, "Chunks must be fetched in order.", "OUT_OF_ORDER");
  if (index >= state.uploadedCount) return res.status(204).end();

  const chunk = state.chunks.get(index);
  if (!chunk) throw gone();
  if (recipient.status === "pending") recipient.status = "transferring";
  res.set({ "Content-Type": "application/octet-stream", "Cache-Control": "no-store" });
  res.send(chunk);
}

// POST /transfers/:transferId/ack  { index }
export function ack(req, res) {
  const { state, recipient } = recipientOr404(req);
  const index = req.body?.index;
  if (!Number.isInteger(index) || index < 0 || index >= state.totalChunks) throw bad("Invalid chunk number.", "BAD_INDEX");
  if (recipient.status === "failed") throw new HttpError(410, "Delivery to you was stopped.", "RECIPIENT_FAILED");
  if (index > recipient.acked) throw new HttpError(409, "Chunks must be acknowledged in order.", "OUT_OF_ORDER");
  if (index >= state.uploadedCount) throw new HttpError(409, "That chunk has not been uploaded yet.", "NOT_UPLOADED");
  const r = recipient.status === "completed" ? recipient : transfers.ackChunk(state, recipient.participantId, index);
  res.json({ ok: true, acked: r.acked, done: r.status === "completed" });
}

// POST /transfers/:transferId/fail  { reason }   (receiver gave up)
export function failMine(req, res) {
  const { state, recipient } = recipientOr404(req);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 100) : "Receiver error";
  transfers.failRecipient(state, recipient.participantId, reason);
  res.json({ ok: true });
}

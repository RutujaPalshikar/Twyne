import Room from "../models/Room.js";
import Participant from "../models/Participant.js";
import { ROOM_NAME_MAX, PARTICIPANT_NAME_MAX, clientConfig } from "../config/constants.js";
import { generateRoomCode, generateSessionToken } from "../utils/ids.js";
import { cleanString, isString } from "../utils/validate.js";
import { HttpError } from "../utils/httpError.js";
import { isFresh } from "../utils/presence.js";
import { closeRoom } from "../services/roomService.js";
import { failParticipant, historyForRoom } from "../services/transferService.js";

// POST /api/rooms  { roomName }
export async function createRoom(req, res) {
  const roomName = cleanString(req.body?.roomName, ROOM_NAME_MAX, "Room name");
  const senderToken = generateSessionToken();

  let room = null;
  for (let attempt = 0; attempt < 10 && !room; attempt++) {
    try {
      room = await Room.create({
        roomName,
        roomCode: generateRoomCode(),
        senderSessionToken: senderToken,
        senderLastSeen: new Date(),
      });
    } catch (err) {
      if (err.code !== 11000) throw err; // duplicate roomCode: try another code
    }
  }
  if (!room) throw new HttpError(503, "Could not find a free room code. Try again.", "NO_CODE");

  res.status(201).json({
    room: { roomCode: room.roomCode, roomName: room.roomName, createdAt: room.createdAt },
    senderToken,
    config: clientConfig(),
  });
}

// GET /api/rooms/:roomCode/status  (public; loadRoom already proved it is open)
export function getRoomStatus(req, res) {
  res.json({ active: true });
}

// POST /api/rooms/:roomCode/join  { name, participantId }
export async function joinRoom(req, res) {
  const name = cleanString(req.body?.name, PARTICIPANT_NAME_MAX, "Name");
  const participantId = req.body?.participantId;
  if (!isString(participantId)) throw new HttpError(400, "Participant ID is required.", "VALIDATION");

  // Both values must match one participant created by the sender, exactly.
  const participant = await Participant.findOne({
    room: req.room._id,
    name,
    participantId: participantId.trim(),
  });
  if (!participant) {
    throw new HttpError(403, "Access denied. Check your name and participant ID.", "ACCESS_DENIED");
  }
  if (participant.isActive && isFresh(participant.lastSeen)) {
    throw new HttpError(409, "This participant ID is already in use in an active session.", "ALREADY_ACTIVE");
  }

  const participantToken = generateSessionToken();
  participant.sessionToken = participantToken;
  participant.lastSeen = new Date();
  participant.isActive = true;
  await participant.save();

  res.json({
    participantToken,
    participant: { id: participant._id, name: participant.name },
    room: { roomCode: req.room.roomCode, roomName: req.room.roomName },
    config: clientConfig(),
  });
}

// POST /api/rooms/:roomCode/sender/heartbeat
export async function senderHeartbeat(req, res) {
  await Room.updateOne({ _id: req.room._id }, { senderLastSeen: new Date() });
  res.json({ ok: true });
}

// POST /api/rooms/:roomCode/participant/heartbeat
export async function participantHeartbeat(req, res) {
  await Participant.updateOne(
    { _id: req.participant._id },
    { lastSeen: new Date(), isActive: true }
  );
  res.json({ ok: true, senderActive: true });
}

// POST /api/rooms/:roomCode/participant/leave
export async function leaveRoom(req, res) {
  await Participant.updateOne(
    { _id: req.participant._id },
    { isActive: false, sessionToken: null }
  );
  failParticipant(String(req.room._id), String(req.participant._id), "Left the room");
  res.json({ left: true });
}

// GET /api/rooms/:roomCode/history  (sender only): live progress merged with saved metadata
export async function getHistory(req, res) {
  res.json({ history: await historyForRoom(req.room._id) });
}

// DELETE /api/rooms/:roomCode  (sender only)
export async function closeRoomHandler(req, res) {
  await closeRoom(req.room._id);
  res.json({ closed: true });
}

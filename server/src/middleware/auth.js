import Room from "../models/Room.js";
import Participant from "../models/Participant.js";
import { tokensMatch } from "../utils/ids.js";
import { HttpError, roomClosed } from "../utils/httpError.js";
import { isFresh } from "../utils/presence.js";
import { closeRoom } from "../services/roomService.js";

const invalidSession = () =>
  new HttpError(
    401,
    "Your session is not valid for this room.",
    "INVALID_SESSION",
  );

function bearerToken(req) {
  const match = (req.get("authorization") || "").match(/^Bearer (.+)$/i);
  return match ? match[1] : null;
}

export async function loadRoom(req, res, next) {
  const { roomCode } = req.params;
  if (!/^\d{4}$/.test(roomCode)) throw roomClosed();

  const room = await Room.findOne({ roomCode, isActive: true }).select(
    "+senderSessionToken",
  );
  if (!room) throw roomClosed();

  if (!isFresh(room.senderLastSeen)) {
    await closeRoom(room._id);
    throw roomClosed();
  }
  req.room = room;
  next();
}

export function requireSender(req, res, next) {
  const token = bearerToken(req);
  if (!token || !tokensMatch(token, req.room.senderSessionToken))
    throw invalidSession();
  req.role = "sender";
  next();
}

async function findParticipantByToken(req) {
  const token = bearerToken(req);
  if (!token) return null;
  return Participant.findOne({ room: req.room._id, sessionToken: token });
}

export async function requireParticipant(req, res, next) {
  const participant = await findParticipantByToken(req);
  if (!participant) throw invalidSession();
  req.role = "participant";
  req.participant = participant;
  next();
}

export async function requireMember(req, res, next) {
  const token = bearerToken(req);
  if (token && tokensMatch(token, req.room.senderSessionToken)) {
    req.role = "sender";
    return next();
  }
  const participant = await findParticipantByToken(req);
  if (!participant) throw invalidSession();
  req.role = "participant";
  req.participant = participant;
  next();
}

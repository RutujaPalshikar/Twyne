import mongoose from "mongoose";
import Participant from "../models/Participant.js";
import { MAX_PARTICIPANTS, PARTICIPANT_NAME_MAX } from "../config/constants.js";
import { generateParticipantId } from "../utils/ids.js";
import { cleanString } from "../utils/validate.js";
import { HttpError } from "../utils/httpError.js";
import { activeCutoff, isFresh } from "../utils/presence.js";
import { failParticipant } from "../services/transferService.js";

const senderView = (p) => ({
  id: p._id,
  name: p.name,
  participantId: p.participantId,
  joined: Boolean(p.lastSeen),
  active: p.isActive && isFresh(p.lastSeen),
  lastSeen: p.lastSeen,
  createdAt: p.createdAt,
});

export async function listParticipants(req, res) {
  const participants = await Participant.find({ room: req.room._id }).sort({
    createdAt: 1,
  });
  res.json({
    participants: participants.map(senderView),
    max: MAX_PARTICIPANTS,
  });
}

export async function addParticipant(req, res) {
  const name = cleanString(
    req.body?.name,
    PARTICIPANT_NAME_MAX,
    "Participant name",
  );

  const existing = await Participant.find({ room: req.room._id }).select(
    "name",
  );
  if (existing.length >= MAX_PARTICIPANTS) {
    throw new HttpError(
      409,
      `A room can have at most ${MAX_PARTICIPANTS} participants.`,
      "ROOM_FULL",
    );
  }
  if (existing.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new HttpError(
      409,
      "Someone in this room already has that name.",
      "DUPLICATE_NAME",
    );
  }

  let participant = null;
  for (let attempt = 0; attempt < 5 && !participant; attempt++) {
    try {
      participant = await Participant.create({
        room: req.room._id,
        name,
        participantId: generateParticipantId(),
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  if (!participant)
    throw new HttpError(
      503,
      "Could not generate a participant ID. Try again.",
      "NO_ID",
    );

  res.status(201).json({ participant: senderView(participant) });
}

export async function removeParticipant(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id))
    throw new HttpError(404, "Participant not found.", "NOT_FOUND");
  const result = await Participant.deleteOne({ _id: id, room: req.room._id });
  if (result.deletedCount === 0)
    throw new HttpError(404, "Participant not found.", "NOT_FOUND");
  failParticipant(String(req.room._id), id, "Removed from the room");
  res.json({ removed: true });
}

export async function getActiveParticipants(req, res) {
  const participants = await Participant.find({
    room: req.room._id,
    isActive: true,
    lastSeen: { $gte: activeCutoff() },
  }).sort({ createdAt: 1 });

  res.json({
    senderActive: true,
    participants: participants.map((p) => ({
      id: p._id,
      name: p.name,
      isYou: req.role === "participant" && p._id.equals(req.participant._id),
    })),
  });
}

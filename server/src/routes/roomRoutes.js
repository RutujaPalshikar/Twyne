import { Router } from "express";
import { loadRoom, requireSender, requireParticipant, requireMember } from "../middleware/auth.js";
import * as rooms from "../controllers/roomController.js";
import * as people from "../controllers/participantController.js";

const router = Router();

// Every route below that has :roomCode first validates the room, then the session.
const sender = [loadRoom, requireSender];
const participant = [loadRoom, requireParticipant];
const member = [loadRoom, requireMember];

// Rooms
router.post("/", rooms.createRoom);
router.get("/:roomCode/status", loadRoom, rooms.getRoomStatus);
router.post("/:roomCode/join", loadRoom, rooms.joinRoom);
router.delete("/:roomCode", ...sender, rooms.closeRoomHandler);

// Presence
router.post("/:roomCode/sender/heartbeat", ...sender, rooms.senderHeartbeat);
router.post("/:roomCode/participant/heartbeat", ...participant, rooms.participantHeartbeat);
router.post("/:roomCode/participant/leave", ...participant, rooms.leaveRoom);

// Participants
router.get("/:roomCode/participants/active", ...member, people.getActiveParticipants);
router.get("/:roomCode/participants", ...sender, people.listParticipants);
router.post("/:roomCode/participants", ...sender, people.addParticipant);
router.delete("/:roomCode/participants/:id", ...sender, people.removeParticipant);

// History (metadata only)
router.get("/:roomCode/history", ...sender, rooms.getHistory);

export default router;

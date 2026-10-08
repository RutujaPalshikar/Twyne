import Room from "../models/Room.js";
import Participant from "../models/Participant.js";
import Transfer from "../models/Transfer.js";
import { SWEEP_INTERVAL_MS } from "../config/constants.js";
import { activeCutoff } from "../utils/presence.js";
import { dropRoom } from "./transferService.js";

// Closing a room erases it completely: room, participants and history.
export async function closeRoom(roomId) {
  await Room.updateOne({ _id: roomId }, { isActive: false }); // blocks new joins immediately
  dropRoom(String(roomId)); // abort live transfers and free their chunks
  await Room.deleteOne({ _id: roomId });
  await Promise.all([
    Participant.deleteMany({ room: roomId }),
    Transfer.deleteMany({ room: roomId }),
  ]);
}

// Backstop for rooms nobody is polling: close rooms whose sender went quiet
// and mark quiet participants inactive.
export async function sweepPresence() {
  const cutoff = activeCutoff();
  const staleRooms = await Room.find({ senderLastSeen: { $lt: cutoff } }).select("_id");
  for (const room of staleRooms) await closeRoom(room._id);
  await Participant.updateMany(
    { isActive: true, lastSeen: { $lt: cutoff } },
    { isActive: false }
  );
}

export function startPresenceSweeper() {
  const timer = setInterval(() => {
    sweepPresence().catch((err) => console.error("Presence sweep failed:", err));
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}

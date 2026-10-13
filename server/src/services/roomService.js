import Room from "../models/Room.js";
import Participant from "../models/Participant.js";
import Transfer from "../models/Transfer.js";
import { SWEEP_INTERVAL_MS } from "../config/constants.js";
import { activeCutoff } from "../utils/presence.js";
import { dropRoom } from "./transferService.js";

export async function closeRoom(roomId) {
  await Room.updateOne({ _id: roomId }, { isActive: false });
  dropRoom(String(roomId));
  await Room.deleteOne({ _id: roomId });
  await Promise.all([
    Participant.deleteMany({ room: roomId }),
    Transfer.deleteMany({ room: roomId }),
  ]);
}

export async function sweepPresence() {
  const cutoff = activeCutoff();
  const staleRooms = await Room.find({
    senderLastSeen: { $lt: cutoff },
  }).select("_id");
  for (const room of staleRooms) await closeRoom(room._id);
  await Participant.updateMany(
    { isActive: true, lastSeen: { $lt: cutoff } },
    { isActive: false },
  );
}

export function startPresenceSweeper() {
  const timer = setInterval(() => {
    sweepPresence().catch((err) =>
      console.error("Presence sweep failed:", err),
    );
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}

import mongoose from "mongoose";

// Temporary room metadata only. Deleted as soon as the room closes.
const roomSchema = new mongoose.Schema(
  {
    roomName: { type: String, required: true, trim: true, maxlength: 40 },
    roomCode: { type: String, required: true, unique: true, match: /^\d{4}$/ },
    senderSessionToken: { type: String, required: true, select: false },
    senderLastSeen: { type: Date, required: true, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model("Room", roomSchema);

import mongoose from "mongoose";

// Created by the sender. sessionToken stays null until the person joins.
const participantSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 30 },
    participantId: { type: String, required: true, unique: true },
    sessionToken: { type: String, default: null, select: false },
    lastSeen: { type: Date, default: null },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model("Participant", participantSchema);

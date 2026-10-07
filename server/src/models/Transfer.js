import mongoose from "mongoose";

// History METADATA only. File contents are never stored in MongoDB or on disk.
// Not written to yet: the next stage's transfer engine will create these.
const recipientSchema = new mongoose.Schema(
  {
    participant: { type: mongoose.Schema.Types.ObjectId, ref: "Participant", required: true },
    participantName: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "transferring", "completed", "failed", "cancelled"],
      default: "pending",
    },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const transferSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    fileId: { type: String, required: true },
    filename: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
    recipients: { type: [recipientSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("Transfer", transferSchema);

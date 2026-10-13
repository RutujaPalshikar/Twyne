import mongoose from "mongoose";

const recipientSchema = new mongoose.Schema(
  {
    participant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant",
      required: true,
    },
    participantName: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "transferring", "completed", "failed"],
      default: "pending",
    },
    ackedChunks: { type: Number, default: 0 },
    error: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const transferSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    fileId: { type: String, required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, default: "" },
    size: { type: Number, required: true, min: 0 },
    chunkSize: { type: Number, required: true },
    totalChunks: { type: Number, required: true },
    uploadedChunks: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        "queued",
        "uploading",
        "completed",
        "partial",
        "failed",
        "aborted",
      ],
      default: "queued",
    },
    batchId: { type: String, required: true },
    seq: { type: Number, required: true },
    queuedAt: { type: Date, required: true },
    recipients: { type: [recipientSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model("Transfer", transferSchema);

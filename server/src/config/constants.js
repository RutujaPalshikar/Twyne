// All tunable values live here so the rules of the platform are easy to find.
const num = (value, fallback) => (Number(value) > 0 ? Number(value) : fallback);

export const MAX_PARTICIPANTS = 10;

// Presence: clients ping every HEARTBEAT_INTERVAL_MS; the server treats a
// session as inactive after INACTIVE_TIMEOUT_MS without a ping.
export const HEARTBEAT_INTERVAL_MS = num(process.env.HEARTBEAT_INTERVAL_MS, 5000);
export const INACTIVE_TIMEOUT_MS = num(process.env.INACTIVE_TIMEOUT_MS, 15000);
export const SWEEP_INTERVAL_MS = num(process.env.SWEEP_INTERVAL_MS, 5000);

export const ROOM_CODE_LENGTH = 4;
export const PARTICIPANT_ID_LENGTH = 8;
// Uppercase letters and digits, minus look-alikes (0/O, 1/I) so IDs are easy to read out loud.
export const PARTICIPANT_ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// ---- File transfer (chunked HTTP through this server; chunks live in RAM only) ----
export const MAX_FILES_PER_SHARE = 10;
export const MAX_FILE_SIZE_BYTES = num(process.env.MAX_FILE_SIZE_MB, 100) * 1024 * 1024; // 100 MB
export const CHUNK_SIZE_BYTES = num(process.env.CHUNK_SIZE_BYTES, 2 * 1024 * 1024); // 2 MB
// Sender may run at most this many chunks ahead of the slowest active receiver.
// Caps server memory per transfer at BUFFER_WINDOW_CHUNKS * CHUNK_SIZE_BYTES (16 MB).
export const BUFFER_WINDOW_CHUNKS = num(process.env.BUFFER_WINDOW_CHUNKS, 8);
export const RECEIVER_POLL_MS = num(process.env.RECEIVER_POLL_MS, 1000);
// A receiver that stops polling this long is treated as gone for its transfers.
export const RECEIVER_IDLE_TIMEOUT_MS = num(process.env.RECEIVER_IDLE_TIMEOUT_MS, 10000);
// A sender that stops uploading an unfinished file this long aborts it.
export const SENDER_STALL_TIMEOUT_MS = num(process.env.SENDER_STALL_TIMEOUT_MS, 30000);
export const TRANSFER_SWEEP_INTERVAL_MS = num(process.env.TRANSFER_SWEEP_INTERVAL_MS, 2000);
export const MAX_UNFINISHED_TRANSFERS = num(process.env.MAX_UNFINISHED_TRANSFERS, 30);

export const ROOM_NAME_MAX = 40;
export const PARTICIPANT_NAME_MAX = 30;

// Sent to the browser so the frontend never hard-codes server rules.
export const clientConfig = () => ({
  heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
  inactiveTimeoutMs: INACTIVE_TIMEOUT_MS,
  maxParticipants: MAX_PARTICIPANTS,
  maxFiles: MAX_FILES_PER_SHARE,
  maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
  chunkSizeBytes: CHUNK_SIZE_BYTES,
  bufferWindowChunks: BUFFER_WINDOW_CHUNKS,
  receiverPollMs: RECEIVER_POLL_MS,
});

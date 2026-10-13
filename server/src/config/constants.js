const num = (value, fallback) => (Number(value) > 0 ? Number(value) : fallback);

export const MAX_PARTICIPANTS = 10;

export const HEARTBEAT_INTERVAL_MS = num(
  process.env.HEARTBEAT_INTERVAL_MS,
  5000,
);
export const INACTIVE_TIMEOUT_MS = num(process.env.INACTIVE_TIMEOUT_MS, 15000);
export const SWEEP_INTERVAL_MS = num(process.env.SWEEP_INTERVAL_MS, 5000);

export const ROOM_CODE_LENGTH = 4;
export const PARTICIPANT_ID_LENGTH = 8;

export const PARTICIPANT_ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const MAX_FILES_PER_SHARE = 10;
export const MAX_FILE_SIZE_BYTES =
  num(process.env.MAX_FILE_SIZE_MB, 100) * 1024 * 1024;
export const CHUNK_SIZE_BYTES = num(
  process.env.CHUNK_SIZE_BYTES,
  2 * 1024 * 1024,
);

export const BUFFER_WINDOW_CHUNKS = num(process.env.BUFFER_WINDOW_CHUNKS, 8);
export const RECEIVER_POLL_MS = num(process.env.RECEIVER_POLL_MS, 1000);

export const RECEIVER_IDLE_TIMEOUT_MS = num(
  process.env.RECEIVER_IDLE_TIMEOUT_MS,
  10000,
);

export const SENDER_STALL_TIMEOUT_MS = num(
  process.env.SENDER_STALL_TIMEOUT_MS,
  30000,
);
export const TRANSFER_SWEEP_INTERVAL_MS = num(
  process.env.TRANSFER_SWEEP_INTERVAL_MS,
  2000,
);
export const MAX_UNFINISHED_TRANSFERS = num(
  process.env.MAX_UNFINISHED_TRANSFERS,
  30,
);

export const ROOM_NAME_MAX = 40;
export const PARTICIPANT_NAME_MAX = 30;

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

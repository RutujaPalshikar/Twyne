// Fallbacks only. The server sends the real values when a session starts
// (see server/src/config/constants.js).
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 5000;
export const DEFAULT_MAX_PARTICIPANTS = 10;

// Sender can hold at most this many files in browser memory at once.
export const MAX_FILES = 10;

// Fallbacks for sessions created before the server sent these values. The server is the
// source of truth: see server/src/config/constants.js
export const DEFAULT_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const DEFAULT_BUFFER_WINDOW_CHUNKS = 8;
export const DEFAULT_RECEIVER_POLL_MS = 1000;

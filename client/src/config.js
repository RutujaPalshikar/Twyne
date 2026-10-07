// Fallbacks only. The server sends the real values when a session starts
// (see server/src/config/constants.js).
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 5000;
export const DEFAULT_MAX_PARTICIPANTS = 10;

// Sender can hold at most this many files in browser memory at once.
export const MAX_FILES = 10;

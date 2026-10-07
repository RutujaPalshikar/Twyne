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

export const ROOM_NAME_MAX = 40;
export const PARTICIPANT_NAME_MAX = 30;

// Sent to the browser so the frontend never hard-codes server rules.
export const clientConfig = () => ({
  heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
  inactiveTimeoutMs: INACTIVE_TIMEOUT_MS,
  maxParticipants: MAX_PARTICIPANTS,
});

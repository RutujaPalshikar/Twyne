import crypto from "node:crypto";
import {
  ROOM_CODE_LENGTH,
  PARTICIPANT_ID_LENGTH,
  PARTICIPANT_ID_CHARS,
} from "../config/constants.js";

// crypto.randomInt is uniform (no modulo bias) and uses the OS CSPRNG.
export const generateRoomCode = () =>
  String(crypto.randomInt(0, 10 ** ROOM_CODE_LENGTH)).padStart(ROOM_CODE_LENGTH, "0");

export const generateParticipantId = () =>
  Array.from({ length: PARTICIPANT_ID_LENGTH }, () =>
    PARTICIPANT_ID_CHARS[crypto.randomInt(PARTICIPANT_ID_CHARS.length)]
  ).join("");

export const generateSessionToken = () => crypto.randomBytes(32).toString("hex");

// Constant-time comparison so token checks don't leak timing information.
export function tokensMatch(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const hash = (v) => crypto.createHash("sha256").update(v).digest();
  return crypto.timingSafeEqual(hash(a), hash(b));
}

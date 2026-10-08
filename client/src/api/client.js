// Thin wrapper around fetch. Every call either resolves or throws ApiError.
const BASE = `${import.meta.env.VITE_API_URL || ""}/api`;

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Options: body (JSON), rawBody (Blob sent as bytes), as ("json" | "buffer"), signal, keepalive.
async function request(path, { method = "GET", body, rawBody, token, signal, as = "json", keepalive } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      signal,
      keepalive,
      headers: {
        ...(body && { "Content-Type": "application/json" }),
        ...(rawBody && { "Content-Type": "application/octet-stream" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: rawBody ?? (body ? JSON.stringify(body) : undefined),
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError("Cannot reach the Twyne server. Check your connection.", 0, "NETWORK");
  }
  if (res.status === 204) return null; // "nothing yet": used by receivers polling for a chunk
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || "Something went wrong.", res.status, data.code);
  }
  return as === "buffer" ? res.arrayBuffer() : res.json();
}

// `s` is the session object: { role: "sender" | "participant", roomCode, token }.
export const api = {
  createRoom: (roomName) => request("/rooms", { method: "POST", body: { roomName } }),
  getRoomStatus: (code) => request(`/rooms/${code}/status`),
  joinRoom: (code, name, participantId) =>
    request(`/rooms/${code}/join`, { method: "POST", body: { name, participantId } }),

  heartbeat: (s) => request(`/rooms/${s.roomCode}/${s.role}/heartbeat`, { method: "POST", token: s.token }),
  leaveRoom: (s) => request(`/rooms/${s.roomCode}/participant/leave`, { method: "POST", token: s.token }),
  closeRoom: (s) => request(`/rooms/${s.roomCode}`, { method: "DELETE", token: s.token }),

  listParticipants: (s) => request(`/rooms/${s.roomCode}/participants`, { token: s.token }),
  addParticipant: (s, name) =>
    request(`/rooms/${s.roomCode}/participants`, { method: "POST", body: { name }, token: s.token }),
  removeParticipant: (s, id) =>
    request(`/rooms/${s.roomCode}/participants/${id}`, { method: "DELETE", token: s.token }),
  getActiveParticipants: (s) => request(`/rooms/${s.roomCode}/participants/active`, { token: s.token }),
  getHistory: (s) => request(`/rooms/${s.roomCode}/history`, { token: s.token }),

  // ----- sender: file transfer -----
  createTransfers: (s, files, participantIds) =>
    request(`/rooms/${s.roomCode}/transfers`, { method: "POST", body: { files, participantIds }, token: s.token }),
  uploadChunk: (s, id, index, blob, signal) =>
    request(`/rooms/${s.roomCode}/transfers/${id}/chunks/${index}`, { method: "PUT", rawBody: blob, token: s.token, signal }),
  getUploadState: (s, id, signal) => request(`/rooms/${s.roomCode}/transfers/${id}/state`, { token: s.token, signal }),
  abortTransfer: (s, id, opts) =>
    request(`/rooms/${s.roomCode}/transfers/${id}/abort`, { method: "POST", token: s.token, ...opts }),

  // ----- receiver: file transfer -----
  getIncoming: (s, signal) => request(`/rooms/${s.roomCode}/transfers/incoming`, { token: s.token, signal }),
  getChunk: (s, id, index, signal) =>
    request(`/rooms/${s.roomCode}/transfers/${id}/chunks/${index}`, { token: s.token, signal, as: "buffer" }),
  ackChunk: (s, id, index, signal) =>
    request(`/rooms/${s.roomCode}/transfers/${id}/ack`, { method: "POST", body: { index }, token: s.token, signal }),
  failTransfer: (s, id, reason) =>
    request(`/rooms/${s.roomCode}/transfers/${id}/fail`, { method: "POST", body: { reason }, token: s.token }),
};

// Thin wrapper around fetch. Every call either resolves with JSON or throws ApiError.
const BASE = `${import.meta.env.VITE_API_URL || ""}/api`;

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = "GET", body, token } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Cannot reach the Twyne server. Check your connection.", 0, "NETWORK");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "Something went wrong.", res.status, data.code);
  return data;
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
};

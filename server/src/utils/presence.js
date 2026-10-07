import { INACTIVE_TIMEOUT_MS } from "../config/constants.js";

export const activeCutoff = () => new Date(Date.now() - INACTIVE_TIMEOUT_MS);

// A session is "fresh" if its last heartbeat is within the timeout window.
export const isFresh = (lastSeen) =>
  Boolean(lastSeen) && Date.now() - new Date(lastSeen).getTime() < INACTIVE_TIMEOUT_MS;

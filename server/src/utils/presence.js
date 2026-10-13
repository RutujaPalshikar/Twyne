import { INACTIVE_TIMEOUT_MS } from "../config/constants.js";

export const activeCutoff = () => new Date(Date.now() - INACTIVE_TIMEOUT_MS);

export const isFresh = (lastSeen) =>
  Boolean(lastSeen) &&
  Date.now() - new Date(lastSeen).getTime() < INACTIVE_TIMEOUT_MS;

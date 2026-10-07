import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { loadSession, storeSession, removeSession } from "../utils/session.js";
import { DEFAULT_HEARTBEAT_INTERVAL_MS } from "../config.js";

const SessionContext = createContext(null);
export const useSession = () => useContext(SessionContext);

// Holds the tab's temporary session AND sends its heartbeat. Because this lives
// above the router, presence continues even if the user browses to another page.
export function SessionProvider({ children }) {
  const [session, setSession] = useState(loadSession);
  const [notice, setNotice] = useState(null);

  const startSession = useCallback((next) => {
    storeSession(next);
    setSession(next);
    setNotice(null);
  }, []);

  const endSession = useCallback((message) => {
    removeSession();
    setSession(null);
    if (message) setNotice(message);
  }, []);

  const token = session?.token;
  const roomCode = session?.roomCode;
  const role = session?.role;
  const intervalMs = session?.config?.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const current = { token, roomCode, role };

    async function beat() {
      try {
        await api.heartbeat(current);
      } catch (err) {
        if (cancelled) return;
        if (err.status === 404) {
          endSession(
            role === "sender"
              ? "Your room was closed because it went inactive. Its data was deleted."
              : "This room was closed by the sender."
          );
        } else if (err.status === 401) {
          endSession(
            role === "participant"
              ? "The sender removed you from this room."
              : "Your session is no longer valid."
          );
        }
        // Network errors: ignore and try again on the next tick.
      }
    }

    beat();
    const id = setInterval(beat, intervalMs);
    const onVisible = () => document.visibilityState === "visible" && beat();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token, roomCode, role, intervalMs, endSession]);

  const value = useMemo(
    () => ({ session, startSession, endSession, notice, clearNotice: () => setNotice(null) }),
    [session, startSession, endSession, notice]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { sleep } from "../utils/sleep.js";
import { DEFAULT_RECEIVER_POLL_MS } from "../config.js";

const FATAL = new Set([401, 403, 404, 409, 410]); // the server has already decided: don't retry
const MAX_ATTEMPTS = 5;

// Polls for files addressed to this participant, downloads each one chunk by chunk (in order),
// keeps the chunks in browser memory and rebuilds the file as a Blob.
// items: [{ id, filename, size, status: "waiting"|"receiving"|"ready"|"failed", receivedChunks, totalChunks, url, error }]
export default function useReceiver(session) {
  const [items, setItems] = useState([]);
  const urls = useRef(new Map()); // transferId -> object URL (revoked when no longer needed)
  const pollMs = session.config?.receiverPollMs ?? DEFAULT_RECEIVER_POLL_MS;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const known = new Set();
    const queue = [];
    let working = false;

    const patch = (id, changes) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)));

    // Retry network hiccups; give up immediately on answers the server will not change.
    async function withRetry(fn) {
      for (let attempt = 1; ; attempt++) {
        try {
          return await fn();
        } catch (err) {
          if (err.name === "AbortError") throw err;
          if (FATAL.has(err.status)) {
            err.serverDecided = true;
            throw err;
          }
          if (attempt >= MAX_ATTEMPTS) throw err;
          await sleep(300 * attempt, signal);
        }
      }
    }

    // Wait (by polling) until the sender has uploaded chunk `index`.
    async function fetchChunk(t, index) {
      for (;;) {
        const buf = await withRetry(() => api.getChunk(session, t.id, index, signal));
        if (buf) return buf;
        await sleep(250, signal);
      }
    }

    async function receiveOne(t) {
      patch(t.id, { status: "receiving" });
      const parts = []; // the file's chunks, in order, in memory
      try {
        for (let index = 0; index < t.totalChunks; index++) {
          const buf = await fetchChunk(t, index);
          const expected = index === t.totalChunks - 1 ? t.size - index * t.chunkSize : t.chunkSize;
          if (buf.byteLength !== expected) throw new Error("Received a damaged chunk");
          parts.push(buf);
          await withRetry(() => api.ackChunk(session, t.id, index, signal));
          patch(t.id, { receivedChunks: index + 1 });
        }
        const blob = new Blob(parts, { type: t.mimeType || "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        urls.current.set(t.id, url);
        patch(t.id, { status: "ready", url });
      } catch (err) {
        if (signal.aborted) return;
        if (!err.serverDecided) api.failTransfer(session, t.id, "Receiver error").catch(() => {});
        patch(t.id, {
          status: "failed",
          error: err.status === 410 || err.status === 409 ? "Delivery was stopped" : err.message,
        });
      }
    }

    async function work() {
      if (working) return;
      working = true;
      while (queue.length > 0 && !signal.aborted) await receiveOne(queue.shift());
      working = false;
    }

    async function pollLoop() {
      while (!signal.aborted) {
        try {
          const data = await api.getIncoming(session, signal);
          for (const t of data.transfers) {
            if (known.has(t.id)) continue;
            known.add(t.id);
            queue.push(t);
            setItems((prev) => [
              ...prev,
              { id: t.id, filename: t.filename, size: t.size, status: "waiting", receivedChunks: 0, totalChunks: t.totalChunks },
            ]);
          }
          work();
          await sleep(pollMs, signal);
        } catch (err) {
          if (err.name === "AbortError" || err.status === 404 || err.status === 401) return;
          await sleep(pollMs, signal).catch(() => {});
        }
      }
    }

    pollLoop();
    return () => controller.abort(); // leaving the room cancels downloads
  }, [session, pollMs]);

  // Free object URLs when the participant leaves the page.
  useEffect(() => {
    const map = urls.current;
    return () => {
      for (const url of map.values()) URL.revokeObjectURL(url);
      map.clear();
    };
  }, []);

  // Let the participant free memory once they have saved a file (or to dismiss a failure).
  const dismiss = useCallback((id) => {
    const url = urls.current.get(id);
    if (url) URL.revokeObjectURL(url);
    urls.current.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return { items, dismiss };
}

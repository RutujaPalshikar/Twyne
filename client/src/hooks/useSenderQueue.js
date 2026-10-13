import { useCallback, useEffect, useRef } from "react";
import { api } from "../api/client.js";
import { uploadTransfer } from "../transfer/senderUpload.js";
import { DEFAULT_BUFFER_WINDOW_CHUNKS } from "../config.js";

export default function useSenderQueue(session, onProblem) {
  const ref = useRef({
    queue: [],
    running: false,
    controller: null,
    open: new Set(),
  });
  const windowChunks =
    session.config?.bufferWindowChunks ?? DEFAULT_BUFFER_WINDOW_CHUNKS;

  useEffect(() => {
    const s = ref.current;
    s.controller = new AbortController();
    return () => {
      s.controller.abort();
      s.queue.length = 0;
      for (const id of s.open)
        api.abortTransfer(session, id, { keepalive: true }).catch(() => {});
      s.open.clear();
    };
  }, [session]);

  const run = useCallback(async () => {
    const s = ref.current;
    if (s.running) return;
    s.running = true;
    const { signal } = s.controller;
    try {
      while (s.queue.length > 0) {
        const { transfer, file } = s.queue.shift();
        try {
          const result = await uploadTransfer({
            session,
            transfer,
            file,
            windowChunks,
            signal,
          });
          if (result === "failed")
            onProblem?.(
              `Could not upload ${transfer.filename}. Check your connection.`,
            );
        } catch (err) {
          if (err.name === "AbortError") return;
          if (err.status === 404 || err.status === 401) {
            s.queue.length = 0;
            return;
          }
          onProblem?.(`Could not upload ${transfer.filename}: ${err.message}`);
          api.abortTransfer(session, transfer.id).catch(() => {});
        } finally {
          s.open.delete(transfer.id);
        }
      }
    } finally {
      s.running = false;
    }
  }, [session, windowChunks, onProblem]);

  const enqueue = useCallback(
    (items) => {
      const s = ref.current;
      for (const item of items) {
        s.open.add(item.transfer.id);
        s.queue.push(item);
      }
      run();
    },
    [run],
  );

  return { enqueue };
}

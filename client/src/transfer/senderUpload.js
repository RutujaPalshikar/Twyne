import { api } from "../api/client.js";
import { sleep } from "../utils/sleep.js";

const MAX_ATTEMPTS = 4;

export async function uploadTransfer({
  session,
  transfer,
  file,
  windowChunks,
  signal,
}) {
  const { id, totalChunks, chunkSize } = transfer;
  let minAcked = 0;

  for (let index = 0; index < totalChunks; index++) {
    while (index >= minAcked + windowChunks) {
      await sleep(250, signal);
      try {
        const state = await api.getUploadState(session, id, signal);
        if (state.closed) return "closed";
        minAcked = state.minAcked;
      } catch (err) {
        if (
          err.name === "AbortError" ||
          err.status === 404 ||
          err.status === 401
        )
          throw err;
      }
    }

    const chunk = file.slice(
      index * chunkSize,
      Math.min(file.size, (index + 1) * chunkSize),
    );
    let attempt = 0;
    for (;;) {
      try {
        const result = await api.uploadChunk(session, id, index, chunk, signal);
        minAcked = result.minAcked;
        break;
      } catch (err) {
        if (err.name === "AbortError") throw err;
        if (err.code === "TRANSFER_CLOSED") return "closed";
        if (err.code === "BUFFER_FULL") {
          await sleep(250, signal);
          continue;
        }
        if (err.status === 404 || err.status === 401 || err.status === 403)
          throw err;
        if (++attempt >= MAX_ATTEMPTS) {
          await api.abortTransfer(session, id).catch(() => {});
          return "failed";
        }
        await sleep(400 * attempt, signal);
      }
    }
  }
  return "uploaded";
}

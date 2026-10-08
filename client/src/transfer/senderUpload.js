import { api } from "../api/client.js";
import { sleep } from "../utils/sleep.js";

const MAX_ATTEMPTS = 4;

// Uploads ONE file as sequential chunks. Only one chunk (File.slice) is read at a time,
// so a 100 MB file never sits in memory as a whole.
// Returns "uploaded" | "closed" (server stopped it, e.g. every receiver failed) | "failed".
export async function uploadTransfer({ session, transfer, file, windowChunks, signal }) {
  const { id, totalChunks, chunkSize } = transfer;
  let minAcked = 0; // how far the slowest receiver has got (reported by the server)

  for (let index = 0; index < totalChunks; index++) {
    // Flow control: stay within `windowChunks` of the slowest receiver so the server's
    // memory stays bounded. Waiting uses a tiny status request, not a chunk upload.
    while (index >= minAcked + windowChunks) {
      await sleep(250, signal);
      try {
        const state = await api.getUploadState(session, id, signal);
        if (state.closed) return "closed";
        minAcked = state.minAcked;
      } catch (err) {
        if (err.name === "AbortError" || err.status === 404 || err.status === 401) throw err;
        // temporary network problem: just ask again
      }
    }

    const chunk = file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize));
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
        if (err.status === 404 || err.status === 401 || err.status === 403) throw err; // room gone / session invalid
        if (++attempt >= MAX_ATTEMPTS) {
          await api.abortTransfer(session, id).catch(() => {});
          return "failed";
        }
        await sleep(400 * attempt, signal); // retry the SAME chunk; the server ignores duplicates
      }
    }
  }
  return "uploaded";
}

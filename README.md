# Twyne

Ephemeral file-sharing rooms. **Stage 1: rooms, participants and presence. Stage 2: the complete room interface** (file picking, selection, share confirmation, history table). **Stage 3: real chunked file transfer.**

MERN only: React (Vite) + Express + MongoDB/Mongoose. No accounts, no file storage.

## Run it

**Windows (Command Prompt):**
```bat
:: terminal 1: backend  (http://localhost:5000)
cd twyne\server
copy .env.example .env
npm install
npm run dev

:: terminal 2: frontend (http://localhost:5173)
cd twyne\client
npm install
npm run dev
```

**macOS / Linux:** same, but use `cp .env.example .env`.

Details:

You need Node 18+ and a running MongoDB (local `mongod` or a free Atlas URI).

```bash
# 1. Backend  (http://localhost:5000)
cd server
cp .env.example .env        # edit MONGODB_URI if needed
npm install
npm run dev                 # or: npm start

# 2. Frontend (http://localhost:5173), in a second terminal
cd client
npm install
npm run dev
```

The Vite dev server proxies `/api` to the backend, so no CORS setup is needed in development.
To test on a phone, run `npm run dev -- --host` in `client/` and open the printed network URL.

## Rules (see `server/src/config/constants.js`)

| Constant | Default |
|---|---|
| `MAX_PARTICIPANTS` | 10 |
| `HEARTBEAT_INTERVAL_MS` | 5000 |
| `INACTIVE_TIMEOUT_MS` | 15000 |
| `SWEEP_INTERVAL_MS` | 5000 |

Each can be overridden with an environment variable of the same name (see `.env.example`).
The server sends the heartbeat interval and participant limit to the browser, so the values live in one place.

## API (all under `/api/rooms`, tokens sent as `Authorization: Bearer <token>`)

| Method & path | Who | Purpose |
|---|---|---|
| `POST /` | anyone | Create room, returns room code + sender token |
| `GET /:code/status` | anyone | Is this room open? |
| `POST /:code/join` | anyone | Name + participant ID, returns participant token |
| `POST /:code/sender/heartbeat` | sender | Presence ping |
| `POST /:code/participant/heartbeat` | participant | Presence ping |
| `POST /:code/participant/leave` | participant | Leave the room |
| `GET /:code/participants` | sender | All participants incl. IDs and status |
| `POST /:code/participants` | sender | Add participant (max 10) |
| `DELETE /:code/participants/:id` | sender | Remove participant |
| `GET /:code/participants/active` | sender or participant | Currently active participants |
| `GET /:code/history` | sender | Transfer history metadata |
| `DELETE /:code` | sender | Close room and delete all its data |

## Layout

```
server/src/
  config/       constants + MongoDB connection
  models/       Room, Participant, Transfer (metadata only)
  middleware/   loadRoom -> requireSender / requireParticipant / requireMember
  controllers/  roomController, participantController
  services/     closeRoom + presence sweeper
  routes/       roomRoutes
client/src/
  api/          fetch wrapper
  context/      SessionContext (sessionStorage + heartbeat)
  pages/        Home, CreateRoom, JoinRoom, SenderRoom, ParticipantRoom
  components/   Navbar, Notice, CopyButton, FilePanelPlaceholder, Logo
  styles.css    all styling (plain CSS)
```

## How file transfer works (stage 3)

1. **SHARE** sends only metadata (names, sizes, chosen participant IDs) to `POST /transfers`. The server validates the limits
   (max 10 files, max 100 MB each, only *active* participants of this room) and creates one transfer per file.
2. The sender uploads **one file at a time**, cutting it with `File.slice()` into **2 MB chunks** sent one after another with `fetch()`
   (`PUT .../chunks/:index`). Each file is uploaded **once**, whoever the recipients are.
3. The server keeps a chunk **in RAM only** until every still-active recipient has acknowledged it, then frees it. Nothing goes to MongoDB or disk
   (MongoDB gets only metadata and status). The sender may run at most 8 chunks ahead of the slowest receiver, so server memory per file is
   capped at about 16 MB.
4. Each selected participant **polls** `GET /transfers/incoming`, then downloads chunk 0, 1, 2... in order (`204` = "not uploaded yet, poll again"),
   acknowledges each one, keeps the bytes in browser memory and rebuilds the file as a `Blob`. A **Download** button saves it.
5. Delivery is tracked **per participant**. A participant who disconnects, is removed, leaves, stops polling or reports an error is marked
   `failed` ("NOT RECEIVED") and everyone else carries on. Final status per file: `SENT` (all received), `PARTLY SENT`, or `NOT RECEIVED`.
6. If the **sender** goes inactive the room closes (as before), all live transfers are dropped and every chunk is freed.

Extra endpoints (all under `/api/rooms/:code`, every one checks the room and the session token):

| Method & path | Who | Purpose |
|---|---|---|
| `POST /transfers` | sender | Validate + register files for chosen participants |
| `PUT /transfers/:id/chunks/:i` | sender | Upload chunk `i` (raw bytes) |
| `GET /transfers/:id/state` | sender | Cheap status poll while waiting on flow control |
| `POST /transfers/:id/abort` | sender | Cancel a transfer |
| `GET /transfers/incoming` | participant | Files addressed to me |
| `GET /transfers/:id/chunks/:i` | recipient | Fetch chunk `i` (in order) |
| `POST /transfers/:id/ack` | recipient | Confirm chunk `i` |
| `POST /transfers/:id/fail` | recipient | Give up on a transfer |
| `GET /history` | sender | Real progress and per-recipient status |

`GET /api/health` also reports `activeTransfers` and `bufferedBytes` (handy to confirm memory is released).

## Known limitations

- Chunks live in server RAM: a server restart loses transfers in flight (they are shown as NOT RECEIVED).
- Receivers hold the whole file in browser memory (up to 100 MB). Refreshing or leaving the room page loses undownloaded files and an unfinished download cannot resume.
- Files from one share are sent one after another, so total time grows with the number of files.
- A sender or receiver on a throttled background tab can be dropped if the browser pauses its timers.
- No encryption beyond what HTTPS gives you; use HTTPS when deployed.

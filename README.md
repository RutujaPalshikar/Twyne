# Twyne

Ephemeral file-sharing rooms. **Stage 1: rooms, participants and presence. Stage 2: the complete room interface** (file picking, selection, share confirmation, history table). Actual file transfer is not implemented yet.

MERN only: React (Vite) + Express + MongoDB/Mongoose. No accounts, no file storage.

## Run it

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

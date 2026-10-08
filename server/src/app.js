import express from "express";
import cors from "cors";
import roomRoutes from "./routes/roomRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { stats } from "./services/transferService.js";

const app = express();

const origins = (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map((o) => o.trim());
app.use(cors({ origin: origins }));
app.set("etag", false); // chunks are never cached or hashed
app.use(express.json({ limit: "64kb" })); // JSON is metadata only; file chunks use a raw parser on one route

app.get("/api/health", (req, res) => res.json({ ok: true, ...stats() }));
app.use("/api/rooms", roomRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;

import express from "express";
import cors from "cors";
import roomRoutes from "./routes/roomRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

const origins = (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map((o) => o.trim());
app.use(cors({ origin: origins }));
app.use(express.json({ limit: "10kb" })); // metadata only: no file bodies here

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/rooms", roomRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;

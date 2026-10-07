import { HttpError } from "../utils/httpError.js";

export function notFound(req, res) {
  res.status(404).json({ error: "Route not found.", code: "NOT_FOUND" });
}

// Express 5 forwards errors from async handlers here automatically.
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body.", code: "VALIDATION" });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: err.message, code: "VALIDATION" });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server.", code: "SERVER_ERROR" });
}

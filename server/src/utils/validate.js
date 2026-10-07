import { HttpError } from "./httpError.js";

// Accepts only real strings (blocks objects like {"$ne": ""} reaching Mongo queries).
export function cleanString(value, max, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${label} is required.`, "VALIDATION");
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new HttpError(400, `${label} must be ${max} characters or fewer.`, "VALIDATION");
  }
  return trimmed;
}

export const isString = (v) => typeof v === "string";

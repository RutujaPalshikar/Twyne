import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { startPresenceSweeper } from "./services/roomService.js";
import { markInterruptedTransfers, startTransferSweeper } from "./services/transferService.js";

const PORT = process.env.PORT || 5000;

try {
  await connectDB();
  await markInterruptedTransfers();
  startPresenceSweeper();
  startTransferSweeper();
  app.listen(PORT, () => console.log(`Twyne API listening on http://localhost:${PORT}`));
} catch (err) {
  console.error("Failed to start Twyne API:", err.message);
  process.exit(1);
}

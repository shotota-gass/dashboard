import { connectDB } from "./mongodb";
import StockEntry from "@/models/StockEntry";
import { KG_SIZES } from "./constants";

type KgSize = (typeof KG_SIZES)[number];

async function bumpEntry(kgSize: KgSize, company: string, status: "full" | "empty", delta: number, recordedBy: string) {
  if (delta > 0) {
    await StockEntry.findOneAndUpdate(
      { kgSize, company, status },
      { $inc: { quantity: delta }, $setOnInsert: { recordedBy, date: new Date() } },
      { upsert: true }
    );
  } else if (delta < 0) {
    const entry = await StockEntry.findOne({ kgSize, company, status }).sort({ quantity: -1 });
    if (!entry) return;
    entry.quantity = Math.max(0, entry.quantity + delta);
    await entry.save();
  }
}

// Keeps the StockEntry aggregate (used by "Current Stock") in sync with a StockMovement's deltas.
export async function applyStockDelta(
  kgSize: KgSize,
  company: string,
  fullDelta: number,
  emptyDelta: number,
  recordedBy: string
) {
  await connectDB();
  if (fullDelta !== 0) await bumpEntry(kgSize, company, "full", fullDelta, recordedBy);
  if (emptyDelta !== 0) await bumpEntry(kgSize, company, "empty", emptyDelta, recordedBy);
}

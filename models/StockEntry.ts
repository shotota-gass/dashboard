import mongoose, { Schema, Document, Model } from "mongoose";
import { KG_SIZES } from "@/lib/constants";

export interface IStockEntry extends Document {
  date: Date;
  kgSize: (typeof KG_SIZES)[number];
  company: string;
  status: "full" | "empty";
  quantity: number;
  recordedBy: mongoose.Types.ObjectId;
  note?: string;
}

const StockEntrySchema = new Schema<IStockEntry>(
  {
    date: { type: Date, required: true, default: Date.now },
    kgSize: { type: Number, enum: KG_SIZES, required: true },
    company: { type: String, required: true },
    status: { type: String, enum: ["full", "empty"], required: true },
    quantity: { type: Number, required: true, min: 0 },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String },
  },
  { timestamps: true }
);

const StockEntry: Model<IStockEntry> =
  mongoose.models.StockEntry ??
  mongoose.model<IStockEntry>("StockEntry", StockEntrySchema);

export default StockEntry;

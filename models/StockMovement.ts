import mongoose, { Schema, Document, Model } from "mongoose";
import { KG_SIZES } from "@/lib/constants";

export type MovementType =
  | "receive_full"
  | "sell"
  | "return_empty"
  | "send_refill"
  | "receive_refilled"
  | "transfer_out"
  | "transfer_in"
  | "adjustment";

export interface IStockMovement extends Document {
  type: MovementType;
  kgSize: (typeof KG_SIZES)[number];
  company: string;
  quantity: number;
  fullDelta: number;
  emptyDelta: number;
  note?: string;
  date: Date;
  recordedBy?: mongoose.Types.ObjectId;
  saleRef?: mongoose.Types.ObjectId;
  branchRef?: mongoose.Types.ObjectId;
  transferToBranch?: mongoose.Types.ObjectId;  // for transfer_out
  customerRef?: mongoose.Types.ObjectId;       // for return_empty
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    type: {
      type: String,
      enum: ["receive_full", "sell", "return_empty", "send_refill", "receive_refilled", "transfer_out", "transfer_in", "adjustment"],
      required: true,
    },
    kgSize: { type: Number, enum: KG_SIZES, required: true },
    company: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    fullDelta: { type: Number, required: true },
    emptyDelta: { type: Number, required: true },
    note: { type: String },
    date: { type: Date, default: Date.now },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
    saleRef: { type: Schema.Types.ObjectId, ref: "Sale" },
    branchRef: { type: Schema.Types.ObjectId, ref: "Branch" },
    transferToBranch: { type: Schema.Types.ObjectId, ref: "Branch" },
    customerRef: { type: Schema.Types.ObjectId, ref: "Customer" },
  },
  { timestamps: true }
);

StockMovementSchema.index({ date: -1 });
StockMovementSchema.index({ kgSize: 1, company: 1 });
StockMovementSchema.index({ type: 1 });
StockMovementSchema.index({ branchRef: 1 });

const StockMovement: Model<IStockMovement> =
  mongoose.models.StockMovement ??
  mongoose.model<IStockMovement>("StockMovement", StockMovementSchema);

export default StockMovement;

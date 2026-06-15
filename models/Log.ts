import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILog extends Document {
  date: Date;
  type: "daily_count" | "system";
  action: string;
  performedBy?: mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;
}

const LogSchema = new Schema<ILog>(
  {
    date: { type: Date, required: true, default: Date.now },
    type: { type: String, enum: ["daily_count", "system"], required: true },
    action: { type: String, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User" },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

const Log: Model<ILog> =
  mongoose.models.Log ?? mongoose.model<ILog>("Log", LogSchema);

export default Log;

import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBranch extends Document {
  name: string;
  code: string;       // short code e.g. "DHK-01"
  address: string;
  contact: string;
  managerRef?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    address: { type: String, required: true, trim: true },
    contact: { type: String, required: true, trim: true },
    managerRef: { type: Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

BranchSchema.index({ code: 1 });
BranchSchema.index({ isActive: 1 });

const Branch: Model<IBranch> =
  mongoose.models.Branch ?? mongoose.model<IBranch>("Branch", BranchSchema);

export default Branch;

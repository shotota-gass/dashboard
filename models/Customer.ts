import mongoose, { Schema, Document, Model } from "mongoose";
import { PACKAGE_SIZES } from "@/lib/constants";

export interface ICustomer extends Document {
  userId: string;
  fullName: string;
  nid: string;
  contact: string;
  comment?: string;
  address: {
    area: string;
    road: string;
    houseFlat: string;
  };
  packageType: (typeof PACKAGE_SIZES)[number];
  lastPackage?: Date;
  billPaidTill?: Date;
  branchRef?: mongoose.Types.ObjectId;
  billingRate: number;         // monthly rate in BDT
  outstandingBalance: number;  // cumulative unpaid amount
  isActive: boolean;
  createdAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    userId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    nid: { type: String, required: true, trim: true },
    contact: { type: String, required: true, trim: true },
    comment: { type: String },
    address: {
      area: { type: String, required: true },
      road: { type: String, required: true },
      houseFlat: { type: String, required: true },
    },
    packageType: { type: Number, enum: PACKAGE_SIZES, required: true },
    lastPackage: { type: Date },
    billPaidTill: { type: Date },
    branchRef: { type: Schema.Types.ObjectId, ref: "Branch" },
    billingRate: { type: Number, default: 0, min: 0 },
    outstandingBalance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ branchRef: 1 });
CustomerSchema.index({ billPaidTill: 1 });
CustomerSchema.index({ isActive: 1 });

const Customer: Model<ICustomer> =
  mongoose.models.Customer ??
  mongoose.model<ICustomer>("Customer", CustomerSchema);

export default Customer;

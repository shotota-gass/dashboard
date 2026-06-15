import mongoose, { Schema, Document, Model } from "mongoose";
import { COMPANIES, PACKAGE_SIZES, SALE_TYPES } from "@/lib/constants";

export interface ISale extends Document {
  date: Date;
  type: (typeof SALE_TYPES)[number];
  packageKg: (typeof PACKAGE_SIZES)[number];
  company: (typeof COMPANIES)[number];
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  customerRef?: mongoose.Types.ObjectId;
  branchRef?: mongoose.Types.ObjectId;
  invoiceRef?: mongoose.Types.ObjectId;
  soldBy: mongoose.Types.ObjectId;
  notes?: string;
}

const SaleSchema = new Schema<ISale>(
  {
    date: { type: Date, required: true, default: Date.now },
    type: { type: String, enum: SALE_TYPES, required: true },
    packageKg: { type: Number, enum: PACKAGE_SIZES, required: true },
    company: { type: String, enum: COMPANIES, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    customerRef: { type: Schema.Types.ObjectId, ref: "Customer" },
    branchRef: { type: Schema.Types.ObjectId, ref: "Branch" },
    invoiceRef: { type: Schema.Types.ObjectId, ref: "Invoice" },
    soldBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String },
  },
  { timestamps: true }
);

SaleSchema.index({ date: -1 });
SaleSchema.index({ branchRef: 1 });
SaleSchema.index({ customerRef: 1 });

const Sale: Model<ISale> =
  mongoose.models.Sale ?? mongoose.model<ISale>("Sale", SaleSchema);

export default Sale;

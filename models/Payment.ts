import mongoose, { Schema, Document, Model } from "mongoose";
import { PAYMENT_METHODS } from "@/lib/constants";

export interface IPayment extends Document {
  customerRef: mongoose.Types.ObjectId;
  invoiceRef?: mongoose.Types.ObjectId;
  branchRef?: mongoose.Types.ObjectId;
  amount: number;
  method: (typeof PAYMENT_METHODS)[number];
  transactionId?: string;    // for bKash/Nagad/bank ref
  receivedBy: mongoose.Types.ObjectId;
  date: Date;
  note?: string;
  createdAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    customerRef: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    invoiceRef: { type: Schema.Types.ObjectId, ref: "Invoice" },
    branchRef: { type: Schema.Types.ObjectId, ref: "Branch" },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    transactionId: { type: String, trim: true },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    note: { type: String },
  },
  { timestamps: true }
);

PaymentSchema.index({ customerRef: 1 });
PaymentSchema.index({ invoiceRef: 1 });
PaymentSchema.index({ branchRef: 1 });
PaymentSchema.index({ date: -1 });

const Payment: Model<IPayment> =
  mongoose.models.Payment ?? mongoose.model<IPayment>("Payment", PaymentSchema);

export default Payment;

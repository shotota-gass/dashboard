import mongoose, { Schema, Document, Model } from "mongoose";
import { INVOICE_STATUS } from "@/lib/constants";

export interface IInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  customerRef: mongoose.Types.ObjectId;
  branchRef?: mongoose.Types.ObjectId;
  saleRef?: mongoose.Types.ObjectId;
  items: IInvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: (typeof INVOICE_STATUS)[number];
  issuedDate: Date;
  dueDate: Date;
  paidDate?: Date;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItem>(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    customerRef: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    branchRef: { type: Schema.Types.ObjectId, ref: "Branch" },
    saleRef: { type: Schema.Types.ObjectId, ref: "Sale" },
    items: { type: [InvoiceItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: INVOICE_STATUS, default: "issued" },
    issuedDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    paidDate: { type: Date },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

InvoiceSchema.index({ invoiceNumber: 1 });
InvoiceSchema.index({ customerRef: 1 });
InvoiceSchema.index({ branchRef: 1 });
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ issuedDate: -1 });
InvoiceSchema.index({ dueDate: 1 });

const Invoice: Model<IInvoice> =
  mongoose.models.Invoice ?? mongoose.model<IInvoice>("Invoice", InvoiceSchema);

export default Invoice;

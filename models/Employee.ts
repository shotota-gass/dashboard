import mongoose, { Schema, Document, Model } from "mongoose";
import { ROLES } from "@/lib/constants";

export interface IEmployee extends Document {
  name: string;
  contact: string;
  nid: string;
  address: string;
  role: (typeof ROLES)[number];
  branchRef?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    name: { type: String, required: true, trim: true },
    contact: { type: String, required: true, trim: true },
    nid: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true },
    branchRef: { type: Schema.Types.ObjectId, ref: "Branch" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

EmployeeSchema.index({ branchRef: 1 });
EmployeeSchema.index({ role: 1 });

const Employee: Model<IEmployee> =
  mongoose.models.Employee ??
  mongoose.model<IEmployee>("Employee", EmployeeSchema);

export default Employee;

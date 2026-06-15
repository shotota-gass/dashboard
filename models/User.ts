import mongoose, { Schema, Document, Model } from "mongoose";
import { ROLES } from "@/lib/constants";

export interface IUser extends Document {
  userId: string;
  passwordHash: string;
  role: (typeof ROLES)[number];
  employeeRef?: mongoose.Types.ObjectId;
  email?: string;
  displayName?: string;
  resetToken?: string;
  resetTokenExpiry?: Date;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    employeeRef: { type: Schema.Types.ObjectId, ref: "Employee" },
    email: { type: String, trim: true, lowercase: true },
    displayName: { type: String, trim: true },
    resetToken: { type: String },
    resetTokenExpiry: { type: Date },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);

export default User;

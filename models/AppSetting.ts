import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAppSetting extends Document {
  key: string;
  value: unknown;
  updatedAt: Date;
}

const AppSettingSchema = new Schema<IAppSetting>(
  {
    key:   { type: String, required: true, unique: true, trim: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

const AppSetting: Model<IAppSetting> =
  mongoose.models.AppSetting ??
  mongoose.model<IAppSetting>("AppSetting", AppSettingSchema);

export default AppSetting;

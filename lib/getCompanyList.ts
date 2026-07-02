import { connectDB } from "./mongodb";
import AppSetting from "@/models/AppSetting";
import { COMPANIES } from "./constants";

export async function getCompanyList(): Promise<string[]> {
  await connectDB();
  const doc = await AppSetting.findOne({ key: "companies" }).lean();
  const value = doc?.value;
  if (Array.isArray(value) && value.every((c) => typeof c === "string")) {
    return value as string[];
  }
  return [...COMPANIES];
}

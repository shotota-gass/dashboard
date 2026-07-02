import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Log from "@/models/Log";
import User from "@/models/User";
import { requireRole } from "@/lib/apiHelpers";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(["admin", "computer_operator"]);
  if (error) return error;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const page = parseInt(searchParams.get("page") ?? "1");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const user = searchParams.get("user");
  const limit = 30;

  const filter: Record<string, unknown> = {};
  if (type && ["daily_count", "system"].includes(type)) filter.type = type;
  if (dateFrom || dateTo) {
    filter.date = {};
    if (dateFrom) (filter.date as Record<string, unknown>).$gte = new Date(dateFrom);
    if (dateTo) (filter.date as Record<string, unknown>).$lte = new Date(dateTo + "T23:59:59");
  }
  if (user) {
    const performer = await User.findOne({ userId: user }).lean();
    // No match: use a fresh ObjectId so the filter matches nothing, rather than
    // falling back to `null` which would incorrectly match system logs with no performer.
    filter.performedBy = performer?._id ?? new mongoose.Types.ObjectId();
  }

  const logs = await Log.find(filter)
    .sort({ date: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("performedBy", "userId role")
    .lean();

  const total = await Log.countDocuments(filter);

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) });
}

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireRole } from "@/lib/apiHelpers";
import mongoose from "mongoose";

const COLLECTIONS = [
  "customers", "invoices", "payments", "sales",
  "stockentries", "stockmovements", "logs",
  "branches", "employees", "appsettings", "users",
];

// GET /api/settings/database — collection counts
export async function GET() {
  const { error } = await requireRole(["admin"]);
  if (error) return error;

  await connectDB();
  const db = mongoose.connection.db!;

  const stats = await Promise.all(
    COLLECTIONS.map(async (col) => {
      try {
        const count = await db.collection(col).countDocuments();
        return { collection: col, count };
      } catch {
        return { collection: col, count: 0 };
      }
    })
  );

  return NextResponse.json({ stats });
}

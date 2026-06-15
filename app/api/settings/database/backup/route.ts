import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireRole } from "@/lib/apiHelpers";
import mongoose from "mongoose";

const COLLECTIONS = [
  "users", "employees", "branches", "appsettings",
  "customers", "invoices", "payments", "sales",
  "stockentries", "stockmovements", "logs",
];

// GET /api/settings/database/backup — full JSON dump
export async function GET() {
  const { error } = await requireRole(["admin"]);
  if (error) return error;

  await connectDB();
  const db = mongoose.connection.db!;

  const backup: Record<string, unknown[]> = {};
  for (const col of COLLECTIONS) {
    try {
      backup[col] = await db.collection(col).find({}).toArray();
    } catch {
      backup[col] = [];
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename  = `shotota-gas-backup-${timestamp}.json`;

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

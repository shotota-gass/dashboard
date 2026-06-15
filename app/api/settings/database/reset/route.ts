import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireRole, writeLog } from "@/lib/apiHelpers";
import mongoose from "mongoose";

// Collections wiped on reset — users, employees, branches, appsettings are preserved
const WIPE_COLLECTIONS = [
  "customers", "invoices", "payments", "sales",
  "stockentries", "stockmovements", "logs",
];

// POST /api/settings/database/reset — wipe operational data, keep users/config
export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(["admin"]);
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "RESET") {
    return NextResponse.json(
      { error: 'Send { "confirm": "RESET" } to confirm.' },
      { status: 400 }
    );
  }

  await connectDB();
  const db = mongoose.connection.db!;

  const results: Record<string, number> = {};
  for (const col of WIPE_COLLECTIONS) {
    try {
      const res = await db.collection(col).deleteMany({});
      results[col] = res.deletedCount;
    } catch {
      results[col] = -1;
    }
  }

  await writeLog(
    "system",
    "Database reset performed — operational data wiped, users and config preserved.",
    session!.user.id,
    { wiped: results }
  );

  return NextResponse.json({ ok: true, wiped: results });
}

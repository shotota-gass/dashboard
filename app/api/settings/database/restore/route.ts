import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireRole, writeLog } from "@/lib/apiHelpers";
import mongoose from "mongoose";

const COLLECTIONS = [
  "users", "employees", "branches", "appsettings",
  "customers", "invoices", "payments", "sales",
  "stockentries", "stockmovements", "logs",
];

// The backup endpoint plain-JSON.stringify's native driver documents, which turns
// ObjectId/Date values into bare strings. Revive them so restored docs keep the
// right BSON types (population, date-range queries, etc. depend on it).
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

function revive(value: unknown): unknown {
  if (typeof value === "string") {
    if (OBJECT_ID_RE.test(value)) return new mongoose.Types.ObjectId(value);
    if (ISO_DATE_RE.test(value)) return new Date(value);
    return value;
  }
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, revive(v)]));
  }
  return value;
}

// POST /api/settings/database/restore — replace collections from a backup JSON dump
export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(["admin"]);
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "RESTORE") {
    return NextResponse.json(
      { error: 'Send { "confirm": "RESTORE" } to confirm.' },
      { status: 400 }
    );
  }

  const data = body.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json({ error: "Missing or invalid backup data." }, { status: 400 });
  }

  await connectDB();
  const db = mongoose.connection.db!;

  const results: Record<string, number> = {};
  for (const col of COLLECTIONS) {
    const rows = data[col];
    if (!Array.isArray(rows)) continue;
    try {
      await db.collection(col).deleteMany({});
      if (rows.length > 0) await db.collection(col).insertMany(rows.map(revive) as object[]);
      results[col] = rows.length;
    } catch {
      results[col] = -1;
    }
  }

  await writeLog(
    "system",
    "Database restored from backup",
    session!.user.id,
    { restored: results }
  );

  return NextResponse.json({ ok: true, restored: results });
}

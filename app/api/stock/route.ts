import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import StockEntry from "@/models/StockEntry";
import { requireRole, writeLog } from "@/lib/apiHelpers";
import { KG_SIZES } from "@/lib/constants";
import { getCompanyList } from "@/lib/getCompanyList";

// GET /api/stock — aggregate view grouped by kgSize → status → company
export async function GET() {
  const { error } = await requireRole(["admin", "computer_operator", "customer_care_executive"]);
  if (error) return error;

  await connectDB();
  const entries = await StockEntry.find({}).lean();

  // Build grouped structure
  const grouped: Record<number, { full: Record<string, number>; empty: Record<string, number> }> = {};
  for (const kg of KG_SIZES) {
    grouped[kg] = { full: {}, empty: {} };
  }

  for (const e of entries) {
    const kg = e.kgSize as number;
    const status = e.status as "full" | "empty";
    const company = e.company as string;
    if (!grouped[kg]) continue;
    grouped[kg][status][company] = (grouped[kg][status][company] ?? 0) + e.quantity;
  }

  return NextResponse.json({ grouped, entries });
}

// POST /api/stock — add or update a stock entry
export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(["admin", "computer_operator"]);
  if (error) return error;

  const body = await req.json();
  const { kgSize, company, status, quantity, note } = body;

  const companies = await getCompanyList();
  if (!KG_SIZES.includes(kgSize) || !companies.includes(company) || !["full", "empty"].includes(status) || typeof quantity !== "number" || quantity < 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await connectDB();
  const entry = await StockEntry.create({
    kgSize,
    company,
    status,
    quantity,
    note,
    recordedBy: session!.user.id,
    date: new Date(),
  });

  await writeLog("system", `Stock entry added: ${quantity}x ${kgSize}kg ${company} (${status})`, session!.user.id, { entryId: entry._id });

  return NextResponse.json(entry, { status: 201 });
}

// PUT /api/stock/:id — update an entry
export async function PUT(req: NextRequest) {
  const { error, session } = await requireRole(["admin", "computer_operator"]);
  if (error) return error;

  const body = await req.json();
  const { id, quantity, note } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (quantity !== undefined && (typeof quantity !== "number" || quantity < 0)) {
    return NextResponse.json({ error: "Quantity must be a non-negative number" }, { status: 400 });
  }

  await connectDB();
  const entry = await StockEntry.findByIdAndUpdate(id, { quantity, note }, { new: true });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await writeLog("system", `Stock entry updated: ${entry._id}`, session!.user.id, { quantity });

  return NextResponse.json(entry);
}

// DELETE /api/stock
export async function DELETE(req: NextRequest) {
  const { error, session } = await requireRole(["admin"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await connectDB();
  await StockEntry.findByIdAndDelete(id);
  await writeLog("system", `Stock entry deleted: ${id}`, session!.user.id);

  return NextResponse.json({ success: true });
}

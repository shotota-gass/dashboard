import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import StockMovement, { MovementType } from "@/models/StockMovement";
import { requireRole, writeLog } from "@/lib/apiHelpers";
import { KG_SIZES, COMPANIES } from "@/lib/constants";

const MOVEMENT_FULL_DELTA: Record<MovementType, 1 | -1 | 0> = {
  receive_full:     1,
  sell:            -1,
  return_empty:     0,
  send_refill:      0,
  receive_refilled: 1,
  adjustment:       0,
  transfer_out:    -1,
  transfer_in:      1,
};

const MOVEMENT_EMPTY_DELTA: Record<MovementType, 1 | -1 | 0> = {
  receive_full:     0,
  sell:             0,
  return_empty:     1,
  send_refill:     -1,
  receive_refilled: 0,
  adjustment:       0,
  transfer_out:     0,
  transfer_in:      0,
};

export async function GET(req: NextRequest) {
  const { error } = await requireRole(["admin", "computer_operator", "customer_care_executive"]);
  if (error) return error;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page   = parseInt(searchParams.get("page") ?? "1");
  const limit  = 30;
  const type   = searchParams.get("type") ?? "";
  const kg     = searchParams.get("kg") ?? "";
  const company = searchParams.get("company") ?? "";
  const from   = searchParams.get("from") ?? "";
  const to     = searchParams.get("to") ?? "";

  const filter: Record<string, unknown> = {};
  if (type)    filter.type    = type;
  if (kg)      filter.kgSize  = Number(kg);
  if (company) filter.company = company;
  if (from || to) {
    filter.date = {};
    if (from) (filter.date as Record<string, unknown>).$gte = new Date(from);
    if (to)   (filter.date as Record<string, unknown>).$lte = new Date(to + "T23:59:59.999Z");
  }

  const [movements, total] = await Promise.all([
    StockMovement.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("recordedBy", "userId role")
      .lean(),
    StockMovement.countDocuments(filter),
  ]);

  // Compute current stock balance across all movements (no filter — full ledger)
  const allMovements = await StockMovement.find({}).lean();
  const balance: Record<string, Record<string, { full: number; empty: number }>> = {};
  for (const m of allMovements) {
    const key = `${m.kgSize}`;
    if (!balance[key]) balance[key] = {};
    if (!balance[key][m.company]) balance[key][m.company] = { full: 0, empty: 0 };
    balance[key][m.company].full  += m.fullDelta;
    balance[key][m.company].empty += m.emptyDelta;
  }

  return NextResponse.json({ movements, total, page, pages: Math.ceil(total / limit), balance });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(["admin", "computer_operator"]);
  if (error) return error;

  const body = await req.json();
  const { type, kgSize, company, quantity, note, fullDelta: manualFull, emptyDelta: manualEmpty } = body;

  const validTypes: MovementType[] = ["receive_full", "return_empty", "send_refill", "receive_refilled", "adjustment"];
  if (!validTypes.includes(type)) return NextResponse.json({ error: "Invalid movement type" }, { status: 400 });
  if (!KG_SIZES.includes(kgSize)) return NextResponse.json({ error: "Invalid kg size" }, { status: 400 });
  if (!COMPANIES.includes(company)) return NextResponse.json({ error: "Invalid company" }, { status: 400 });
  if (typeof quantity !== "number" || quantity < 1) return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });

  let fullDelta: number;
  let emptyDelta: number;

  if (type === "adjustment") {
    fullDelta  = typeof manualFull  === "number" ? manualFull  : 0;
    emptyDelta = typeof manualEmpty === "number" ? manualEmpty : 0;
  } else {
    fullDelta  = MOVEMENT_FULL_DELTA[type as MovementType]  * quantity;
    emptyDelta = MOVEMENT_EMPTY_DELTA[type as MovementType] * quantity;
  }

  await connectDB();
  const movement = await StockMovement.create({
    type, kgSize, company, quantity, fullDelta, emptyDelta,
    note, recordedBy: session!.user.id, date: new Date(),
  });

  const labels: Record<MovementType, string> = {
    receive_full:     "Received full",
    sell:             "Sold",
    return_empty:     "Customer returned empty",
    send_refill:      "Sent for refill",
    receive_refilled: "Received refilled",
    adjustment:       "Adjusted stock",
    transfer_out:     "Transferred out",
    transfer_in:      "Transferred in",
  };
  await writeLog("system", `${labels[type as MovementType]}: ${quantity}x ${kgSize}kg ${company}`, session!.user.id, { movementId: movement._id });

  return NextResponse.json(movement, { status: 201 });
}

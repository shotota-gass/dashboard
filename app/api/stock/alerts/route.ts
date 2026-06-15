import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import StockEntry from "@/models/StockEntry";
import { requireRole } from "@/lib/apiHelpers";

const LOW_STOCK_THRESHOLD = 5;

// GET /api/stock/alerts — returns count of low-stock kg+company combos
export async function GET() {
  const { error } = await requireRole(["admin", "computer_operator", "customer_care_executive"]);
  if (error) return error;

  await connectDB();
  const entries = await StockEntry.find({ status: "full" }).lean();

  // Aggregate full stock per kg+company
  const totals: Record<string, number> = {};
  for (const e of entries) {
    const key = `${e.kgSize}-${e.company}`;
    totals[key] = (totals[key] ?? 0) + e.quantity;
  }

  const lowStockItems = Object.entries(totals)
    .filter(([, qty]) => qty < LOW_STOCK_THRESHOLD)
    .map(([key, qty]) => {
      const [kgSize, ...companyParts] = key.split("-");
      return { kgSize: Number(kgSize), company: companyParts.join("-"), qty };
    });

  return NextResponse.json({ lowStockCount: lowStockItems.length, lowStockItems });
}

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Sale from "@/models/Sale";
import StockEntry from "@/models/StockEntry";
import Customer from "@/models/Customer";
import Employee from "@/models/Employee";
import Log from "@/models/Log";
import { requireAuth } from "@/lib/apiHelpers";
import { subDays, startOfDay, format } from "date-fns";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();

  const now = new Date();
  const todayStart = startOfDay(now);
  const thirtyDaysAgo = subDays(now, 30);
  const sevenDaysAgo = subDays(now, 7);

  const [
    totalCustomers,
    totalEmployees,
    todaySales,
    monthlySales,
    stockEntries,
    recentLogs,
    salesLast30Days,
    topCompanies,
    salesByType,
    weekdaySales,
  ] = await Promise.all([
    Customer.countDocuments(),
    Employee.countDocuments(),
    Sale.aggregate([
      { $match: { date: { $gte: todayStart } } },
      { $group: { _id: null, count: { $sum: "$quantity" }, revenue: { $sum: 1 } } },
    ]),
    Sale.aggregate([
      { $match: { date: { $gte: thirtyDaysAgo } } },
      { $group: { _id: null, count: { $sum: "$quantity" } } },
    ]),
    StockEntry.aggregate([
      { $group: { _id: { kgSize: "$kgSize", status: "$status" }, total: { $sum: "$quantity" } } },
    ]),
    Log.find({}).sort({ date: -1 }).limit(8).populate("performedBy", "userId").lean(),
    // Daily sales trend last 30 days
    Sale.aggregate([
      { $match: { date: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          count: { $sum: "$quantity" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    // Top companies by sales
    Sale.aggregate([
      { $match: { date: { $gte: thirtyDaysAgo } } },
      { $group: { _id: "$company", total: { $sum: "$quantity" } } },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]),
    // Sales by type
    Sale.aggregate([
      { $match: { date: { $gte: thirtyDaysAgo } } },
      { $group: { _id: "$type", total: { $sum: "$quantity" } } },
    ]),
    // Sales by weekday (last 7 days)
    Sale.aggregate([
      { $match: { date: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          count: { $sum: "$quantity" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  // Build full 30-day array (fill missing days with 0)
  const salesMap: Record<string, number> = {};
  for (const s of salesLast30Days) salesMap[s._id] = s.count;
  const dailyTrend = [];
  for (let i = 29; i >= 0; i--) {
    const d = format(subDays(now, i), "yyyy-MM-dd");
    dailyTrend.push({ date: d, count: salesMap[d] ?? 0 });
  }

  // Stock summary
  const stockSummary: Record<string, { full: number; empty: number }> = {};
  for (const s of stockEntries) {
    const key = `${s._id.kgSize}kg`;
    if (!stockSummary[key]) stockSummary[key] = { full: 0, empty: 0 };
    stockSummary[key][s._id.status as "full" | "empty"] += s.total;
  }

  return NextResponse.json({
    kpis: {
      totalCustomers,
      totalEmployees,
      todaySalesQty: todaySales[0]?.count ?? 0,
      monthlySalesQty: monthlySales[0]?.count ?? 0,
    },
    dailyTrend,
    weekdaySales,
    topCompanies,
    salesByType,
    stockSummary,
    recentLogs,
  });
}

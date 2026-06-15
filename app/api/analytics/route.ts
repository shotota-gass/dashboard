import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Sale from "@/models/Sale";
import StockEntry from "@/models/StockEntry";
import Customer from "@/models/Customer";
import Log from "@/models/Log";
import { requireAuth } from "@/lib/apiHelpers";
import { subDays, startOfDay, format, eachDayOfInterval } from "date-fns";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();

  const { searchParams } = new URL(req.url);
  const range = parseInt(searchParams.get("range") ?? "30");
  const validRange = [7, 30, 90].includes(range) ? range : 30;

  const now = new Date();
  const periodStart = subDays(now, validRange);
  const priorStart = subDays(now, validRange * 2);
  const todayStart = startOfDay(now);

  const [
    // KPI counts
    totalCustomers,
    currentPeriodSales,
    priorPeriodSales,
    todaySales,
    // Sales breakdowns
    salesByEmployee,
    salesByPackage,
    salesByCompany,
    salesByType,
    // Daily trend
    dailySalesTrend,
    // Stock data
    stockEntries,
    stockMovement,
    // Customer growth
    customerGrowth,
    // Activity
    recentLogs,
  ] = await Promise.all([
    Customer.countDocuments(),

    // Current period total
    Sale.aggregate([
      { $match: { date: { $gte: periodStart } } },
      { $group: { _id: null, qty: { $sum: "$quantity" }, count: { $sum: 1 } } },
    ]),

    // Prior period total (for % comparison)
    Sale.aggregate([
      { $match: { date: { $gte: priorStart, $lt: periodStart } } },
      { $group: { _id: null, qty: { $sum: "$quantity" }, count: { $sum: 1 } } },
    ]),

    // Today's sales
    Sale.aggregate([
      { $match: { date: { $gte: todayStart } } },
      { $group: { _id: null, qty: { $sum: "$quantity" }, count: { $sum: 1 } } },
    ]),

    // Sales by employee
    Sale.aggregate([
      { $match: { date: { $gte: periodStart } } },
      { $group: { _id: "$soldBy", total: { $sum: "$quantity" }, txns: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          total: 1,
          txns: 1,
          userId: "$user.userId",
          role: "$user.role",
        },
      },
    ]),

    // Sales by package size
    Sale.aggregate([
      { $match: { date: { $gte: periodStart } } },
      { $group: { _id: "$packageKg", total: { $sum: "$quantity" } } },
      { $sort: { _id: 1 } },
    ]),

    // Sales by company (top 10)
    Sale.aggregate([
      { $match: { date: { $gte: periodStart } } },
      { $group: { _id: "$company", total: { $sum: "$quantity" } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]),

    // Sales by type
    Sale.aggregate([
      { $match: { date: { $gte: periodStart } } },
      { $group: { _id: "$type", total: { $sum: "$quantity" } } },
    ]),

    // Daily sales trend (full range)
    Sale.aggregate([
      { $match: { date: { $gte: periodStart } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          qty: { $sum: "$quantity" },
          txns: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Stock entries grouped
    StockEntry.aggregate([
      { $group: { _id: { kgSize: "$kgSize", status: "$status" }, total: { $sum: "$quantity" } } },
    ]),

    // Stock movement over time
    StockEntry.aggregate([
      { $match: { date: { $gte: periodStart } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            status: "$status",
          },
          total: { $sum: "$quantity" },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]),

    // Customer registrations per day
    Customer.aggregate([
      { $match: { createdAt: { $gte: periodStart } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Recent logs
    Log.find({})
      .sort({ date: -1 })
      .limit(15)
      .populate("performedBy", "userId role")
      .lean(),
  ]);

  // Build filled daily trend array
  const days = eachDayOfInterval({ start: periodStart, end: now });
  const salesMap: Record<string, { qty: number; txns: number }> = {};
  for (const s of dailySalesTrend) salesMap[s._id] = { qty: s.qty, txns: s.txns };
  const dailyTrend = days.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return { date: key, qty: salesMap[key]?.qty ?? 0, txns: salesMap[key]?.txns ?? 0 };
  });

  // Build filled customer growth array
  const custMap: Record<string, number> = {};
  for (const c of customerGrowth) custMap[c._id] = c.count;
  const customerGrowthFilled = days.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return { date: key, count: custMap[key] ?? 0 };
  });

  // Stock summary
  const stockSummary: Record<string, { full: number; empty: number }> = {};
  for (const s of stockEntries) {
    const key = `${s._id.kgSize}kg`;
    if (!stockSummary[key]) stockSummary[key] = { full: 0, empty: 0 };
    stockSummary[key][s._id.status as "full" | "empty"] += s.total;
  }

  // Stock movement by date
  const stockMovementMap: Record<string, { full: number; empty: number }> = {};
  for (const s of stockMovement) {
    const key = s._id.date;
    if (!stockMovementMap[key]) stockMovementMap[key] = { full: 0, empty: 0 };
    stockMovementMap[key][s._id.status as "full" | "empty"] += s.total;
  }
  const stockMovementFilled = days.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return { date: key, full: stockMovementMap[key]?.full ?? 0, empty: stockMovementMap[key]?.empty ?? 0 };
  });

  // Period comparison %
  const currentQty = currentPeriodSales[0]?.qty ?? 0;
  const priorQty = priorPeriodSales[0]?.qty ?? 0;
  const salesChangePct = priorQty === 0 ? null : Math.round(((currentQty - priorQty) / priorQty) * 100);

  const currentTxns = currentPeriodSales[0]?.count ?? 0;
  const priorTxns = priorPeriodSales[0]?.count ?? 0;
  const txnsChangePct = priorTxns === 0 ? null : Math.round(((currentTxns - priorTxns) / priorTxns) * 100);

  const newCustomers = customerGrowth.reduce((a, c) => a + c.count, 0);

  return NextResponse.json({
    range: validRange,
    kpis: {
      totalCustomers,
      newCustomers,
      todaySalesQty: todaySales[0]?.qty ?? 0,
      todaySalesTxns: todaySales[0]?.count ?? 0,
      periodSalesQty: currentQty,
      periodSalesTxns: currentTxns,
      salesChangePct,
      txnsChangePct,
      totalFullStock: Object.values(stockSummary).reduce((a, v) => a + v.full, 0),
      totalEmptyStock: Object.values(stockSummary).reduce((a, v) => a + v.empty, 0),
    },
    dailyTrend,
    salesByEmployee,
    salesByPackage,
    salesByCompany,
    salesByType,
    stockSummary,
    stockMovement: stockMovementFilled,
    customerGrowth: customerGrowthFilled,
    recentLogs,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Sale from "@/models/Sale";
import StockMovement from "@/models/StockMovement";
import Customer from "@/models/Customer";
import { requireRole } from "@/lib/apiHelpers";

// GET /api/reports?type=daily|sales|stock|dues|summary
export async function GET(req: NextRequest) {
  const { error } = await requireRole(["admin", "computer_operator", "customer_care_executive"]);
  if (error) return error;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "summary";
  const from = searchParams.get("from") ?? "";
  const to   = searchParams.get("to")   ?? "";
  const date = searchParams.get("date") ?? "";

  switch (type) {
    case "daily":   return dailyReport(date);
    case "sales":   return salesReport(from, to);
    case "stock":   return stockReport();
    case "dues":    return duesReport();
    case "summary": return summaryReport();
    default:        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  }
}

// ─── Daily Report ─────────────────────────────────────────────────────────────
async function dailyReport(dateStr: string) {
  const day = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(day); start.setHours(0, 0, 0, 0);
  const end   = new Date(day); end.setHours(23, 59, 59, 999);

  const [sales, movements] = await Promise.all([
    Sale.find({ date: { $gte: start, $lte: end } })
      .populate("soldBy", "userId role")
      .populate("customerRef", "userId fullName")
      .lean(),
    StockMovement.find({ date: { $gte: start, $lte: end } })
      .populate("recordedBy", "userId role")
      .lean(),
  ]);

  // Aggregate daily totals
  const totalQty = sales.reduce((s, x) => s + x.quantity, 0);
  const totalTxns = sales.length;

  const byType: Record<string, { qty: number; txns: number }> = {};
  const byCompany: Record<string, number> = {};
  const bySize: Record<number, number>   = {};
  const byEmployee: Record<string, { qty: number; txns: number; userId: string }> = {};

  for (const s of sales) {
    byType[s.type] = byType[s.type] ?? { qty: 0, txns: 0 };
    byType[s.type].qty  += s.quantity;
    byType[s.type].txns += 1;

    byCompany[s.company] = (byCompany[s.company] ?? 0) + s.quantity;
    bySize[s.packageKg]  = (bySize[s.packageKg]  ?? 0) + s.quantity;

    const emp = (s.soldBy as Record<string, string> | null)?.userId ?? "unknown";
    const empId = String((s.soldBy as { _id?: unknown } | null)?._id ?? "unknown");
    byEmployee[empId] = byEmployee[empId] ?? { qty: 0, txns: 0, userId: emp };
    byEmployee[empId].qty  += s.quantity;
    byEmployee[empId].txns += 1;
  }

  // Movement summary for the day
  const movSummary = { received: 0, returned: 0, sentRefill: 0, adjustments: 0 };
  for (const m of movements) {
    if (m.type === "receive_full" || m.type === "receive_refilled") movSummary.received  += m.quantity;
    if (m.type === "return_empty")  movSummary.returned   += m.quantity;
    if (m.type === "send_refill")   movSummary.sentRefill += m.quantity;
    if (m.type === "adjustment")    movSummary.adjustments++;
  }

  return NextResponse.json({
    date: start.toISOString(),
    totalQty,
    totalTxns,
    byType,
    byCompany,
    bySize,
    byEmployee: Object.values(byEmployee),
    sales,
    movements,
    movSummary,
  });
}

// ─── Sales Report ─────────────────────────────────────────────────────────────
async function salesReport(from: string, to: string) {
  const filter: Record<string, unknown> = {};
  if (from || to) {
    filter.date = {};
    if (from) (filter.date as Record<string, unknown>).$gte = new Date(from);
    if (to)   (filter.date as Record<string, unknown>).$lte = new Date(to + "T23:59:59.999Z");
  }

  const sales = await Sale.find(filter)
    .populate("soldBy", "userId role")
    .populate("customerRef", "userId fullName")
    .lean();

  const totalQty  = sales.reduce((s, x) => s + x.quantity, 0);
  const totalTxns = sales.length;

  // Breakdowns
  const byType: Record<string, { qty: number; txns: number }> = {};
  const byCompany: Record<string, number> = {};
  const bySize: Record<number, number>    = {};
  const byEmployee: Record<string, { qty: number; txns: number; userId: string }> = {};
  const dailyMap: Record<string, number>  = {};

  for (const s of sales) {
    byType[s.type] = byType[s.type] ?? { qty: 0, txns: 0 };
    byType[s.type].qty  += s.quantity;
    byType[s.type].txns += 1;

    byCompany[s.company] = (byCompany[s.company] ?? 0) + s.quantity;
    bySize[s.packageKg]  = (bySize[s.packageKg]  ?? 0) + s.quantity;

    const empId  = String((s.soldBy as { _id?: unknown } | null)?._id ?? "unknown");
    const userId = (s.soldBy as Record<string, string> | null)?.userId ?? "unknown";
    byEmployee[empId] = byEmployee[empId] ?? { qty: 0, txns: 0, userId };
    byEmployee[empId].qty  += s.quantity;
    byEmployee[empId].txns += 1;

    const day = new Date(s.date).toISOString().slice(0, 10);
    dailyMap[day] = (dailyMap[day] ?? 0) + s.quantity;
  }

  const dailyTrend = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, qty]) => ({ date, qty }));

  return NextResponse.json({
    totalQty,
    totalTxns,
    byType,
    byCompany: Object.entries(byCompany)
      .sort(([, a], [, b]) => b - a)
      .map(([company, qty]) => ({ company, qty })),
    bySize: Object.entries(bySize)
      .map(([size, qty]) => ({ size: Number(size), qty }))
      .sort((a, b) => a.size - b.size),
    byEmployee: Object.values(byEmployee).sort((a, b) => b.qty - a.qty),
    dailyTrend,
    sales,
  });
}

// ─── Stock Report ─────────────────────────────────────────────────────────────
async function stockReport() {
  const movements = await StockMovement.find({}).lean();

  // Compute current balance per kg+company
  const balance: Record<string, Record<string, { full: number; empty: number }>> = {};
  for (const m of movements) {
    const kg = String(m.kgSize);
    if (!balance[kg]) balance[kg] = {};
    if (!balance[kg][m.company]) balance[kg][m.company] = { full: 0, empty: 0 };
    balance[kg][m.company].full  += m.fullDelta;
    balance[kg][m.company].empty += m.emptyDelta;
  }

  // Low stock alerts: any company+size with full < 5
  const alerts: { kgSize: number; company: string; full: number }[] = [];
  for (const [kg, companies] of Object.entries(balance)) {
    for (const [company, counts] of Object.entries(companies)) {
      if (counts.full < 5 && counts.full >= 0) {
        alerts.push({ kgSize: Number(kg), company, full: counts.full });
      }
    }
  }
  alerts.sort((a, b) => a.full - b.full);

  // Totals
  let totalFull = 0, totalEmpty = 0;
  for (const companies of Object.values(balance)) {
    for (const counts of Object.values(companies)) {
      totalFull  += Math.max(0, counts.full);
      totalEmpty += Math.max(0, counts.empty);
    }
  }

  // Recent 30 movements
  const recentMovements = await StockMovement.find({})
    .sort({ date: -1 })
    .limit(30)
    .populate("recordedBy", "userId")
    .lean();

  return NextResponse.json({ balance, alerts, totalFull, totalEmpty, recentMovements });
}

// ─── Customer Dues Report ─────────────────────────────────────────────────────
async function duesReport() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueCustomers = await Customer.find({
    billPaidTill: { $lt: today },
  })
    .sort({ billPaidTill: 1 })
    .lean();

  const unpaidCustomers = await Customer.find({
    billPaidTill: null,
  }).lean();

  const dueThisMonth = await Customer.find({
    billPaidTill: {
      $gte: today,
      $lte: new Date(today.getFullYear(), today.getMonth() + 1, 0),
    },
  })
    .sort({ billPaidTill: 1 })
    .lean();

  return NextResponse.json({
    overdue: overdueCustomers,
    unpaid: unpaidCustomers,
    dueThisMonth,
    totalOverdue: overdueCustomers.length,
    totalUnpaid: unpaidCustomers.length,
  });
}

// ─── Summary Report ───────────────────────────────────────────────────────────
async function summaryReport() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today); todayEnd.setHours(23, 59, 59, 999);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const weekStart  = new Date(today); weekStart.setDate(today.getDate() - 6);

  const [
    todaySales, weekSales, monthSales,
    overdueCount, totalCustomers,
    movements,
  ] = await Promise.all([
    Sale.find({ date: { $gte: today, $lte: todayEnd } }).lean(),
    Sale.find({ date: { $gte: weekStart } }).lean(),
    Sale.find({ date: { $gte: monthStart } }).lean(),
    Customer.countDocuments({ billPaidTill: { $lt: today } }),
    Customer.countDocuments(),
    StockMovement.find({}).lean(),
  ]);

  // Stock balance
  const balance: Record<string, { full: number; empty: number }> = {};
  for (const m of movements) {
    const key = `${m.kgSize}kg`;
    if (!balance[key]) balance[key] = { full: 0, empty: 0 };
    balance[key].full  += m.fullDelta;
    balance[key].empty += m.emptyDelta;
  }

  // Last 7 days trend
  const last7: { date: string; qty: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const dEnd = new Date(d); dEnd.setHours(23, 59, 59, 999);
    const sales = await Sale.find({ date: { $gte: d, $lte: dEnd } }).lean();
    last7.push({ date: d.toISOString().slice(0, 10), qty: sales.reduce((s, x) => s + x.quantity, 0) });
  }

  return NextResponse.json({
    today: {
      qty: todaySales.reduce((s, x) => s + x.quantity, 0),
      txns: todaySales.length,
    },
    week: {
      qty: weekSales.reduce((s, x) => s + x.quantity, 0),
      txns: weekSales.length,
    },
    month: {
      qty: monthSales.reduce((s, x) => s + x.quantity, 0),
      txns: monthSales.length,
    },
    overdueCustomers: overdueCount,
    totalCustomers,
    stockBalance: balance,
    last7DaysTrend: last7,
  });
}

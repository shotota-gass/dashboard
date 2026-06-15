"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line,
} from "recharts";
import {
  FileText, TrendingUp, Package, Users, Download,
  AlertTriangle, CheckCircle, Calendar, ChevronDown,
  ShoppingCart, RefreshCw, Building2,
} from "lucide-react";
import { format, subDays } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "summary" | "daily" | "sales" | "stock" | "dues";

interface SummaryData {
  today: { qty: number; txns: number };
  week:  { qty: number; txns: number };
  month: { qty: number; txns: number };
  overdueCustomers: number;
  totalCustomers: number;
  stockBalance: Record<string, { full: number; empty: number }>;
  last7DaysTrend: { date: string; qty: number }[];
}

interface DailyData {
  date: string;
  totalQty: number;
  totalTxns: number;
  byType: Record<string, { qty: number; txns: number }>;
  byCompany: Record<string, number>;
  bySize: Record<number, number>;
  byEmployee: { userId: string; qty: number; txns: number }[];
  movSummary: { received: number; returned: number; sentRefill: number; adjustments: number };
  sales: Sale[];
  movements: Movement[];
}

interface SalesData {
  totalQty: number;
  totalTxns: number;
  byType: Record<string, { qty: number; txns: number }>;
  byCompany: { company: string; qty: number }[];
  bySize: { size: number; qty: number }[];
  byEmployee: { userId: string; qty: number; txns: number }[];
  dailyTrend: { date: string; qty: number }[];
}

interface StockData {
  balance: Record<string, Record<string, { full: number; empty: number }>>;
  alerts: { kgSize: number; company: string; full: number }[];
  totalFull: number;
  totalEmpty: number;
}

interface DuesData {
  overdue: Customer[];
  unpaid: Customer[];
  dueThisMonth: Customer[];
  totalOverdue: number;
  totalUnpaid: number;
}

interface Sale {
  _id: string; date: string; type: string; packageKg: number; company: string;
  quantity: number; notes?: string;
  soldBy?: { userId: string };
  customerRef?: { userId: string; fullName: string };
}
interface Movement {
  _id: string; date: string; type: string; kgSize: number; company: string;
  quantity: number; fullDelta: number; emptyDelta: number; note?: string;
  recordedBy?: { userId: string };
}
interface Customer {
  _id: string; userId: string; fullName: string; contact: string; packageType: number;
  billPaidTill?: string; address: { area: string; road: string; houseFlat: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CHART_COLORS = ["#1e40af","#4338ca","#6d28d9","#7c3aed","#9333ea","#2563eb","#0284c7","#0369a1","#1d4ed8","#3730a3"];

const TYPE_LABELS: Record<string, string> = { package: "Package", refill: "Refill", bottle: "Bottle" };
const MOV_LABELS: Record<string, string> = {
  receive_full: "Received Full", sell: "Sale (auto)", return_empty: "Empty Returned",
  send_refill: "Sent for Refill", receive_refilled: "Received Refilled", adjustment: "Adjustment",
};
const MOV_COLORS: Record<string, string> = {
  receive_full: "text-gray-900 bg-black/10 border-gray-300",
  sell: "text-gray-600 bg-gray-100 border-gray-200",
  return_empty: "text-gray-800 bg-gray-200 border-gray-300",
  send_refill: "text-gray-700 bg-gray-150 border-gray-300",
  receive_refilled: "text-gray-900 bg-gray-100 border-gray-300",
  adjustment: "text-gray-700 bg-gray-100 border-gray-200",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const inputCls = "px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-slate-500";

function kv(label: string, value: string | number, sub?: string) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">{children}</p>;
}

function exportCSV(rows: (string | number)[][], filename: string) {
  const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename; a.click();
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "summary", label: "Summary",        icon: TrendingUp  },
  { id: "daily",   label: "Daily Report",   icon: Calendar    },
  { id: "sales",   label: "Sales Report",   icon: ShoppingCart},
  { id: "stock",   label: "Stock Report",   icon: Package     },
  { id: "dues",    label: "Customer Dues",  icon: Users       },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("summary");

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Business intelligence, inventory reports, and customer dues</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-2xl p-1 mb-6 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              activeTab === t.id
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-white"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "summary" && <SummaryTab />}
      {activeTab === "daily"   && <DailyTab />}
      {activeTab === "sales"   && <SalesTab />}
      {activeTab === "stock"   && <StockTab />}
      {activeTab === "dues"    && <DuesTab />}
    </div>
  );
}

// ─── Summary Tab ──────────────────────────────────────────────────────────────
function SummaryTab() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports?type=summary").then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (!data) return <ErrorState />;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kv("Today's Sales", data.today.qty, `${data.today.txns} transactions`)}
        {kv("This Week", data.week.qty, `${data.week.txns} transactions`)}
        {kv("This Month", data.month.qty, `${data.month.txns} transactions`)}
        {kv("Overdue Customers", data.overdueCustomers, `of ${data.totalCustomers} total`)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 7-day trend */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <SectionTitle>Last 7 Days — Cylinders Sold</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.last7DaysTrend} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={v => format(new Date(v), "EEE d")} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip formatter={(v: number) => [`${v} cylinders`, "Sold"]} contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 12 }} />
              <Line type="monotone" dataKey="qty" stroke="#1e40af" strokeWidth={2} dot={{ r: 3, fill: "#1e40af" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stock balance */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <SectionTitle>Current Stock (Movement Ledger)</SectionTitle>
          {Object.keys(data.stockBalance).length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No stock movements recorded yet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(data.stockBalance).map(([size, counts]) => {
                const total = Math.max(0, counts.full) + Math.max(0, counts.empty);
                const pct = total > 0 ? Math.round((Math.max(0, counts.full) / total) * 100) : 0;
                return (
                  <div key={size}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-900">{size}</span>
                      <span className="text-xs text-slate-500">Full {Math.max(0, counts.full)} / Empty {Math.max(0, counts.empty)}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full">
                      <div className="h-2 rounded-full bg-black transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Daily Tab ────────────────────────────────────────────────────────────────
function DailyTab() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<"sales" | "movements" | null>("sales");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/reports?type=daily&date=${selectedDate}`)
      .then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, [selectedDate]);

  useEffect(() => { load(); }, [load]);

  function printReport() { window.print(); }

  function exportReport() {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["Daily Report", format(new Date(selectedDate), "d MMMM yyyy"), "", ""],
      ["", "", "", ""],
      ["Total Cylinders Sold", data.totalQty, "Total Transactions", data.totalTxns],
      ["", "", "", ""],
      ["Sale Type", "Cylinders", "Transactions", ""],
      ...Object.entries(data.byType).map(([t, v]) => [TYPE_LABELS[t] ?? t, v.qty, v.txns, ""]),
      ["", "", "", ""],
      ["Company", "Cylinders", "", ""],
      ...Object.entries(data.byCompany).map(([c, q]) => [c, q, "", ""]),
      ["", "", "", ""],
      ["Date", "Type", "Size", "Company", "Qty", "Employee", "Customer"],
      ...data.sales.map(s => [
        format(new Date(s.date), "d MMM yyyy HH:mm"),
        s.type, `${s.packageKg}kg`, s.company, s.quantity,
        s.soldBy?.userId ?? "", s.customerRef?.fullName ?? "",
      ]),
    ];
    exportCSV(rows, `daily-report-${selectedDate}.csv`);
  }

  return (
    <div className="space-y-5">
      {/* Date picker + controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Report Date</p>
          <input type="date" className={inputCls} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} max={format(new Date(), "yyyy-MM-dd")} />
        </div>
        <div className="flex gap-2">
          {[0,1,2].map(d => {
            const dt = format(subDays(new Date(), d), "yyyy-MM-dd");
            const label = d === 0 ? "Today" : d === 1 ? "Yesterday" : format(subDays(new Date(), d), "d MMM");
            return (
              <button key={d} onClick={() => setSelectedDate(dt)} className={`px-3 py-2 text-xs rounded-xl border transition-colors ${selectedDate === dt ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{label}</button>
            );
          })}
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={exportReport} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 shadow-sm"><Download size={13} /> Export CSV</button>
          <button onClick={printReport} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 shadow-sm"><FileText size={13} /> Print</button>
        </div>
      </div>

      {loading ? <LoadingSkeleton /> : !data ? <ErrorState /> : (
        <>
          {/* Date heading */}
          <div className="flex items-center gap-3 py-2 border-b border-slate-200">
            <Calendar size={16} className="text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">{format(new Date(data.date), "EEEE, d MMMM yyyy")}</h2>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kv("Cylinders Sold", data.totalQty)}
            {kv("Transactions", data.totalTxns)}
            {kv("Received", data.movSummary.received, "cylinders in")}
            {kv("Sent for Refill", data.movSummary.sentRefill, "empty out")}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* By type */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <SectionTitle>By Sale Type</SectionTitle>
              {Object.keys(data.byType).length === 0 ? <p className="text-sm text-slate-500">No sales</p> : (
                <div className="space-y-3">
                  {Object.entries(data.byType).map(([t, v]) => (
                    <div key={t} className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">{TYPE_LABELS[t] ?? t}</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-slate-900">{v.qty}</span>
                        <span className="text-xs text-slate-400 ml-1">({v.txns} txns)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By company */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <SectionTitle>By Company</SectionTitle>
              {Object.keys(data.byCompany).length === 0 ? <p className="text-sm text-slate-500">No sales</p> : (
                <div className="space-y-2">
                  {Object.entries(data.byCompany).sort(([,a],[,b]) => b-a).slice(0, 8).map(([c, q]) => (
                    <div key={c} className="flex items-center justify-between">
                      <span className="text-xs text-slate-700 truncate mr-2">{c}</span>
                      <span className="text-xs font-semibold text-slate-900 shrink-0">{q}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By employee */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <SectionTitle>By Employee</SectionTitle>
              {data.byEmployee.length === 0 ? <p className="text-sm text-slate-500">No data</p> : (
                <div className="space-y-2">
                  {data.byEmployee.map(e => (
                    <div key={e.userId} className="flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-700">{e.userId}</span>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-slate-900">{e.qty}</span>
                        <span className="text-xs text-slate-400 ml-1">({e.txns} txns)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sales list */}
          <CollapsibleSection
            title={`All Sales (${data.sales.length})`}
            expanded={expanded === "sales"}
            onToggle={() => setExpanded(expanded === "sales" ? null : "sales")}
          >
            {data.sales.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No sales on this date</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-100 bg-slate-50">
                    {["Time","Type","Size","Company","Qty","Employee","Customer","Notes"].map(h =>
                      <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    )}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.sales.map(s => (
                      <tr key={s._id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{format(new Date(s.date), "HH:mm")}</td>
                        <td className="px-3 py-2.5"><TypeBadge type={s.type} /></td>
                        <td className="px-3 py-2.5 font-medium text-slate-900">{s.packageKg}kg</td>
                        <td className="px-3 py-2.5 text-slate-700">{s.company}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-900">{s.quantity}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-500">{s.soldBy?.userId ?? "—"}</td>
                        <td className="px-3 py-2.5 text-slate-600">{s.customerRef?.fullName ?? "—"}</td>
                        <td className="px-3 py-2.5 text-slate-400">{s.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>

          {/* Movements list */}
          <CollapsibleSection
            title={`Stock Movements (${data.movements.length})`}
            expanded={expanded === "movements"}
            onToggle={() => setExpanded(expanded === "movements" ? null : "movements")}
          >
            {data.movements.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No stock movements on this date</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.movements.map(m => (
                  <div key={m._id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${MOV_COLORS[m.type] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>{MOV_LABELS[m.type] ?? m.type}</span>
                    <span className="text-xs font-medium text-slate-900">{m.quantity}x {m.kgSize}kg</span>
                    <span className="text-xs text-slate-600">{m.company}</span>
                    <span className="text-xs text-slate-400 flex-1">{m.note ?? ""}</span>
                    <span className="text-xs text-slate-400">{format(new Date(m.date), "HH:mm")}</span>
                    <span className="text-xs font-mono text-slate-500">{m.recordedBy?.userId ?? "sys"}</span>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>
        </>
      )}
    </div>
  );
}

// ─── Sales Tab ────────────────────────────────────────────────────────────────
function SalesTab() {
  const [from, setFrom] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [to,   setTo]   = useState(format(new Date(), "yyyy-MM-dd"));
  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/reports?type=sales&from=${from}&to=${to}`)
      .then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  function exportReport() {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["Sales Report", `${from} to ${to}`],
      ["Total Cylinders", data.totalQty, "Total Transactions", data.totalTxns],
      [""],
      ["By Type", "", ""],
      ...Object.entries(data.byType).map(([t, v]) => [TYPE_LABELS[t] ?? t, v.qty, v.txns]),
      [""],
      ["By Company", "Cylinders"],
      ...data.byCompany.map(c => [c.company, c.qty]),
      [""],
      ["By Employee", "Cylinders", "Transactions"],
      ...data.byEmployee.map(e => [e.userId, e.qty, e.txns]),
    ];
    exportCSV(rows, `sales-report-${from}-to-${to}.csv`);
  }

  const quickRanges = [
    { label: "Today",      from: format(new Date(), "yyyy-MM-dd"),              to: format(new Date(), "yyyy-MM-dd") },
    { label: "Last 7D",    from: format(subDays(new Date(), 6), "yyyy-MM-dd"),   to: format(new Date(), "yyyy-MM-dd") },
    { label: "Last 30D",   from: format(subDays(new Date(), 29), "yyyy-MM-dd"),  to: format(new Date(), "yyyy-MM-dd") },
    { label: "This Month", from: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"), to: format(new Date(), "yyyy-MM-dd") },
  ];

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">From</p>
          <input type="date" className={inputCls} value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">To</p>
          <input type="date" className={inputCls} value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {quickRanges.map(r => (
            <button key={r.label} onClick={() => { setFrom(r.from); setTo(r.to); }} className={`px-3 py-2 text-xs rounded-xl border transition-colors ${from === r.from && to === r.to ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{r.label}</button>
          ))}
        </div>
        <button onClick={exportReport} className="ml-auto flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 shadow-sm"><Download size={13} /> Export</button>
      </div>

      {loading ? <LoadingSkeleton /> : !data ? <ErrorState /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kv("Total Cylinders", data.totalQty)}
            {kv("Total Transactions", data.totalTxns)}
            {kv("Avg per Day", data.dailyTrend.length > 0 ? Math.round(data.totalQty / data.dailyTrend.length) : 0, "cylinders/day")}
            {kv("Top Company", data.byCompany[0]?.company.split(" ")[0] ?? "—", `${data.byCompany[0]?.qty ?? 0} cylinders`)}
          </div>

          {/* Daily trend chart */}
          {data.dailyTrend.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <SectionTitle>Daily Sales Trend</SectionTitle>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.dailyTrend} margin={{ top: 0, right: 5, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={v => format(new Date(v), data.dailyTrend.length > 14 ? "d MMM" : "d")} tickLine={false} axisLine={false} interval={Math.floor(data.dailyTrend.length / 7)} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [`${v}`, "Cylinders"]} contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="qty" fill="#1e40af" radius={[3, 3, 0, 0]} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* By type */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <SectionTitle>By Sale Type</SectionTitle>
              <div className="space-y-3">
                {Object.entries(data.byType).map(([t, v]) => {
                  const pct = data.totalQty > 0 ? Math.round((v.qty / data.totalQty) * 100) : 0;
                  return (
                    <div key={t}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-slate-700">{TYPE_LABELS[t] ?? t}</span>
                        <span className="text-sm font-semibold text-slate-900">{v.qty} <span className="text-slate-400 font-normal text-xs">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full"><div className="h-1.5 rounded-full bg-slate-800 transition-all" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* By size */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <SectionTitle>By Package Size</SectionTitle>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.bySize} margin={{ top: 0, right: 0, bottom: 0, left: -15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="size" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={v => `${v}kg`} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [`${v}`, "Cylinders"]} contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="qty" radius={[4, 4, 0, 0]}>
                    {data.bySize.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top companies */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <SectionTitle>Top Companies</SectionTitle>
              <div className="space-y-2">
                {data.byCompany.slice(0, 8).map((c, i) => {
                  const pct = data.totalQty > 0 ? Math.round((c.qty / data.totalQty) * 100) : 0;
                  return (
                    <div key={c.company} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 w-4 text-right">{i + 1}</span>
                      <span className="text-xs text-slate-700 flex-1 truncate">{c.company}</span>
                      <span className="text-xs font-semibold text-slate-900 w-8 text-right">{c.qty}</span>
                      <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Employee performance */}
          {data.byEmployee.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <SectionTitle>Employee Performance</SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-100 bg-slate-50">
                    {["#","Employee","Cylinders Sold","Transactions","Share"].map(h =>
                      <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    )}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.byEmployee.map((e, i) => {
                      const pct = data.totalQty > 0 ? Math.round((e.qty / data.totalQty) * 100) : 0;
                      return (
                        <tr key={e.userId} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                          <td className="px-3 py-2.5 font-mono font-medium text-slate-900">{e.userId}</td>
                          <td className="px-3 py-2.5 font-semibold text-slate-900">{e.qty}</td>
                          <td className="px-3 py-2.5 text-slate-600">{e.txns}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-200 rounded-full min-w-[60px]"><div className="h-1.5 rounded-full bg-slate-800" style={{ width: `${pct}%` }} /></div>
                              <span className="text-slate-500 w-8 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Stock Tab ────────────────────────────────────────────────────────────────
function StockTab() {
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports?type=stock").then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  function exportReport() {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["Stock Report", format(new Date(), "d MMMM yyyy")],
      ["Total Full", data.totalFull, "Total Empty", data.totalEmpty],
      [""],
      ["KG Size", "Company", "Full", "Empty"],
    ];
    for (const [kg, companies] of Object.entries(data.balance)) {
      for (const [company, counts] of Object.entries(companies)) {
        rows.push([`${kg}kg`, company, Math.max(0, counts.full), Math.max(0, counts.empty)]);
      }
    }
    exportCSV(rows, `stock-report-${format(new Date(), "yyyy-MM-dd")}.csv`);
  }

  if (loading) return <LoadingSkeleton />;
  if (!data) return <ErrorState />;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={exportReport} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 shadow-sm"><Download size={13} /> Export CSV</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kv("Total Full Cylinders", data.totalFull, "available to sell")}
        {kv("Total Empty Cylinders", data.totalEmpty, "to send for refill")}
        {kv("Low Stock Alerts", data.alerts.length, "items below 5 units")}
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="bg-gray-100 border border-gray-300 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-gray-700" />
            <p className="text-sm font-semibold text-gray-900">Low Stock Warnings</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {data.alerts.map((a, i) => (
              <div key={i} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-2.5">
                <span className="text-sm text-gray-800">{a.company} — {a.kgSize}kg</span>
                <span className="text-sm font-bold text-gray-900">{a.full} full</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Balance by KG size */}
      {Object.entries(data.balance).map(([kg, companies]) => {
        const entries = Object.entries(companies).filter(([, c]) => c.full > 0 || c.empty > 0);
        if (entries.length === 0) return null;
        const totalFull  = entries.reduce((s, [, c]) => s + Math.max(0, c.full), 0);
        const totalEmpty = entries.reduce((s, [, c]) => s + Math.max(0, c.empty), 0);
        return (
          <div key={kg} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <span className="font-semibold text-slate-900">Amount — {kg} Cylinders</span>
              <div className="flex gap-4 text-sm">
                <span className="text-slate-500">Full <span className="font-bold text-slate-900">{totalFull}</span></span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">Empty <span className="font-bold text-slate-900">{totalEmpty}</span></span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">Total <span className="font-bold text-slate-900">{totalFull + totalEmpty}</span></span>
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(["full", "empty"] as const).map(status => {
                  const rows = entries.filter(([, c]) => Math.max(0, c[status]) > 0);
                  return (
                    <div key={status}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">{status === "full" ? "Full" : "Empty"}</p>
                      {rows.length === 0 ? <p className="text-sm text-slate-400">—</p> : (
                        <div className="space-y-1">
                          {rows.map(([company, c]) => (
                            <div key={company} className="flex items-center justify-between py-1 pl-3 border-l-2 border-slate-200">
                              <span className="text-sm text-slate-700">{company}</span>
                              <span className="text-sm font-semibold text-slate-900">{Math.max(0, c[status])}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between">
                <span className="text-sm font-semibold text-slate-700">Total</span>
                <span className="text-base font-bold text-slate-900">{totalFull + totalEmpty}</span>
              </div>
            </div>
          </div>
        );
      })}

      {Object.keys(data.balance).length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white border border-slate-200 rounded-2xl">
          <Building2 size={24} className="text-slate-400" />
          <p className="text-sm text-slate-500">No stock movements recorded yet. Add movements from the Stock page.</p>
        </div>
      )}
    </div>
  );
}

// ─── Dues Tab ─────────────────────────────────────────────────────────────────
function DuesTab() {
  const [data, setData] = useState<DuesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<"overdue" | "unpaid" | "due_soon">("overdue");

  useEffect(() => {
    fetch("/api/reports?type=dues").then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  function exportReport() {
    if (!data) return;
    const list = section === "overdue" ? data.overdue : section === "unpaid" ? data.unpaid : data.dueThisMonth;
    const rows: (string | number)[][] = [
      ["Customer Dues Report", format(new Date(), "d MMMM yyyy")],
      ["User ID","Full Name","Contact","Package","Area","Bill Paid Till"],
      ...list.map(c => [c.userId, c.fullName, c.contact, `${c.packageType}kg`, c.address.area, c.billPaidTill ? format(new Date(c.billPaidTill), "d MMM yyyy") : "Never paid"]),
    ];
    exportCSV(rows, `dues-report-${format(new Date(), "yyyy-MM-dd")}.csv`);
  }

  if (loading) return <LoadingSkeleton />;
  if (!data) return <ErrorState />;

  const activeList = section === "overdue" ? data.overdue : section === "unpaid" ? data.unpaid : data.dueThisMonth;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        {kv("Overdue", data.totalOverdue, "past due date")}
        {kv("Never Paid", data.totalUnpaid, "no bill date set")}
        {kv("Due This Month", data.dueThisMonth.length, "expiring soon")}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1">
          {[
            { id: "overdue" as const,  label: `Overdue (${data.totalOverdue})` },
            { id: "unpaid" as const,   label: `Never Paid (${data.totalUnpaid})` },
            { id: "due_soon" as const, label: `Due This Month (${data.dueThisMonth.length})` },
          ].map(s => (
            <button key={s.id} onClick={() => setSection(s.id)} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${section === s.id ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}>{s.label}</button>
          ))}
        </div>
        <button onClick={exportReport} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 shadow-sm"><Download size={13} /> Export</button>
      </div>

      {activeList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white border border-slate-200 rounded-2xl">
          <CheckCircle size={24} className="text-gray-400" />
          <p className="text-sm text-slate-500">No customers in this category.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-[80px_1fr_110px_70px_1fr_130px] px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            {["User ID","Name","Contact","Pkg","Area","Bill Paid Till"].map(h =>
              <p key={h} className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{h}</p>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {activeList.map(c => {
              const daysOverdue = c.billPaidTill
                ? Math.floor((Date.now() - new Date(c.billPaidTill).getTime()) / 86400000)
                : null;
              return (
                <div key={c._id} className="grid grid-cols-[80px_1fr_110px_70px_1fr_130px] items-center px-4 py-3 hover:bg-slate-50">
                  <p className="text-xs font-mono text-slate-500">{c.userId}</p>
                  <p className="text-sm font-medium text-slate-900 truncate pr-2">{c.fullName}</p>
                  <p className="text-xs text-slate-600">{c.contact}</p>
                  <p className="text-xs text-slate-600">{c.packageType}kg</p>
                  <p className="text-xs text-slate-500 truncate">{c.address.area}</p>
                  <div>
                    {c.billPaidTill ? (
                      <div>
                        <p className="text-xs font-medium text-gray-800">{format(new Date(c.billPaidTill), "d MMM yyyy")}</p>
                        {daysOverdue !== null && daysOverdue > 0 && <p className="text-[10px] text-gray-500">{daysOverdue}d overdue</p>}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Never paid</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">{activeList.length} customer{activeList.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_,i) => <div key={i} className="h-24 bg-slate-200 rounded-2xl" />)}</div>
      <div className="h-64 bg-slate-200 rounded-2xl" />
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <RefreshCw size={24} className="text-slate-400" />
      <p className="text-sm text-slate-500">Failed to load report data.</p>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const cls: Record<string, string> = {
    package: "bg-black text-white border-black",
    refill:  "bg-gray-700 text-white border-gray-700",
    bottle:  "bg-gray-400 text-white border-gray-400",
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${cls[type] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>{TYPE_LABELS[type] ?? type}</span>;
}

function CollapsibleSection({ title, expanded, onToggle, children }: { title: string; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <ChevronDown size={15} className={`text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && children}
    </div>
  );
}

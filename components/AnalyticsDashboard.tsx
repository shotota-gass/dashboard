"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShoppingCart,
  TrendingUp,
  Users,
  UserPlus,
  Package,
  Layers,
  Archive,
  BarChart2,
  RefreshCw,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import RangeSelector from "@/components/ui/RangeSelector";
import SalesTrendChart from "@/components/analytics/SalesTrendChart";
import { SalesBreakdownSection } from "@/components/analytics/SalesBreakdown";
import PackageDistribution from "@/components/analytics/PackageDistribution";
import EmployeeTable from "@/components/analytics/EmployeeTable";
import StockPanel from "@/components/analytics/StockPanel";
import CustomerGrowth from "@/components/analytics/CustomerGrowth";
import ActivityFeed from "@/components/analytics/ActivityFeed";

interface AnalyticsData {
  range: number;
  kpis: {
    totalCustomers: number;
    newCustomers: number;
    todaySalesQty: number;
    todaySalesTxns: number;
    periodSalesQty: number;
    periodSalesTxns: number;
    salesChangePct: number | null;
    txnsChangePct: number | null;
    totalFullStock: number;
    totalEmptyStock: number;
  };
  dailyTrend: { date: string; qty: number; txns: number }[];
  salesByEmployee: { _id: string; total: number; txns: number; userId?: string; role?: string }[];
  salesByPackage: { _id: number; total: number }[];
  salesByCompany: { _id: string; total: number }[];
  salesByType: { _id: string; total: number }[];
  stockSummary: Record<string, { full: number; empty: number }>;
  stockMovement: { date: string; full: number; empty: number }[];
  customerGrowth: { date: string; count: number }[];
  recentLogs: {
    _id: string;
    date: string;
    type: "daily_count" | "system";
    action: string;
    performedBy?: { userId: string; role?: string };
  }[];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 h-32 animate-pulse shadow-sm">
      <div className="h-3 w-24 bg-slate-200 rounded mb-3" />
      <div className="h-8 w-16 bg-slate-200 rounded" />
    </div>
  );
}

function SkeletonChart({ height = "h-64" }: { height?: string }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-5 ${height} animate-pulse shadow-sm`}>
      <div className="h-3 w-32 bg-slate-200 rounded mb-6" />
      <div className="h-full bg-slate-100 rounded-xl" />
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [range, setRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(
    async (r: number, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await fetch(`/api/analytics?range=${r}`);
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        setData(json);
        setLastUpdated(new Date());
      } catch {
        // silent
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchData(range);
  }, [range, fetchData]);

  const handleRangeChange = (r: number) => {
    setRange(r);
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div>
          <div className="h-7 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-64 bg-slate-100 rounded animate-pulse mt-1.5" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonChart height="h-72" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeletonChart />
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <p>Failed to load analytics data.</p>
      </div>
    );
  }

  const { kpis, dailyTrend, salesByEmployee, salesByPackage, salesByCompany, salesByType, stockSummary, customerGrowth, recentLogs } = data;

  return (
    <div className="space-y-5">
      {/* Header controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{getGreeting()}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {lastUpdated
              ? `Last updated ${lastUpdated.toLocaleTimeString()}`
              : "Here's what's happening with your business today."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RangeSelector value={range} onChange={handleRangeChange} />
          <button
            onClick={() => fetchData(range, true)}
            disabled={refreshing}
            className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* KPI Cards — 8 cards in 2 rows of 4 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales"
          value={kpis.todaySalesQty}
          sub={`${kpis.todaySalesTxns} transactions`}
          icon={<ShoppingCart size={16} />}
          accentColor="blue"
        />
        <StatCard
          title={`${range}D Sales Volume`}
          value={kpis.periodSalesQty}
          sub="cylinders sold"
          icon={<TrendingUp size={16} />}
          trend={kpis.salesChangePct}
          accentColor="violet"
        />
        <StatCard
          title="Total Customers"
          value={kpis.totalCustomers}
          sub="registered accounts"
          icon={<Users size={16} />}
          accentColor="emerald"
        />
        <StatCard
          title="New Customers"
          value={kpis.newCustomers}
          sub={`last ${range} days`}
          icon={<UserPlus size={16} />}
          accentColor="emerald"
        />
        <StatCard
          title="Transactions"
          value={kpis.periodSalesTxns}
          sub={`last ${range} days`}
          icon={<BarChart2 size={16} />}
          trend={kpis.txnsChangePct}
          accentColor="amber"
        />
        <StatCard
          title="Full Stock"
          value={kpis.totalFullStock}
          sub="cylinders available"
          icon={<Package size={16} />}
          accentColor="emerald"
        />
        <StatCard
          title="Empty Stock"
          value={kpis.totalEmptyStock}
          sub="cylinders to refill"
          icon={<Archive size={16} />}
          accentColor="rose"
        />
        <StatCard
          title="Stock Total"
          value={kpis.totalFullStock + kpis.totalEmptyStock}
          sub="all cylinders"
          icon={<Layers size={16} />}
          accentColor="slate"
        />
      </div>

      {/* Row 1: Sales Trend (wide) + Customer Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SalesTrendChart data={dailyTrend} />
        <CustomerGrowth data={customerGrowth} />
      </div>

      {/* Row 2: Sales by type / top companies */}
      <SalesBreakdownSection salesByType={salesByType} salesByCompany={salesByCompany} />

      {/* Row 3: Package Distribution + Employee Table + Stock Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PackageDistribution data={salesByPackage} />
        <EmployeeTable data={salesByEmployee} />
        <StockPanel stockSummary={stockSummary} />
      </div>

      {/* Row 4: Activity Feed (full width) */}
      <ActivityFeed logs={recentLogs} />
    </div>
  );
}

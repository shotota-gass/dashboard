"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import ChartCard from "@/components/ui/ChartCard";

interface StockSummary {
  [key: string]: { full: number; empty: number };
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-lg text-xs space-y-1">
      <p className="text-gray-500 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill }} className="font-semibold">
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

export default function StockPanel({ stockSummary }: { stockSummary: StockSummary }) {
  const chartData = Object.entries(stockSummary).map(([key, val]) => ({
    name: key,
    Full: val.full,
    Empty: val.empty,
    total: val.full + val.empty,
  }));

  const totalFull = Object.values(stockSummary).reduce((a, v) => a + v.full, 0);
  const totalEmpty = Object.values(stockSummary).reduce((a, v) => a + v.empty, 0);
  const healthPct = totalFull + totalEmpty > 0
    ? Math.round((totalFull / (totalFull + totalEmpty)) * 100)
    : 0;

  const healthLabel = healthPct >= 70 ? "Healthy" : healthPct >= 40 ? "Moderate" : "Low";

  return (
    <ChartCard
      title="Stock Health"
      subtitle="Full vs Empty cylinders by size"
      badge={healthLabel}
    >
      {/* Health meter */}
      <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">Stock Health Score</span>
          <span className="text-lg font-bold text-gray-900">{healthPct}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-black transition-all duration-700"
            style={{ width: `${healthPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-gray-500">
          <span>{totalFull.toLocaleString()} full</span>
          <span>{totalEmpty.toLocaleString()} empty</span>
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">No stock data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e4" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#888888" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#888888" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#888888" }}
              iconType="circle"
              iconSize={7}
            />
            <Bar dataKey="Full" fill="#111111" radius={[3, 3, 0, 0]} fillOpacity={0.85} />
            <Bar dataKey="Empty" fill="#aaaaaa" radius={[3, 3, 0, 0]} fillOpacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

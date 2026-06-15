"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import ChartCard from "@/components/ui/ChartCard";

interface DataPoint {
  date: string;
  qty: number;
  txns: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="text-gray-500 mb-2">{format(new Date(label), "d MMM yyyy")}</p>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-900">
          {payload[0]?.value?.toLocaleString()} <span className="text-gray-500 font-normal">cylinders</span>
        </p>
        <p className="text-xs text-gray-500">
          {payload[1]?.value?.toLocaleString()} transactions
        </p>
      </div>
    </div>
  );
};

export default function SalesTrendChart({ data }: { data: DataPoint[] }) {
  return (
    <ChartCard
      title="Sales Volume Trend"
      subtitle="Daily cylinders sold over selected period"
      badge="Live"
      className="col-span-full lg:col-span-2"
    >
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
          <defs>
            <linearGradient id="qtyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#111111" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#111111" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="txnsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#666666" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#666666" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e4" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#888888" }}
            tickFormatter={(v) => format(new Date(v), data.length > 14 ? "d MMM" : "EEE d")}
            tickLine={false}
            axisLine={false}
            interval={Math.floor(data.length / 6)}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#888888" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="qty"
            stroke="#111111"
            strokeWidth={2}
            fill="url(#qtyGradient)"
            name="Cylinders"
            dot={false}
            activeDot={{ r: 4, fill: "#111111", stroke: "#ffffff", strokeWidth: 2 }}
          />
          <Area
            type="monotone"
            dataKey="txns"
            stroke="#777777"
            strokeWidth={1.5}
            fill="url(#txnsGradient)"
            name="Transactions"
            dot={false}
            activeDot={{ r: 3, fill: "#777777", stroke: "#ffffff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-black rounded" />
          <span className="text-xs text-gray-500">Cylinders Sold</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-gray-500 rounded" />
          <span className="text-xs text-gray-500">Transactions</span>
        </div>
      </div>
    </ChartCard>
  );
}

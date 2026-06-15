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

interface GrowthPoint {
  date: string;
  count: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-lg text-xs">
      <p className="text-gray-500 mb-1">{format(new Date(label), "d MMM yyyy")}</p>
      <p className="text-gray-900 font-semibold">
        +{payload[0]?.value} <span className="text-gray-500 font-normal">new customers</span>
      </p>
    </div>
  );
};

export default function CustomerGrowth({ data }: { data: GrowthPoint[] }) {
  const total = data.reduce((a, d) => a + d.count, 0);
  const peakDay = data.reduce((a, d) => (d.count > a.count ? d : a), { date: "", count: 0 });

  return (
    <ChartCard
      title="Customer Growth"
      subtitle="New customer registrations over period"
      badge={`+${total} new`}
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 flex-1">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total New</p>
          <p className="text-xl font-bold text-gray-900">{total}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 flex-1">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Peak Day</p>
          <p className="text-xl font-bold text-gray-900">{peakDay.count}</p>
          {peakDay.date && (
            <p className="text-[10px] text-gray-500">{format(new Date(peakDay.date), "d MMM")}</p>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={130}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="custGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#111111" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#111111" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e4" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "#888888" }}
            tickFormatter={(v) => format(new Date(v), "d")}
            tickLine={false}
            axisLine={false}
            interval={Math.floor(data.length / 4)}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#888888" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#111111"
            strokeWidth={2}
            fill="url(#custGradient)"
            dot={false}
            activeDot={{ r: 3, fill: "#111111", stroke: "#ffffff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

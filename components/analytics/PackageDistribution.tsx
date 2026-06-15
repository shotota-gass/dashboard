"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import ChartCard from "@/components/ui/ChartCard";

interface PackageItem {
  _id: number;
  total: number;
}

const PKG_COLORS: Record<number, string> = {
  12: "#111111",
  22: "#333333",
  30: "#555555",
  35: "#777777",
  45: "#999999",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-lg text-xs">
      <p className="text-gray-500 mb-1">{label}kg cylinder</p>
      <p className="text-gray-900 font-semibold">{payload[0].value.toLocaleString()} units</p>
    </div>
  );
};

export default function PackageDistribution({ data }: { data: PackageItem[] }) {
  const total = data.reduce((a, d) => a + d.total, 0);

  return (
    <ChartCard title="Package Size Distribution" subtitle="Sales volume by cylinder kg size">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={data.map((d) => ({ name: `${d._id}kg`, total: d.total, kg: d._id }))}
          margin={{ top: 0, right: 0, bottom: 0, left: -15 }}
        >
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
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d._id} fill={PKG_COLORS[d._id] ?? "#666666"} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
        {data.map((d) => (
          <div key={d._id} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: PKG_COLORS[d._id] ?? "#666666" }}
            />
            <span className="text-xs text-gray-500">
              {d._id}kg — {total > 0 ? `${Math.round((d.total / total) * 100)}%` : "0%"}
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

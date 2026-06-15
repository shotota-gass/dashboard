"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import ChartCard from "@/components/ui/ChartCard";

interface SalesItem {
  _id: string;
  total: number;
}

const TYPE_COLORS: Record<string, string> = {
  package: "#111111",
  refill: "#555555",
  bottle: "#999999",
};

const TYPE_LABELS: Record<string, string> = {
  package: "Package",
  refill: "Refill",
  bottle: "Bottle",
};

const COMPANY_COLORS = [
  "#111111", "#333333", "#555555", "#666666",
  "#777777", "#888888", "#999999", "#aaaaaa",
  "#222222", "#444444",
];

const DonutTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-lg text-xs">
      <p className="text-gray-500">{TYPE_LABELS[payload[0].name] ?? payload[0].name}</p>
      <p className="text-gray-900 font-semibold">{payload[0].value.toLocaleString()} units</p>
    </div>
  );
};

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-lg text-xs">
      <p className="text-gray-500 mb-1">{label}</p>
      <p className="text-gray-900 font-semibold">{payload[0].value.toLocaleString()} cylinders</p>
    </div>
  );
};

function SalesByType({ data }: { data: SalesItem[] }) {
  const total = data.reduce((a, s) => a + s.total, 0);
  return (
    <ChartCard title="Sales by Type" subtitle="Distribution across sale categories">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data.map((s) => ({ name: s._id, value: s.total }))}
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={80}
            dataKey="value"
            strokeWidth={2}
            stroke="#ffffff"
          >
            {data.map((s) => (
              <Cell key={s._id} fill={TYPE_COLORS[s._id] ?? "#888888"} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="space-y-2 mt-1">
        {data.map((s) => (
          <div key={s._id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: TYPE_COLORS[s._id] ?? "#888888" }}
              />
              <span className="text-xs text-gray-600">
                {TYPE_LABELS[s._id] ?? s._id}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-900">{s.total.toLocaleString()}</span>
              <span className="text-xs text-gray-400">
                {total > 0 ? `${Math.round((s.total / total) * 100)}%` : "0%"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

function TopCompanies({ data }: { data: SalesItem[] }) {
  const shortName = (name: string) =>
    name
      .replace(" LPG", "")
      .replace(" LP Gas", "")
      .replace(" Gas", "")
      .replace(" Ltd", "");

  return (
    <ChartCard title="Top Companies" subtitle="By cylinder volume" className="col-span-1 lg:col-span-2">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data.map((c, i) => ({ name: shortName(c._id), total: c.total, fill: COMPANY_COLORS[i % COMPANY_COLORS.length] }))}
          layout="vertical"
          margin={{ top: 0, right: 10, bottom: 0, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e4" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "#888888" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: "#555555" }}
            axisLine={false}
            tickLine={false}
            width={85}
          />
          <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
          <Bar dataKey="total" name="Cylinders" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COMPANY_COLORS[i % COMPANY_COLORS.length]} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function SalesBreakdownSection({
  salesByType,
  salesByCompany,
}: {
  salesByType: SalesItem[];
  salesByCompany: SalesItem[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SalesByType data={salesByType} />
      <TopCompanies data={salesByCompany} />
    </div>
  );
}

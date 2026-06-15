"use client";

import { Trophy, Medal, Award } from "lucide-react";
import ChartCard from "@/components/ui/ChartCard";
import { ROLE_LABELS } from "@/lib/constants";

interface EmployeeRow {
  _id: string;
  total: number;
  txns: number;
  userId?: string;
  role?: string;
}

function getRankIcon(i: number) {
  if (i === 0) return <Trophy size={13} className="text-amber-500" />;
  if (i === 1) return <Medal size={13} className="text-slate-400" />;
  if (i === 2) return <Award size={13} className="text-amber-600" />;
  return (
    <span className="text-[11px] text-slate-400 font-bold w-[13px] text-center">
      {i + 1}
    </span>
  );
}

export default function EmployeeTable({ data }: { data: EmployeeRow[] }) {
  const total = data.reduce((a, d) => a + d.total, 0);

  return (
    <ChartCard
      title="Employee Performance"
      subtitle="Cylinders sold per staff member"
      badge="Ranked"
      badgeColor="amber"
    >
      {data.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">No data for this period</p>
      ) : (
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-[24px_1fr_60px_50px_70px] gap-2 text-[10px] text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-100">
            <span>#</span>
            <span>Staff</span>
            <span className="text-right">Units</span>
            <span className="text-right">Txns</span>
            <span className="text-right">Share</span>
          </div>

          {data.map((row, i) => {
            const pct = total > 0 ? Math.round((row.total / total) * 100) : 0;
            return (
              <div
                key={row._id}
                className="grid grid-cols-[24px_1fr_60px_50px_70px] gap-2 items-center py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-center">
                  {getRankIcon(i)}
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-slate-900 font-medium truncate">
                    {row.userId ?? "Unknown"}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {ROLE_LABELS[row.role ?? ""] ?? row.role ?? "—"}
                  </p>
                </div>

                <p className="text-xs font-semibold text-slate-900 text-right">
                  {row.total.toLocaleString()}
                </p>

                <p className="text-xs text-slate-500 text-right">{row.txns}</p>

                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-slate-600">{pct}%</span>
                  <div className="w-full bg-slate-200 rounded-full h-1">
                    <div
                      className="h-1 rounded-full bg-slate-800 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}

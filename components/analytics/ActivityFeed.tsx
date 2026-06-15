"use client";

import { format } from "date-fns";
import { ShoppingCart, Settings, UserPlus, Package, AlertCircle, Activity } from "lucide-react";
import ChartCard from "@/components/ui/ChartCard";

interface LogEntry {
  _id: string;
  date: string;
  type: "daily_count" | "system";
  action: string;
  performedBy?: { userId: string; role?: string };
}

function getIcon(type: string, action: string) {
  if (type === "daily_count") return <ShoppingCart size={13} />;
  if (action.toLowerCase().includes("delete")) return <AlertCircle size={13} />;
  if (action.toLowerCase().includes("customer")) return <UserPlus size={13} />;
  if (action.toLowerCase().includes("stock")) return <Package size={13} />;
  if (action.toLowerCase().includes("employee")) return <Settings size={13} />;
  return <Activity size={13} />;
}

function getTypeLabel(type: string) {
  return type === "daily_count" ? "Sale" : "System";
}

export default function ActivityFeed({ logs }: { logs: LogEntry[] }) {
  return (
    <ChartCard
      title="Live Activity Feed"
      subtitle="Recent system events"
      badge="Live"
      className="col-span-full"
    >
      {logs.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No activity recorded yet</p>
      ) : (
        <div className="space-y-0 divide-y divide-gray-100">
          {logs.map((log) => (
            <div
              key={log._id}
              className="flex items-center gap-3 py-3 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 shrink-0">
                {getIcon(log.type, log.action)}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-800 truncate">{log.action}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {log.performedBy?.userId ?? "System"}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 border border-gray-200">
                  {getTypeLabel(log.type)}
                </span>
                <span className="text-[11px] text-gray-500 whitespace-nowrap">
                  {format(new Date(log.date), "d MMM, HH:mm")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

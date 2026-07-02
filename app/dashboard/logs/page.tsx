"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SectionHeader from "@/components/ui/SectionHeader";
import Badge from "@/components/ui/Badge";
import { X, ShoppingCart, Settings } from "lucide-react";
import { format } from "date-fns";

interface LogEntry {
  _id: string; type: "daily_count" | "system"; action: string; date: string;
  performedBy?: { userId: string; role: string };
}

function TableSkeleton() {
  return <div className="divide-y divide-slate-100">{[...Array(8)].map((_, i) => (
    <div key={i} className="flex gap-4 px-4 py-4 animate-pulse">
      <div className="h-3 bg-slate-200 rounded w-32" /><div className="h-3 bg-slate-200 rounded w-16" /><div className="h-3 bg-slate-200 rounded flex-1" /><div className="h-3 bg-slate-200 rounded w-24" />
    </div>
  ))}</div>;
}

function LogsPageInner() {
  const searchParams = useSearchParams();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userFilter, setUserFilter] = useState(searchParams.get("user") ?? "");

  const inputCls = "px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-slate-500 transition-colors";

  async function load(p = 1) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (typeFilter) params.set("type", typeFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (userFilter) params.set("user", userFilter);
    const res = await fetch(`/api/logs?${params}`);
    const data = await res.json();
    setLogs(data.logs ?? []); setTotal(data.total ?? 0); setPages(data.pages ?? 1); setPage(p);
    setLoading(false);
  }

  useEffect(() => { load(1); }, [typeFilter, dateFrom, dateTo, userFilter]);

  const hasFilters = typeFilter || dateFrom || dateTo || userFilter;

  return (
    <div>
      <SectionHeader title="Logs" description={`${total} total log entries`} />

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Type</p>
          <select className={inputCls} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="daily_count">Sales Log</option>
            <option value="system">System Log</option>
          </select>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">From</p>
          <input type="date" className={inputCls} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">To</p>
          <input type="date" className={inputCls} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Performed By</p>
          <input type="text" placeholder="User ID" className={inputCls} value={userFilter} onChange={e => setUserFilter(e.target.value)} />
        </div>
        {hasFilters && (
          <button onClick={() => { setTypeFilter(""); setDateFrom(""); setDateTo(""); setUserFilter(""); }} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors rounded-xl border border-slate-200 hover:bg-slate-50 bg-white shadow-sm">
            <X size={12} /> Clear
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-[160px_100px_1fr_130px] px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          {["Date & Time","Type","Action","Performed By"].map(h => <p key={h} className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{h}</p>)}
        </div>

        {loading ? <TableSkeleton /> : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center"><Settings size={20} className="text-slate-400" /></div>
            <p className="text-sm text-slate-500">No log entries found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map(log => (
              <div key={log._id} className="grid grid-cols-[160px_100px_1fr_130px] items-center px-4 py-3.5 hover:bg-slate-50 transition-colors">
                <p className="text-xs text-slate-500 whitespace-nowrap">{format(new Date(log.date), "d MMM yyyy, HH:mm")}</p>
                <div className="flex items-center gap-1.5">
                  {log.type === "daily_count" ? <ShoppingCart size={11} className="text-slate-500" /> : <Settings size={11} className="text-slate-500" />}
                  <Badge>{log.type === "daily_count" ? "Sale" : "System"}</Badge>
                </div>
                <p className="text-xs text-slate-700 truncate pr-4">{log.action}</p>
                <p className="text-xs font-mono text-slate-500">{log.performedBy?.userId ?? "System"}</p>
              </div>
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-500">Page {page} of {pages} · {total} entries</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => load(page - 1)} className="px-3 py-1.5 text-xs rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">Prev</button>
              <button disabled={page === pages} onClick={() => load(page + 1)} className="px-3 py-1.5 text-xs rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LogsPage() {
  return (
    <Suspense>
      <LogsPageInner />
    </Suspense>
  );
}

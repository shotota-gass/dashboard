"use client";

import { useEffect, useState, useCallback } from "react";
import React from "react";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import {
  Plus, Pencil, Trash2, RefreshCw, PackagePlus, Undo2, Send,
  SlidersHorizontal, ArrowLeft, AlertTriangle, Package,
} from "lucide-react";
import { KG_SIZES } from "@/lib/constants";
import { useAppSettings } from "@/lib/useAppSettings";
import { format } from "date-fns";

const LOW_STOCK = 5;

type Tab = "current" | "movements";
type MovementType = "receive_full" | "return_empty" | "send_refill" | "receive_refilled" | "adjustment";

interface StockEntry {
  _id: string; kgSize: number; company: string;
  status: "full" | "empty"; quantity: number; note?: string; date: string;
}
interface GroupedStock {
  [kg: number]: { full: Record<string, number>; empty: Record<string, number> };
}
interface Movement {
  _id: string; type: string; kgSize: number; company: string;
  quantity: number; fullDelta: number; emptyDelta: number;
  note?: string; date: string;
  recordedBy?: { userId: string };
}
interface Customer { _id: string; userId: string; fullName: string; }

const inputCls = "w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-slate-500 transition-colors";
const labelCls = "block text-xs font-medium text-slate-600 mb-1.5";

const MOV_LABELS: Record<string, string> = {
  receive_full:     "Received Full",
  sell:             "Sale (auto)",
  return_empty:     "Empty Returned",
  send_refill:      "Sent for Refill",
  receive_refilled: "Received Refilled",
  adjustment:       "Adjustment",
};

const MOV_CONFIG: {
  type: MovementType; label: string; icon: React.ElementType; desc: string; effect: string;
}[] = [
  { type: "receive_full",     label: "Receive Full",      icon: PackagePlus,        desc: "New full cylinders arrived from supplier",   effect: "Full +N"   },
  { type: "receive_refilled", label: "Receive Refilled",  icon: RefreshCw,          desc: "Refilled cylinders returned from company",   effect: "Full +N"   },
  { type: "return_empty",     label: "Customer Return",   icon: Undo2,              desc: "Customer returned an empty cylinder",        effect: "Empty +N"  },
  { type: "send_refill",      label: "Send for Refill",   icon: Send,               desc: "Send empty cylinders to company for refill", effect: "Empty -N"  },
  { type: "adjustment",       label: "Manual Adjustment", icon: SlidersHorizontal,  desc: "Correct full or empty counts manually",      effect: "Custom ±"  },
];

function DeltaBadge({ full, empty }: { full: number; empty: number }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {full !== 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${full > 0 ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"}`}>
          {full > 0 ? "+" : ""}{full} F
        </span>
      )}
      {empty !== 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${empty > 0 ? "bg-slate-600 text-white" : "bg-slate-100 text-slate-600"}`}>
          {empty > 0 ? "+" : ""}{empty} E
        </span>
      )}
    </div>
  );
}

export default function StockPage() {
  const { toast } = useToast();
  const { companies } = useAppSettings();
  const [tab, setTab] = useState<Tab>("current");
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Current stock
  const [entries, setEntries]           = useState<StockEntry[]>([]);
  const [grouped, setGrouped]           = useState<GroupedStock>({});
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [showEntries, setShowEntries]   = useState(false);

  // Entry CRUD
  const [addOpen, setAddOpen]       = useState(false);
  const [editEntry, setEditEntry]   = useState<StockEntry | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [stockForm, setStockForm]   = useState({ kgSize: 12, company: "", status: "full" as "full" | "empty", quantity: 0, note: "" });
  const [entrySaving, setEntrySaving] = useState(false);
  const [entryError, setEntryError]   = useState("");

  // Movements list
  const [movements, setMovements]   = useState<Movement[]>([]);
  const [movTotal, setMovTotal]     = useState(0);
  const [movPage, setMovPage]       = useState(1);
  const [movPages, setMovPages]     = useState(1);
  const [loadingMov, setLoadingMov] = useState(false);
  const [movTypeFilter, setMovTypeFilter]         = useState("");
  const [movKgFilter, setMovKgFilter]             = useState("");
  const [movCompanyFilter, setMovCompanyFilter]   = useState("");
  const [movFrom, setMovFrom]                     = useState("");
  const [movTo, setMovTo]                         = useState("");

  // Movement add modal
  const [movOpen, setMovOpen]     = useState(false);
  const [movStep, setMovStep]     = useState<"pick" | "form">("pick");
  const [movType, setMovType]     = useState<MovementType | null>(null);
  const [movForm, setMovForm]     = useState({ kgSize: 12, company: "", quantity: 1, note: "", fullDelta: 0, emptyDelta: 0, customerRef: "" });
  const [movSaving, setMovSaving] = useState(false);
  const [movError, setMovError]   = useState("");

  // ── Loaders ────────────────────────────────────────────────────────────────
  async function loadCurrent() {
    setLoadingCurrent(true);
    const res = await fetch("/api/stock");
    if (!res.ok) { setLoadingCurrent(false); return; }
    const data = await res.json();
    setGrouped(data.grouped ?? {});
    setEntries(data.entries ?? []);
    setLoadingCurrent(false);
  }

  const loadMovements = useCallback(async (p = 1) => {
    setLoadingMov(true);
    const params = new URLSearchParams({ page: String(p) });
    if (movTypeFilter)    params.set("type",    movTypeFilter);
    if (movKgFilter)      params.set("kg",      movKgFilter);
    if (movCompanyFilter) params.set("company", movCompanyFilter);
    if (movFrom)          params.set("from",    movFrom);
    if (movTo)            params.set("to",      movTo);
    const res = await fetch(`/api/stock/movements?${params}`);
    if (!res.ok) { setLoadingMov(false); return; }
    const data = await res.json();
    setMovements(data.movements ?? []);
    setMovTotal(data.total ?? 0);
    setMovPages(data.pages ?? 1);
    setMovPage(p);
    setLoadingMov(false);
  }, [movTypeFilter, movKgFilter, movCompanyFilter, movFrom, movTo]);

  useEffect(() => { loadCurrent(); }, []);
  useEffect(() => { if (tab === "movements") loadMovements(1); }, [tab, loadMovements]);
  useEffect(() => { fetch("/api/customers?page=1").then(r => r.json()).then(d => setCustomers(d.customers ?? [])); }, []);

  // ── Summary ────────────────────────────────────────────────────────────────
  let totalFull = 0, totalEmpty = 0, lowStockCount = 0;
  for (const kg of KG_SIZES) {
    const g = grouped[kg] ?? { full: {}, empty: {} };
    for (const qty of Object.values(g.full))  { totalFull  += qty; if (qty > 0 && qty < LOW_STOCK) lowStockCount++; }
    for (const qty of Object.values(g.empty)) { totalEmpty += qty; }
  }
  const stockCompanies = Array.from(new Set(entries.map(e => e.company))).sort();

  // ── Entry CRUD ─────────────────────────────────────────────────────────────
  async function handleAddEntry() {
    setEntrySaving(true); setEntryError("");
    const res = await fetch("/api/stock", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...stockForm, kgSize: Number(stockForm.kgSize), quantity: Number(stockForm.quantity) }),
    });
    setEntrySaving(false);
    if (!res.ok) { setEntryError("Failed to add entry."); return; }
    setAddOpen(false);
    setStockForm({ kgSize: 12, company: companies[0] ?? "", status: "full", quantity: 0, note: "" });
    loadCurrent();
    toast("success", "Stock entry added");
  }

  async function handleEditEntry() {
    if (!editEntry) return;
    setEntrySaving(true);
    const res = await fetch("/api/stock", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editEntry._id, quantity: Number(stockForm.quantity), note: stockForm.note }),
    });
    setEntrySaving(false);
    if (!res.ok) { setEntryError("Failed to update."); return; }
    setEditEntry(null);
    loadCurrent();
    toast("success", "Entry updated");
  }

  async function handleDeleteEntry() {
    if (!deleteId) return;
    await fetch(`/api/stock?id=${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    loadCurrent();
    toast("success", "Entry deleted");
  }

  // ── Movement submit ────────────────────────────────────────────────────────
  async function handleMovement() {
    if (!movType) return;
    setMovSaving(true); setMovError("");
    const payload = {
      type: movType,
      kgSize:   Number(movForm.kgSize),
      company:  movForm.company,
      quantity: Number(movForm.quantity),
      note:     movForm.note || undefined,
      customerRef: movType === "return_empty" ? (movForm.customerRef || undefined) : undefined,
      ...(movType === "adjustment" ? { fullDelta: Number(movForm.fullDelta), emptyDelta: Number(movForm.emptyDelta) } : {}),
    };
    const res = await fetch("/api/stock/movements", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setMovSaving(false);
    if (!res.ok) { const d = await res.json(); setMovError(d.error ?? "Failed."); return; }
    setMovOpen(false);
    toast("success", `${MOV_CONFIG.find(c => c.type === movType)?.label} recorded`);
    if (tab === "movements") loadMovements(1);
  }

  function openMovModal() {
    setMovOpen(true); setMovStep("pick"); setMovType(null); setMovError("");
    setMovForm({ kgSize: 12, company: companies[0] ?? "", quantity: 1, note: "", fullDelta: 0, emptyDelta: 0, customerRef: "" });
  }

  const activeMovConfig = movType ? MOV_CONFIG.find(c => c.type === movType) : null;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock</h1>
          <p className="text-sm text-slate-500 mt-0.5">Inventory levels and movement ledger</p>
        </div>
        <button
          onClick={openMovModal}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-700 transition-colors"
        >
          <Plus size={14} /> Record Movement
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
            <Package size={18} className="text-slate-700" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{totalFull}</p>
            <p className="text-xs text-slate-500">Full Cylinders</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
            <Package size={18} className="text-slate-300" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{totalEmpty}</p>
            <p className="text-xs text-slate-500">Empty Cylinders</p>
          </div>
        </div>
        <div className={`border rounded-xl p-4 shadow-sm flex items-center gap-3 ${lowStockCount > 0 ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${lowStockCount > 0 ? "bg-red-100" : "bg-slate-100"}`}>
            <AlertTriangle size={18} className={lowStockCount > 0 ? "text-red-500" : "text-slate-400"} />
          </div>
          <div>
            <p className={`text-2xl font-bold ${lowStockCount > 0 ? "text-red-700" : "text-slate-900"}`}>{lowStockCount}</p>
            <p className={`text-xs ${lowStockCount > 0 ? "text-red-500" : "text-slate-500"}`}>Low Stock Alerts</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-2xl p-1 w-fit">
        {(["current", "movements"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${tab === t ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-white"}`}
          >
            {t === "current" ? "Current Stock" : "Movement Ledger"}
          </button>
        ))}
      </div>

      {/* ── Current Stock ── */}
      {tab === "current" && (
        <div className="space-y-4">
          {loadingCurrent ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-slate-200 rounded-xl animate-pulse" />)}
            </div>
          ) : stockCompanies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl gap-3">
              <Package size={32} className="text-slate-300" />
              <p className="text-sm text-slate-500">No stock entries yet.</p>
              <button
                onClick={() => { setAddOpen(true); setEntryError(""); setStockForm({ kgSize: 12, company: companies[0] ?? "", status: "full", quantity: 0, note: "" }); }}
                className="px-4 py-2 bg-slate-900 text-white text-sm rounded-xl hover:bg-slate-700 transition-colors"
              >
                Add First Entry
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Company</th>
                    {KG_SIZES.map(kg => (
                      <th key={kg} colSpan={2} className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide border-l border-slate-200">
                        {kg} KG
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50/60">
                    <th />
                    {KG_SIZES.map(kg => (
                      <React.Fragment key={kg}>
                        <th className="text-center px-3 py-1.5 text-[10px] font-medium text-slate-400 border-l border-slate-200">Full</th>
                        <th className="text-center px-3 py-1.5 text-[10px] font-medium text-slate-400">Empty</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockCompanies.map(company => (
                    <tr key={company} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{company}</td>
                      {KG_SIZES.map(kg => {
                        const g    = grouped[kg] ?? { full: {}, empty: {} };
                        const full  = g.full[company]  ?? 0;
                        const empty = g.empty[company] ?? 0;
                        const isLow = full > 0 && full < LOW_STOCK;
                        return (
                          <React.Fragment key={kg}>
                            <td className={`px-3 py-3.5 text-center border-l border-slate-200 ${isLow ? "bg-red-50" : ""}`}>
                              <span className={`text-sm font-semibold tabular-nums ${full === 0 ? "text-slate-300" : isLow ? "text-red-600" : "text-slate-900"}`}>
                                {full === 0 ? "—" : full}
                              </span>
                              {isLow && <span className="ml-1 text-[9px] text-red-400 font-medium">low</span>}
                            </td>
                            <td className="px-3 py-3.5 text-center">
                              <span className={`text-sm tabular-nums ${empty === 0 ? "text-slate-300" : "text-slate-600"}`}>
                                {empty === 0 ? "—" : empty}
                              </span>
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Total</td>
                    {KG_SIZES.map(kg => {
                      const g     = grouped[kg] ?? { full: {}, empty: {} };
                      const full  = Object.values(g.full).reduce((a, b) => a + b, 0);
                      const empty = Object.values(g.empty).reduce((a, b) => a + b, 0);
                      return (
                        <React.Fragment key={kg}>
                          <td className="px-3 py-3 text-center border-l border-slate-200">
                            <span className="text-sm font-bold text-slate-900 tabular-nums">{full}</span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="text-sm font-semibold text-slate-600 tabular-nums">{empty}</span>
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Manage Raw Entries — collapsible */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <button
              onClick={() => setShowEntries(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
            >
              <span className="text-sm font-semibold text-slate-700">Manage Raw Entries</span>
              <span className="text-xs text-slate-400">{showEntries ? "Hide" : `Show ${entries.length} entries`}</span>
            </button>

            {showEntries && (
              <div className="border-t border-slate-100">
                <div className="px-5 py-2.5 flex justify-end border-b border-slate-100 bg-slate-50">
                  <button
                    onClick={() => { setAddOpen(true); setEntryError(""); setStockForm({ kgSize: 12, company: companies[0] ?? "", status: "full", quantity: 0, note: "" }); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    <Plus size={12} /> Add Entry
                  </button>
                </div>
                {entries.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400">No entries.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    <div className="grid grid-cols-[60px_1fr_70px_50px_1fr_56px] px-4 py-2 bg-slate-50/60 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                      {["KG", "Company", "Status", "Qty", "Note", ""].map(h => <span key={h}>{h}</span>)}
                    </div>
                    {entries.map(e => (
                      <div key={e._id} className="grid grid-cols-[60px_1fr_70px_50px_1fr_56px] items-center px-4 py-2.5 hover:bg-slate-50 group">
                        <span className="text-xs font-medium text-slate-900">{e.kgSize}kg</span>
                        <span className="text-xs text-slate-700 truncate pr-2">{e.company}</span>
                        <span className={`text-xs font-medium ${e.status === "full" ? "text-slate-900" : "text-slate-500"}`}>{e.status}</span>
                        <span className="text-xs font-semibold text-slate-900">{e.quantity}</span>
                        <span className="text-xs text-slate-400 truncate">{e.note ?? "—"}</span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditEntry(e); setStockForm({ kgSize: e.kgSize, company: e.company, status: e.status, quantity: e.quantity, note: e.note ?? "" }); setEntryError(""); }}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => setDeleteId(e._id)} className="text-slate-400 hover:text-red-500">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Movement Ledger ── */}
      {tab === "movements" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-wrap gap-3 items-end shadow-sm">
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Type</p>
              <select className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none" value={movTypeFilter} onChange={e => setMovTypeFilter(e.target.value)}>
                <option value="">All Types</option>
                {Object.entries(MOV_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">KG Size</p>
              <select className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none" value={movKgFilter} onChange={e => setMovKgFilter(e.target.value)}>
                <option value="">All Sizes</option>
                {KG_SIZES.map(kg => <option key={kg} value={kg}>{kg}kg</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Company</p>
              <select className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none" value={movCompanyFilter} onChange={e => setMovCompanyFilter(e.target.value)}>
                <option value="">All Companies</option>
                {companies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">From</p>
              <input type="date" className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none" value={movFrom} onChange={e => setMovFrom(e.target.value)} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">To</p>
              <input type="date" className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none" value={movTo} onChange={e => setMovTo(e.target.value)} />
            </div>
            {(movTypeFilter || movKgFilter || movCompanyFilter || movFrom || movTo) && (
              <button
                onClick={() => { setMovTypeFilter(""); setMovKgFilter(""); setMovCompanyFilter(""); setMovFrom(""); setMovTo(""); }}
                className="self-end px-3 py-2 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {loadingMov ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-slate-200 rounded-xl animate-pulse" />)}
            </div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl gap-3">
              <RefreshCw size={28} className="text-slate-300" />
              <p className="text-sm text-slate-500">No movements found.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="grid grid-cols-[140px_150px_55px_1fr_60px_90px_130px_110px] px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                {["Date", "Type", "KG", "Company", "Qty", "Change", "Note", "By"].map(h => (
                  <p key={h} className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{h}</p>
                ))}
              </div>
              <div className="divide-y divide-slate-100">
                {movements.map(m => (
                  <div key={m._id} className="grid grid-cols-[140px_150px_55px_1fr_60px_90px_130px_110px] items-center px-4 py-3 hover:bg-slate-50 transition-colors">
                    <p className="text-xs text-slate-500 tabular-nums">{format(new Date(m.date), "d MMM yy HH:mm")}</p>
                    <p className="text-xs font-medium text-slate-700">{MOV_LABELS[m.type] ?? m.type}</p>
                    <p className="text-xs font-medium text-slate-900">{m.kgSize}kg</p>
                    <p className="text-xs text-slate-700 truncate pr-2">{m.company}</p>
                    <p className="text-xs font-semibold text-slate-900 tabular-nums">{m.quantity}</p>
                    <DeltaBadge full={m.fullDelta} empty={m.emptyDelta} />
                    <p className="text-xs text-slate-400 truncate">{m.note ?? "—"}</p>
                    <p className="text-xs font-mono text-slate-500">{m.recordedBy?.userId ?? "system"}</p>
                  </div>
                ))}
              </div>
              {movPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
                  <span>Page {movPage} of {movPages} · {movTotal} total</span>
                  <div className="flex gap-2">
                    <button disabled={movPage === 1} onClick={() => loadMovements(movPage - 1)} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-30">Prev</button>
                    <button disabled={movPage === movPages} onClick={() => loadMovements(movPage + 1)} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-30">Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Record Movement Modal (2-step) ── */}
      <Modal
        open={movOpen}
        onClose={() => { setMovOpen(false); setMovStep("pick"); setMovType(null); }}
        title={movStep === "pick" ? "Record Movement" : (activeMovConfig?.label ?? "Record Movement")}
      >
        {movStep === "pick" ? (
          <div className="grid grid-cols-2 gap-3 pt-1">
            {MOV_CONFIG.map(cfg => (
              <button
                key={cfg.type}
                onClick={() => { setMovType(cfg.type); setMovStep("form"); }}
                className="flex flex-col gap-2 p-4 border border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <cfg.icon size={16} className="text-slate-700" />
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{cfg.effect}</span>
                </div>
                <p className="text-sm font-semibold text-slate-800 leading-tight">{cfg.label}</p>
                <p className="text-xs text-slate-500 leading-snug">{cfg.desc}</p>
              </button>
            ))}
          </div>
        ) : activeMovConfig ? (
          <div className="space-y-4">
            <button onClick={() => setMovStep("pick")} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors">
              <ArrowLeft size={12} /> Change type
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>KG Size</label>
                <select className={inputCls} value={movForm.kgSize} onChange={e => setMovForm(p => ({ ...p, kgSize: Number(e.target.value) }))}>
                  {KG_SIZES.map(kg => <option key={kg} value={kg}>{kg}kg</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Quantity</label>
                <input type="number" min={1} className={inputCls} value={movForm.quantity} onChange={e => setMovForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Company</label>
              <select className={inputCls} value={movForm.company} onChange={e => setMovForm(p => ({ ...p, company: e.target.value }))}>
                {companies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {movType === "return_empty" && (
              <div>
                <label className={labelCls}>Customer (optional)</label>
                <select className={inputCls} value={movForm.customerRef} onChange={e => setMovForm(p => ({ ...p, customerRef: e.target.value }))}>
                  <option value="">— None —</option>
                  {customers.map(c => <option key={c._id} value={c._id}>{c.fullName} ({c.userId})</option>)}
                </select>
              </div>
            )}

            {movType === "adjustment" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Full Change (+/-)</label>
                  <input type="number" className={inputCls} value={movForm.fullDelta} onChange={e => setMovForm(p => ({ ...p, fullDelta: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className={labelCls}>Empty Change (+/-)</label>
                  <input type="number" className={inputCls} value={movForm.emptyDelta} onChange={e => setMovForm(p => ({ ...p, emptyDelta: Number(e.target.value) }))} />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                <activeMovConfig.icon size={13} className="text-slate-500 shrink-0" />
                <span>{activeMovConfig.desc} — <strong>{activeMovConfig.effect.replace("N", String(movForm.quantity || 0))}</strong></span>
              </div>
            )}

            <div>
              <label className={labelCls}>Note (optional)</label>
              <input
                className={inputCls}
                placeholder="e.g. supplier name, delivery ref…"
                value={movForm.note}
                onChange={e => setMovForm(p => ({ ...p, note: e.target.value }))}
              />
            </div>

            {movError && <p className="text-xs text-gray-800 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2">{movError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setMovOpen(false)} className="px-4 py-2 text-sm rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200">Cancel</button>
              <button
                onClick={handleMovement}
                disabled={movSaving || !movForm.company}
                className="px-4 py-2 text-sm rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-700 disabled:opacity-50"
              >
                {movSaving ? "Saving…" : "Record"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ── Add / Edit Entry Modals ── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Stock Entry">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>KG Size</label>
              <select className={inputCls} value={stockForm.kgSize} onChange={e => setStockForm(p => ({ ...p, kgSize: Number(e.target.value) }))}>
                {KG_SIZES.map(kg => <option key={kg} value={kg}>{kg}kg</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={stockForm.status} onChange={e => setStockForm(p => ({ ...p, status: e.target.value as "full" | "empty" }))}>
                <option value="full">Full</option>
                <option value="empty">Empty</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Company</label>
            <select className={inputCls} value={stockForm.company} onChange={e => setStockForm(p => ({ ...p, company: e.target.value }))}>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Quantity</label>
            <input type="number" min={0} className={inputCls} value={stockForm.quantity} onChange={e => setStockForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
          </div>
          <div>
            <label className={labelCls}>Note (optional)</label>
            <input className={inputCls} value={stockForm.note} onChange={e => setStockForm(p => ({ ...p, note: e.target.value }))} />
          </div>
          {entryError && <p className="text-xs text-gray-800 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2">{entryError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200">Cancel</button>
            <button onClick={handleAddEntry} disabled={entrySaving} className="px-4 py-2 text-sm rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-700 disabled:opacity-50">
              {entrySaving ? "Saving…" : "Add Entry"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editEntry} onClose={() => setEditEntry(null)} title="Edit Stock Entry">
        <div className="space-y-4">
          <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
            {editEntry?.kgSize}kg · {editEntry?.company} · {editEntry?.status}
          </div>
          <div>
            <label className={labelCls}>Quantity</label>
            <input type="number" min={0} className={inputCls} value={stockForm.quantity} onChange={e => setStockForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
          </div>
          <div>
            <label className={labelCls}>Note (optional)</label>
            <input className={inputCls} value={stockForm.note} onChange={e => setStockForm(p => ({ ...p, note: e.target.value }))} />
          </div>
          {entryError && <p className="text-xs text-gray-800 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2">{entryError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditEntry(null)} className="px-4 py-2 text-sm rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200">Cancel</button>
            <button onClick={handleEditEntry} disabled={entrySaving} className="px-4 py-2 text-sm rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-700 disabled:opacity-50">
              {entrySaving ? "Saving…" : "Update"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteId}
        title="Delete Stock Entry"
        message="This stock entry will be permanently deleted."
        confirmLabel="Delete"
        onConfirm={handleDeleteEntry}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

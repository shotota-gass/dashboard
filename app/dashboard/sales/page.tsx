"use client";

import { useEffect, useState, useCallback } from "react";
import SectionHeader from "@/components/ui/SectionHeader";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import { Plus, Trash2, Search, X, Download, Filter } from "lucide-react";
import { PACKAGE_SIZES, SALE_TYPES } from "@/lib/constants";
import { useAppSettings } from "@/lib/useAppSettings";
import { format } from "date-fns";

interface Sale {
  _id: string;
  type: string;
  packageKg: number;
  company: string;
  quantity: number;
  notes?: string;
  date: string;
  customerRef?: { userId: string; fullName: string };
}
interface Customer { _id: string; userId: string; fullName: string; }

const inputCls = "w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-500 transition-colors";
const labelCls = "block text-xs font-medium text-slate-600 mb-1.5";

function TableSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-4 animate-pulse">
          <div className="h-3 bg-slate-200 rounded w-24" />
          <div className="h-3 bg-slate-200 rounded w-16" />
          <div className="h-3 bg-slate-200 rounded flex-1" />
        </div>
      ))}
    </div>
  );
}

function exportCSV(sales: Sale[]) {
  const rows = [
    ["Date", "Type", "Package (kg)", "Company", "Qty", "Customer", "Notes"],
    ...sales.map((s) => [
      format(new Date(s.date), "d MMM yyyy"), s.type, String(s.packageKg), s.company,
      String(s.quantity), s.customerRef ? `${s.customerRef.fullName} (${s.customerRef.userId})` : "", s.notes ?? "",
    ]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `sales_${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function SalesPage() {
  const { toast } = useToast();
  const { companies } = useAppSettings();
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [form, setForm] = useState({ type: "refill", packageKg: 12, company: companies[0] ?? "", quantity: 1, customerRef: "", notes: "", date: format(new Date(), "yyyy-MM-dd") });

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (typeFilter) params.set("type", typeFilter);
    if (companyFilter) params.set("company", companyFilter);
    const res = await fetch(`/api/sales?${params}`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setSales(data.sales ?? []); setTotal(data.total ?? 0); setPages(data.pages ?? 1); setPage(p);
    setLoading(false);
  }, [typeFilter, companyFilter]);

  useEffect(() => { load(1); }, [load]);
  useEffect(() => { fetch("/api/customers?page=1").then(r => r.json()).then(d => setCustomers(d.customers ?? [])); }, []);

  async function handleAdd() {
    setSaving(true); setError("");
    const res = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, packageKg: Number(form.packageKg), quantity: Number(form.quantity), customerRef: form.customerRef || undefined }) });
    setSaving(false);
    if (!res.ok) { setError("Failed to record sale."); return; }
    setAddOpen(false);
    setForm({ type: "refill", packageKg: 12, company: companies[0] ?? "", quantity: 1, customerRef: "", notes: "", date: format(new Date(), "yyyy-MM-dd") });
    load(1); toast("success", "Sale recorded successfully");
  }

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/sales?id=${deleteId}`, { method: "DELETE" });
    setDeleteId(null); load(page); toast("success", "Sale deleted");
  }

  const hasFilters = typeFilter || companyFilter;
  const filtered = search ? sales.filter(s => s.company.toLowerCase().includes(search.toLowerCase()) || s.type.includes(search)) : sales;

  return (
    <div>
      <SectionHeader
        title="Sales"
        description={`${total} total records`}
        action={
          <div className="flex gap-2">
            <button onClick={() => exportCSV(sales)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
              <Download size={14} /> Export
            </button>
            <button onClick={() => { setAddOpen(true); setError(""); }} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm rounded-xl hover:bg-slate-700 transition-colors font-medium">
              <Plus size={14} /> Record Sale
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-500" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setFiltersOpen(v => !v)} className={`flex items-center gap-2 px-3 py-2 text-sm rounded-xl border transition-colors ${hasFilters ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"}`}>
          <Filter size={13} /> Filters {hasFilters && <span className="w-4 h-4 rounded-full bg-white text-slate-900 text-[10px] font-bold flex items-center justify-center">{[typeFilter, companyFilter].filter(Boolean).length}</span>}
        </button>
        {hasFilters && <button onClick={() => { setTypeFilter(""); setCompanyFilter(""); }} className="flex items-center gap-1.5 px-3 text-sm text-slate-500 hover:text-slate-800 transition-colors"><X size={12} /> Clear</button>}
      </div>

      {filtersOpen && (
        <div className="flex flex-wrap gap-3 mb-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div>
            <label className={labelCls}>Sale Type</label>
            <select className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              {SALE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Company</label>
            <select className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
              <option value="">All Companies</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-[130px_90px_80px_1fr_50px_160px_120px_36px] px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          {["Date","Type","Pkg","Company","Qty","Customer","Notes",""].map(h => <p key={h} className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{h}</p>)}
        </div>
        {loading ? <TableSkeleton /> : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center"><Search size={20} className="text-slate-400" /></div>
            <p className="text-sm text-slate-500">No sales records found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(s => (
              <div key={s._id} className="grid grid-cols-[130px_90px_80px_1fr_50px_160px_120px_36px] items-center px-4 py-3.5 hover:bg-slate-50 transition-colors group">
                <p className="text-xs text-slate-500">{format(new Date(s.date), "d MMM yyyy")}</p>
                <Badge>{s.type}</Badge>
                <p className="text-xs font-medium text-slate-900">{s.packageKg} kg</p>
                <p className="text-xs text-slate-700 truncate pr-2">{s.company}</p>
                <p className="text-xs font-semibold text-slate-900">{s.quantity}</p>
                <p className="text-xs text-slate-500 truncate">{s.customerRef ? `${s.customerRef.fullName}` : "—"}</p>
                <p className="text-xs text-slate-400 truncate">{s.notes ?? "—"}</p>
                <button onClick={() => setDeleteId(s._id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-gray-900"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-500">Page {page} of {pages} · {total} records</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => load(page - 1)} className="px-3 py-1.5 text-xs rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">Prev</button>
              <button disabled={page === pages} onClick={() => load(page + 1)} className="px-3 py-1.5 text-xs rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Record Sale" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Sale Type</label><select className={inputCls} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>{SALE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></div>
            <div><label className={labelCls}>Package Size</label><select className={inputCls} value={form.packageKg} onChange={e => setForm(p => ({ ...p, packageKg: Number(e.target.value) }))}>{PACKAGE_SIZES.map(kg => <option key={kg} value={kg}>{kg} kg</option>)}</select></div>
          </div>
          <div><label className={labelCls}>Company</label><select className={inputCls} value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))}>{companies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Quantity</label><input type="number" min={1} className={inputCls} value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: Number(e.target.value) }))} /></div>
            <div><label className={labelCls}>Date</label><input type="date" className={inputCls} value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
          </div>
          <div><label className={labelCls}>Customer (optional)</label><select className={inputCls} value={form.customerRef} onChange={e => setForm(p => ({ ...p, customerRef: e.target.value }))}><option value="">— None —</option>{customers.map(c => <option key={c._id} value={c._id}>{c.fullName} ({c.userId})</option>)}</select></div>
          <div><label className={labelCls}>Notes (optional)</label><textarea className={inputCls} rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
          {error && <p className="text-xs text-gray-800 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-colors">Cancel</button>
            <button onClick={handleAdd} disabled={saving} className="px-4 py-2 text-sm rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors">{saving ? "Saving…" : "Record Sale"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteId} title="Delete Sale Record" message="This sale record will be permanently deleted. This action cannot be undone." confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import SectionHeader from "@/components/ui/SectionHeader";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import { Plus, Pencil, Trash2, Search, Download } from "lucide-react";
import { PACKAGE_SIZES } from "@/lib/constants";
import { format } from "date-fns";

interface Customer {
  _id: string; userId: string; fullName: string; nid: string; contact: string; comment?: string;
  address: { area: string; road: string; houseFlat: string };
  packageType: number; lastPackage?: string; billPaidTill?: string; createdAt: string;
}

const EMPTY_FORM = { userId: "", fullName: "", nid: "", contact: "", comment: "", area: "", road: "", houseFlat: "", packageType: 12, lastPackage: "", billPaidTill: "" };
const inputCls = "w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-500 transition-colors";
const labelCls = "block text-xs font-medium text-slate-600 mb-1.5";

function TableSkeleton() {
  return <div className="divide-y divide-slate-100">{[...Array(6)].map((_, i) => (
    <div key={i} className="flex gap-4 px-4 py-4 animate-pulse">
      <div className="h-3 bg-slate-200 rounded w-16" /><div className="h-3 bg-slate-200 rounded w-24" /><div className="h-3 bg-slate-200 rounded flex-1" /><div className="h-3 bg-slate-200 rounded w-20" />
    </div>
  ))}</div>;
}

function exportCSV(customers: Customer[]) {
  const rows = [
    ["User ID","Full Name","Contact","NID","Package","Area","Road","House","Bill Paid Till","Joined"],
    ...customers.map(c => [c.userId,c.fullName,c.contact,c.nid,`${c.packageType}kg`,c.address.area,c.address.road,c.address.houseFlat,c.billPaidTill ? format(new Date(c.billPaidTill),"d MMM yyyy") : "",format(new Date(c.createdAt),"d MMM yyyy")]),
  ];
  const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `customers_${format(new Date(),"yyyy-MM-dd")}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function CustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [billFilter, setBillFilter] = useState("");

  const load = useCallback(async (q = search, p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ q: encodeURIComponent(q), page: String(p) });
    if (billFilter === "overdue") params.set("overdue", "1");
    const res = await fetch(`/api/customers?${params}`);
    const data = await res.json();
    setCustomers(data.customers ?? []); setTotal(data.total ?? 0); setPages(data.pages ?? 1); setPage(p);
    setLoading(false);
  }, [search, billFilter]);

  useEffect(() => { load("", 1); }, [billFilter]);

  function handleSearch(e: React.FormEvent) { e.preventDefault(); load(search, 1); }

  async function handleSave() {
    setSaving(true); setError("");
    const payload = { userId: form.userId, fullName: form.fullName, nid: form.nid, contact: form.contact, comment: form.comment, address: { area: form.area, road: form.road, houseFlat: form.houseFlat }, packageType: Number(form.packageType), lastPackage: form.lastPackage || undefined, billPaidTill: form.billPaidTill || undefined };
    const method = editCustomer ? "PUT" : "POST";
    const body = editCustomer ? { id: editCustomer._id, ...payload } : payload;
    const res = await fetch("/api/customers", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to save."); return; }
    setAddOpen(false); setEditCustomer(null); setForm(EMPTY_FORM);
    load(search, page); toast("success", editCustomer ? "Customer updated" : "Customer added");
  }

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/customers?id=${deleteId}`, { method: "DELETE" });
    setDeleteId(null); load(search, page); toast("success", "Customer deleted");
  }

  function openEdit(c: Customer) {
    setEditCustomer(c);
    setForm({ userId: c.userId, fullName: c.fullName, nid: c.nid, contact: c.contact, comment: c.comment ?? "", area: c.address.area, road: c.address.road, houseFlat: c.address.houseFlat, packageType: c.packageType, lastPackage: c.lastPackage ? format(new Date(c.lastPackage), "yyyy-MM-dd") : "", billPaidTill: c.billPaidTill ? format(new Date(c.billPaidTill), "yyyy-MM-dd") : "" });
    setError("");
  }

  const FormBody = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>User ID</label><input className={inputCls} placeholder="e.g. C-001" value={form.userId} onChange={e => setForm(p => ({ ...p, userId: e.target.value }))} disabled={!!editCustomer} /></div>
        <div><label className={labelCls}>Package Type</label><select className={inputCls} value={form.packageType} onChange={e => setForm(p => ({ ...p, packageType: Number(e.target.value) }))}>{PACKAGE_SIZES.map(kg => <option key={kg} value={kg}>{kg} kg</option>)}</select></div>
      </div>
      <div><label className={labelCls}>Full Name</label><input className={inputCls} value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>NID Number</label><input className={inputCls} value={form.nid} onChange={e => setForm(p => ({ ...p, nid: e.target.value }))} /></div>
        <div><label className={labelCls}>Contact Number</label><input className={inputCls} value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} /></div>
      </div>
      <div><label className={labelCls}>Area</label><input className={inputCls} placeholder="Area / Thana" value={form.area} onChange={e => setForm(p => ({ ...p, area: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Road</label><input className={inputCls} value={form.road} onChange={e => setForm(p => ({ ...p, road: e.target.value }))} /></div>
        <div><label className={labelCls}>House / Flat</label><input className={inputCls} value={form.houseFlat} onChange={e => setForm(p => ({ ...p, houseFlat: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Last Package Date</label><input type="date" className={inputCls} value={form.lastPackage} onChange={e => setForm(p => ({ ...p, lastPackage: e.target.value }))} /></div>
        <div><label className={labelCls}>Bill Paid Till</label><input type="date" className={inputCls} value={form.billPaidTill} onChange={e => setForm(p => ({ ...p, billPaidTill: e.target.value }))} /></div>
      </div>
      <div><label className={labelCls}>Comment</label><textarea className={inputCls} rows={2} value={form.comment} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))} /></div>
      {error && <p className="text-xs text-gray-800 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={() => { setAddOpen(false); setEditCustomer(null); }} className="px-4 py-2 text-sm rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors">{saving ? "Saving…" : editCustomer ? "Update" : "Add Customer"}</button>
      </div>
    </div>
  );

  return (
    <div>
      <SectionHeader
        title="Customers"
        description={`${total} registered customers`}
        action={
          <div className="flex gap-2">
            <button onClick={() => exportCSV(customers)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl hover:bg-slate-50 transition-colors shadow-sm"><Download size={14} /> Export</button>
            <button onClick={() => { setAddOpen(true); setForm(EMPTY_FORM); setError(""); }} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm rounded-xl hover:bg-slate-700 transition-colors font-medium"><Plus size={14} /> Add Customer</button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px] max-w-xs">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-500" placeholder="Search name, ID, contact…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button type="submit" className="px-3 py-2 text-sm rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">Search</button>
        </form>
        <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1">
          {[["", "All"], ["active", "Active"], ["overdue", "Overdue"]].map(([v, l]) => (
            <button key={v} onClick={() => setBillFilter(v)} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${billFilter === v ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-[80px_1fr_110px_70px_130px_1fr_80px] px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          {["ID","Name","Contact","Pkg","Bill Paid Till","Address",""].map(h => <p key={h} className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{h}</p>)}
        </div>
        {loading ? <TableSkeleton /> : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center"><Search size={20} className="text-slate-400" /></div>
            <p className="text-sm text-slate-500">No customers found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {customers.map(c => {
              const billExpired = c.billPaidTill && new Date(c.billPaidTill) < new Date();
              return (
                <div key={c._id} className="grid grid-cols-[80px_1fr_110px_70px_130px_1fr_80px] items-center px-4 py-3.5 hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => setViewCustomer(c)}>
                  <p className="text-xs font-mono text-slate-500">{c.userId}</p>
                  <p className="text-sm font-medium text-slate-900 truncate pr-2">{c.fullName}</p>
                  <p className="text-xs text-slate-600">{c.contact}</p>
                  <Badge>{c.packageType} kg</Badge>
                  <div>{c.billPaidTill ? <Badge variant={billExpired ? "danger" : "success"}>{format(new Date(c.billPaidTill), "d MMM yyyy")}</Badge> : <span className="text-slate-400 text-xs">—</span>}</div>
                  <p className="text-xs text-slate-500 truncate">{c.address.area}, {c.address.road}</p>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-slate-700 transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => setDeleteId(c._id)} className="text-slate-400 hover:text-gray-900 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-500">Page {page} of {pages} · {total} customers</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => load(search, page - 1)} className="px-3 py-1.5 text-xs rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">Prev</button>
              <button disabled={page === pages} onClick={() => load(search, page + 1)} className="px-3 py-1.5 text-xs rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Customer" size="lg">{FormBody}</Modal>
      <Modal open={!!editCustomer} onClose={() => setEditCustomer(null)} title="Edit Customer" size="lg">{FormBody}</Modal>

      <Modal open={!!viewCustomer} onClose={() => setViewCustomer(null)} title="Customer Details" size="md">
        {viewCustomer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[["User ID", viewCustomer.userId],["Full Name", viewCustomer.fullName],["NID", viewCustomer.nid],["Contact", viewCustomer.contact],["Package", `${viewCustomer.packageType} kg`],["Last Package", viewCustomer.lastPackage ? format(new Date(viewCustomer.lastPackage), "d MMM yyyy") : "—"]].map(([l, v]) => (
                <div key={l} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{l}</p>
                  <p className="text-sm font-medium text-slate-900">{v}</p>
                </div>
              ))}
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Address</p>
              <p className="text-sm text-slate-900">{viewCustomer.address.area} — {viewCustomer.address.road} — {viewCustomer.address.houseFlat}</p>
            </div>
            {viewCustomer.billPaidTill && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Bill Paid Till</p>
                <p className="text-sm text-slate-900">{format(new Date(viewCustomer.billPaidTill), "d MMM yyyy")}</p>
              </div>
            )}
            {viewCustomer.comment && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Comment</p>
                <p className="text-sm text-slate-700">{viewCustomer.comment}</p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setViewCustomer(null); openEdit(viewCustomer); }} className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-colors"><Pencil size={13} /> Edit</button>
              <button onClick={() => setViewCustomer(null)} className="px-4 py-2 text-sm rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-700 transition-colors">Close</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal open={!!deleteId} title="Delete Customer" message="This customer record will be permanently removed. This action cannot be undone." confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}

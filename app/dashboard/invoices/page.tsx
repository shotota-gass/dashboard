"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, FileText, Search, Filter, CheckCircle, Clock, AlertTriangle,
  XCircle, ChevronDown, ChevronUp, Printer, CreditCard, Eye
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { useAppSettings } from "@/lib/useAppSettings";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Customer { _id: string; userId: string; fullName: string; contact: string; }
interface Branch   { _id: string; name: string; code: string; }
interface InvoiceItem { description: string; quantity: number; unitPrice: number; total: number; }
interface Invoice {
  _id: string;
  invoiceNumber: string;
  customerRef: Customer | null;
  branchRef: Branch | null;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  issuedDate: string;
  dueDate: string;
  paidDate?: string;
  notes?: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default"|"success"|"warning"|"danger"|"info"; icon: React.ElementType }> = {
  draft:     { label: "Draft",     variant: "default",  icon: FileText },
  issued:    { label: "Issued",    variant: "info",     icon: Clock },
  paid:      { label: "Paid",      variant: "success",  icon: CheckCircle },
  overdue:   { label: "Overdue",   variant: "danger",   icon: AlertTriangle },
  cancelled: { label: "Cancelled", variant: "default",  icon: XCircle },
};

const EMPTY_ITEM = { description: "", quantity: 1, unitPrice: 0, total: 0 };

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const { paymentMethods } = useAppSettings();
  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [pages, setPages]         = useState(1);
  const [loading, setLoading]     = useState(true);
  const [summary, setSummary]     = useState({ totalIssued: 0, totalPaid: 0, totalOverdue: 0, count: 0 });

  // filters
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("");
  const [from, setFrom]           = useState("");
  const [to, setTo]               = useState("");

  // modals
  const [viewInvoice, setViewInvoice]   = useState<Invoice | null>(null);
  const [createModal, setCreateModal]   = useState(false);
  const [payModal, setPayModal]         = useState<Invoice | null>(null);

  // create form
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches]   = useState<Branch[]>([]);
  const [cForm, setCForm] = useState({
    customerRef: "", branchRef: "", discount: 0, dueDate: "", notes: "",
    items: [{ ...EMPTY_ITEM }],
  });
  const [cError, setCError]   = useState("");
  const [cSaving, setCSaving] = useState(false);

  // payment form
  const [pForm, setPForm] = useState({ amount: 0, method: "cash", transactionId: "", note: "" });
  const [pError, setPError]   = useState("");
  const [pSaving, setPSaving] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), ...(statusFilter && { status: statusFilter }), ...(from && { from }), ...(to && { to }) });
    try {
      const res = await fetch(`/api/invoices?${params}`);
      const data = await res.json();
      setInvoices(data.invoices ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
      setSummary(data.summary ?? { totalIssued: 0, totalPaid: 0, totalOverdue: 0, count: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, from, to]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  useEffect(() => {
    fetch("/api/customers?limit=200").then(r => r.json()).then(d => setCustomers(d.customers ?? []));
    fetch("/api/branches").then(r => r.json()).then(d => setBranches(d.branches ?? []));
  }, []);

  // ─── Create invoice ─────────────────────────────────────────────────────────
  function addItem() {
    setCForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  }
  function removeItem(i: number) {
    setCForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  }
  function updateItem(i: number, field: string, value: string | number) {
    setCForm(f => {
      const items = f.items.map((item, idx) => {
        if (idx !== i) return item;
        const updated = { ...item, [field]: value };
        updated.total = updated.quantity * updated.unitPrice;
        return updated;
      });
      return { ...f, items };
    });
  }

  const subtotal = cForm.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const invoiceTotal = Math.max(0, subtotal - (cForm.discount || 0));

  async function handleCreate() {
    if (!cForm.customerRef || !cForm.dueDate || cForm.items.length === 0) {
      setCError("Customer, due date and at least one item are required.");
      return;
    }
    setCSaving(true); setCError("");
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cForm),
      });
      if (!res.ok) { const d = await res.json(); setCError(d.error ?? "Failed"); return; }
      setCreateModal(false);
      setCForm({ customerRef: "", branchRef: "", discount: 0, dueDate: "", notes: "", items: [{ ...EMPTY_ITEM }] });
      fetchInvoices();
    } finally { setCSaving(false); }
  }

  // ─── Mark paid / status change ──────────────────────────────────────────────
  async function markStatus(invoice: Invoice, status: string) {
    await fetch(`/api/invoices?id=${invoice._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchInvoices();
    if (viewInvoice?._id === invoice._id) setViewInvoice(null);
  }

  async function cancelInvoice(invoice: Invoice) {
    if (!confirm(`Cancel invoice ${invoice.invoiceNumber}?`)) return;
    await fetch(`/api/invoices?id=${invoice._id}`, { method: "DELETE" });
    fetchInvoices();
    setViewInvoice(null);
  }

  // ─── Record payment ─────────────────────────────────────────────────────────
  async function handlePayment() {
    if (!payModal || pForm.amount <= 0) { setPError("Enter a valid amount."); return; }
    setPSaving(true); setPError("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerRef: payModal.customerRef?._id,
          invoiceRef: payModal._id,
          amount: pForm.amount,
          method: pForm.method,
          transactionId: pForm.transactionId || undefined,
          note: pForm.note || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); setPError(d.error ?? "Failed"); return; }
      setPayModal(null);
      fetchInvoices();
    } finally { setPSaving(false); }
  }

  // ─── Print ──────────────────────────────────────────────────────────────────
  function printInvoice(inv: Invoice) {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>${inv.invoiceNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-size: 13px; }
        td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
        .total-row td { font-weight: bold; background: #f8fafc; }
        .meta { display: flex; gap: 40px; font-size: 13px; margin-bottom: 20px; }
        .meta div { display: flex; flex-direction: column; gap: 4px; }
        .meta label { font-weight: bold; color: #666; font-size: 11px; text-transform: uppercase; }
        @media print { button { display: none; } }
      </style></head><body>
      <h1>Shotota Gas</h1>
      <div class="sub">Invoice #${inv.invoiceNumber}</div>
      <div class="meta">
        <div><label>Customer</label><span>${inv.customerRef?.fullName ?? "—"} (${inv.customerRef?.userId ?? "—"})</span></div>
        <div><label>Issued</label><span>${new Date(inv.issuedDate).toLocaleDateString("en-GB")}</span></div>
        <div><label>Due</label><span>${new Date(inv.dueDate).toLocaleDateString("en-GB")}</span></div>
        <div><label>Status</label><span>${inv.status.toUpperCase()}</span></div>
        ${inv.branchRef ? `<div><label>Branch</label><span>${inv.branchRef.name}</span></div>` : ""}
      </div>
      <table>
        <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
        <tbody>
          ${inv.items.map(it => `<tr><td>${it.description}</td><td>${it.quantity}</td><td>৳${it.unitPrice.toLocaleString()}</td><td>৳${it.total.toLocaleString()}</td></tr>`).join("")}
        </tbody>
        <tfoot>
          <tr><td colspan="3" style="text-align:right">Subtotal</td><td>৳${inv.subtotal.toLocaleString()}</td></tr>
          ${inv.discount > 0 ? `<tr><td colspan="3" style="text-align:right">Discount</td><td>-৳${inv.discount.toLocaleString()}</td></tr>` : ""}
          <tr class="total-row"><td colspan="3" style="text-align:right">Total</td><td>৳${inv.total.toLocaleString()}</td></tr>
        </tfoot>
      </table>
      ${inv.notes ? `<p style="margin-top:20px;font-size:13px;color:#666">Notes: ${inv.notes}</p>` : ""}
      <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>`);
    win.document.close();
  }

  // ─── Filtered (client search) ────────────────────────────────────────────────
  const displayed = search
    ? invoices.filter(i =>
        i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        i.customerRef?.fullName.toLowerCase().includes(search.toLowerCase()) ||
        i.customerRef?.userId.toLowerCase().includes(search.toLowerCase())
      )
    : invoices;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} total invoice{total !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setCreateModal(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          <Plus size={16} />
          New Invoice
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Outstanding", value: summary.totalIssued, color: "text-gray-900", bg: "bg-gray-50 border-gray-200" },
          { label: "Overdue",     value: summary.totalOverdue, color: "text-gray-900", bg: "bg-gray-50 border-gray-200" },
          { label: "Collected",   value: summary.totalPaid,   color: "text-gray-900", bg: "bg-gray-50 border-gray-200" },
        ].map(c => (
          <div key={c.label} className={`border rounded-xl p-4 ${c.bg}`}>
            <p className="text-xs text-slate-500 mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>৳{c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            placeholder="Search invoice # or customer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          value={statusFilter}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <input type="date" className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} />
        <span className="text-slate-400 text-sm">—</span>
        <input type="date" className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : displayed.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p>No invoices found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["Invoice #", "Customer", "Branch", "Amount", "Issued", "Due", "Status", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(inv => {
                const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.draft;
                const isOverdue = inv.status === "issued" && new Date(inv.dueDate) < new Date();
                return (
                  <tr key={inv._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-slate-900">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{inv.customerRef?.fullName ?? "—"}</p>
                      <p className="text-xs text-slate-400">{inv.customerRef?.userId ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{inv.branchRef?.name ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">৳{inv.total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(inv.issuedDate).toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(inv.dueDate).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={isOverdue ? "danger" : cfg.variant}>
                        {isOverdue ? "Overdue" : cfg.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewInvoice(inv)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title="View">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => printInvoice(inv)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title="Print">
                          <Printer size={14} />
                        </button>
                        {(inv.status === "issued" || inv.status === "overdue") && (
                          <button onClick={() => { setPayModal(inv); setPForm({ amount: inv.total, method: "cash", transactionId: "", note: "" }); setPError(""); }} className="p-1.5 rounded hover:bg-gray-100 text-slate-400 hover:text-gray-700 transition-colors" title="Record Payment">
                            <CreditCard size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Prev</button>
          <span className="px-3 py-1.5 text-sm text-slate-600">{page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Next</button>
        </div>
      )}

      {/* ── View Invoice Modal ── */}
      {viewInvoice && (
        <Modal title={`Invoice ${viewInvoice.invoiceNumber}`} onClose={() => setViewInvoice(null)}>
          <div className="space-y-4">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Customer", `${viewInvoice.customerRef?.fullName ?? "—"} (${viewInvoice.customerRef?.userId ?? ""})`],
                ["Contact",  viewInvoice.customerRef?.contact ?? "—"],
                ["Branch",   viewInvoice.branchRef?.name ?? "—"],
                ["Status",   viewInvoice.status],
                ["Issued",   new Date(viewInvoice.issuedDate).toLocaleDateString("en-GB")],
                ["Due",      new Date(viewInvoice.dueDate).toLocaleDateString("en-GB")],
              ].map(([label, val]) => (
                <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="font-medium text-slate-900">{val}</p>
                </div>
              ))}
            </div>

            {/* Items */}
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead><tr className="bg-slate-50">
                <th className="text-left px-3 py-2 text-xs text-slate-500">Description</th>
                <th className="text-right px-3 py-2 text-xs text-slate-500">Qty</th>
                <th className="text-right px-3 py-2 text-xs text-slate-500">Unit</th>
                <th className="text-right px-3 py-2 text-xs text-slate-500">Total</th>
              </tr></thead>
              <tbody>
                {viewInvoice.items.map((it, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{it.description}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{it.quantity}</td>
                    <td className="px-3 py-2 text-right text-slate-600">৳{it.unitPrice.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">৳{it.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {viewInvoice.discount > 0 && (
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={3} className="px-3 py-2 text-right text-slate-500 text-xs">Discount</td>
                    <td className="px-3 py-2 text-right text-gray-700 font-medium">-৳{viewInvoice.discount.toLocaleString()}</td>
                  </tr>
                )}
                <tr className="border-t border-slate-300 bg-slate-100 font-bold">
                  <td colSpan={3} className="px-3 py-2 text-right text-slate-700">Total</td>
                  <td className="px-3 py-2 text-right text-slate-900">৳{viewInvoice.total.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>

            {viewInvoice.notes && (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2">Notes: {viewInvoice.notes}</p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={() => printInvoice(viewInvoice)} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <Printer size={14} />Print
              </button>
              {(viewInvoice.status === "issued" || viewInvoice.status === "overdue") && (
                <>
                  <button
                    onClick={() => { setPayModal(viewInvoice); setViewInvoice(null); setPForm({ amount: viewInvoice.total, method: "cash", transactionId: "", note: "" }); setPError(""); }}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <CreditCard size={14} />Record Payment
                  </button>
                  <button onClick={() => markStatus(viewInvoice, "paid")} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors">
                    <CheckCircle size={14} />Mark Paid
                  </button>
                </>
              )}
              {viewInvoice.status !== "cancelled" && viewInvoice.status !== "paid" && (
                <button onClick={() => cancelInvoice(viewInvoice)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors ml-auto">
                  <XCircle size={14} />Cancel
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Create Invoice Modal ── */}
      {createModal && (
        <Modal title="New Invoice" onClose={() => setCreateModal(false)}>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {cError && <div className="bg-gray-50 border border-gray-300 text-gray-800 px-3 py-2 rounded-lg text-sm">{cError}</div>}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Customer *</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  value={cForm.customerRef}
                  onChange={e => setCForm(f => ({ ...f, customerRef: e.target.value }))}
                >
                  <option value="">Select customer…</option>
                  {customers.map(c => <option key={c._id} value={c._id}>{c.fullName} ({c.userId})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Branch</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  value={cForm.branchRef}
                  onChange={e => setCForm(f => ({ ...f, branchRef: e.target.value }))}
                >
                  <option value="">No branch</option>
                  {branches.map(b => <option key={b._id} value={b._id}>{b.name} ({b.code})</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Due Date *</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  value={cForm.dueDate}
                  onChange={e => setCForm(f => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Discount (৳)</label>
                <input
                  type="number" min="0"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  value={cForm.discount}
                  onChange={e => setCForm(f => ({ ...f, discount: Number(e.target.value) }))}
                />
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-600">Line Items *</label>
                <button onClick={addItem} className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 transition-colors">
                  <Plus size={12} />Add Item
                </button>
              </div>
              <div className="space-y-2">
                {cForm.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      className="col-span-5 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                      placeholder="Description"
                      value={item.description}
                      onChange={e => updateItem(i, "description", e.target.value)}
                    />
                    <input
                      type="number" min="1"
                      className="col-span-2 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 text-center"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={e => updateItem(i, "quantity", Number(e.target.value))}
                    />
                    <input
                      type="number" min="0"
                      className="col-span-3 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                      placeholder="Unit ৳"
                      value={item.unitPrice}
                      onChange={e => updateItem(i, "unitPrice", Number(e.target.value))}
                    />
                    <div className="col-span-1 text-xs font-medium text-slate-700 text-right">৳{(item.quantity * item.unitPrice).toLocaleString()}</div>
                    <button onClick={() => removeItem(i)} className="col-span-1 text-slate-300 hover:text-gray-900 transition-colors text-center">✕</button>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-right text-sm">
                <span className="text-slate-500">Subtotal: </span><span className="font-medium text-slate-900">৳{subtotal.toLocaleString()}</span>
                {cForm.discount > 0 && <><span className="text-slate-400 ml-3">Discount: </span><span className="text-gray-700">-৳{cForm.discount.toLocaleString()}</span></>}
                <span className="text-slate-500 ml-3">Total: </span><span className="font-bold text-slate-900 text-base">৳{invoiceTotal.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                rows={2}
                placeholder="Optional notes…"
                value={cForm.notes}
                onChange={e => setCForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setCreateModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={cSaving} className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50">
                {cSaving ? "Creating…" : "Create Invoice"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Record Payment Modal ── */}
      {payModal && (
        <Modal title={`Record Payment — ${payModal.invoiceNumber}`} onClose={() => setPayModal(null)}>
          <div className="space-y-4">
            {pError && <div className="bg-gray-50 border border-gray-300 text-gray-800 px-3 py-2 rounded-lg text-sm">{pError}</div>}

            <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Customer:</span><span className="font-medium">{payModal.customerRef?.fullName}</span></div>
              <div className="flex justify-between mt-1"><span className="text-slate-500">Invoice Total:</span><span className="font-bold text-slate-900">৳{payModal.total.toLocaleString()}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount (৳) *</label>
                <input
                  type="number" min="1"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  value={pForm.amount}
                  onChange={e => setPForm(f => ({ ...f, amount: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Method *</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  value={pForm.method}
                  onChange={e => setPForm(f => ({ ...f, method: e.target.value }))}
                >
                  {paymentMethods.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
            </div>

            {pForm.method !== "cash" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Transaction ID</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Reference / transaction number"
                  value={pForm.transactionId}
                  onChange={e => setPForm(f => ({ ...f, transactionId: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="Optional note…"
                value={pForm.note}
                onChange={e => setPForm(f => ({ ...f, note: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setPayModal(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handlePayment} disabled={pSaving} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50">
                {pSaving ? "Saving…" : "Record Payment"}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

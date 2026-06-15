"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, CreditCard, AlertTriangle,
  TrendingDown, DollarSign, Users, ChevronRight, Clock, CalendarCheck, Printer, FileText
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { useAppSettings } from "@/lib/useAppSettings";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Customer {
  _id: string;
  userId: string;
  fullName: string;
  contact: string;
  packageType: number;
  billingRate: number;
  outstandingBalance: number;
  billPaidTill?: string;
  branchRef?: { name: string; code: string } | null;
  isActive: boolean;
}

interface Payment {
  _id: string;
  amount: number;
  method: string;
  transactionId?: string;
  date: string;
  note?: string;
  receivedBy?: { userId: string };
  invoiceRef?: { invoiceNumber: string; total: number; status: string } | null;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  total: number;
  status: string;
  issuedDate: string;
  dueDate: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysSince(dateStr?: string) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86400000);
}

function fmt(n: number) {
  return `৳${n.toLocaleString()}`;
}

/** Full calendar months between paidTill and today (floor). 0 if not overdue. */
function overdueMonths(billPaidTill?: string): number {
  if (!billPaidTill) return 0;
  const paid = new Date(billPaidTill);
  const now = new Date();
  if (paid >= now) return 0;
  return (now.getFullYear() - paid.getFullYear()) * 12 + (now.getMonth() - paid.getMonth());
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const [customers, setCustomers]         = useState<Customer[]>([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [pages, setPages]                 = useState(1);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [tab, setTab]                     = useState<"all" | "overdue" | "unpaid">("all");

  // customer detail panel
  const [selected, setSelected]           = useState<Customer | null>(null);
  const [custInvoices, setCustInvoices]   = useState<Invoice[]>([]);
  const [custPayments, setCustPayments]   = useState<Payment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // payment modal
  const [payModal, setPayModal]           = useState<Customer | null>(null);
  const [pForm, setPForm]                 = useState({ amount: 0, method: "cash", transactionId: "", note: "" });
  const [pError, setPError]               = useState("");
  const [pSaving, setPSaving]             = useState(false);

  // billing rate edit modal
  const [rateModal, setRateModal]         = useState<Customer | null>(null);
  const [rateVal, setRateVal]             = useState(0);
  const [rateSaving, setRateSaving]       = useState(false);

  // bulk billing modal
  const [bulkModal, setBulkModal]         = useState(false);
  const [bulkYear, setBulkYear]           = useState(() => new Date().getFullYear());
  const [bulkMonth, setBulkMonth]         = useState(() => new Date().getMonth() + 1);
  const [bulkRunning, setBulkRunning]     = useState(false);
  const [bulkResult, setBulkResult]       = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  // app settings (payment methods + late fee rate)
  const { paymentMethods, lateFeePerMonth } = useAppSettings();
  const [lateFeeModal, setLateFeeModal]       = useState<Customer | null>(null);
  const [lateFeeSaving, setLateFeeSaving]     = useState(false);
  const [lateFeeError, setLateFeeError]       = useState("");

  // summary
  const [summary, setSummary] = useState({ totalOutstanding: 0, overdueCount: 0, collectedMonth: 0 });

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), ...(search && { q: search }) });
    try {
      const res = await fetch(`/api/customers?${params}`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      const list: Customer[] = data.customers ?? [];
      setCustomers(list);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);

      // Compute summary from list
      const totalOutstanding = list.reduce((s, c) => s + (c.outstandingBalance ?? 0), 0);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const overdueCount = list.filter(c => c.billPaidTill && new Date(c.billPaidTill) < today).length;
      setSummary(s => ({ ...s, totalOutstanding, overdueCount }));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // Load monthly collected + late fee rate
  useEffect(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    fetch(`/api/payments?from=${from}&page=1`)
      .then(r => r.json())
      .then(d => setSummary(s => ({ ...s, collectedMonth: d.totalAmount ?? 0 })));
  }, []);

  async function loadCustomerDetail(c: Customer) {
    setSelected(c);
    setDetailLoading(true);
    const [invRes, payRes] = await Promise.all([
      fetch(`/api/invoices?customer=${c._id}&page=1`),
      fetch(`/api/payments?customer=${c._id}&page=1`),
    ]);
    const [invData, payData] = await Promise.all([invRes.json(), payRes.json()]);
    setCustInvoices(invData.invoices ?? []);
    setCustPayments(payData.payments ?? []);
    setDetailLoading(false);
  }

  // ─── Payment ──────────────────────────────────────────────────────────────
  async function handlePayment() {
    if (!payModal || pForm.amount <= 0) { setPError("Enter a valid amount."); return; }
    setPSaving(true); setPError("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerRef: payModal._id,
          amount: pForm.amount,
          method: pForm.method,
          transactionId: pForm.transactionId || undefined,
          note: pForm.note || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); setPError(d.error ?? "Failed"); return; }
      setPayModal(null);
      fetchCustomers();
      if (selected?._id === payModal._id) loadCustomerDetail({ ...payModal, outstandingBalance: payModal.outstandingBalance - pForm.amount });
    } finally { setPSaving(false); }
  }

  // ─── Billing rate ─────────────────────────────────────────────────────────
  async function handleRateSave() {
    if (!rateModal) return;
    setRateSaving(true);
    await fetch("/api/customers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rateModal._id, billingRate: rateVal }),
    });
    setRateModal(null);
    setRateSaving(false);
    fetchCustomers();
  }

  // ─── Bulk Billing ────────────────────────────────────────────────────────
  async function handleBulkBilling() {
    setBulkRunning(true);
    setBulkResult(null);
    try {
      const res = await fetch("/api/billing/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: bulkYear, month: bulkMonth }),
      });
      const d = await res.json();
      if (!res.ok) { setBulkResult({ created: 0, skipped: 0, errors: [d.error ?? "Failed"] }); return; }
      setBulkResult(d);
      fetchCustomers();
    } finally {
      setBulkRunning(false);
    }
  }

  // ─── Apply Late Fee ───────────────────────────────────────────────────────
  async function handleApplyLateFee() {
    if (!lateFeeModal) return;
    const months = overdueMonths(lateFeeModal.billPaidTill);
    const amount = lateFeePerMonth * months;
    if (amount <= 0) return;
    setLateFeeSaving(true);
    setLateFeeError("");
    try {
      const res = await fetch("/api/billing/late-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: lateFeeModal._id,
          amount,
          note: `Late fee: ${months} month(s) × ৳${lateFeePerMonth}`,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setLateFeeError(d.error ?? "Failed"); return; }
      setLateFeeModal(null);
      fetchCustomers();
      if (selected?._id === lateFeeModal._id) {
        setSelected(s => s ? { ...s, outstandingBalance: d.outstandingBalance } : null);
      }
    } finally { setLateFeeSaving(false); }
  }

  // ─── Print Helpers ────────────────────────────────────────────────────────
  function printReceipt(p: Payment, customer: Customer) {
    const win = window.open("", "_blank");
    if (!win) return;
    const methodLabel = paymentMethods.find(m => m.key === p.method)?.label ?? p.method;
    win.document.write(`
      <html><head><title>Receipt – ${new Date(p.date).toLocaleDateString("en-GB")}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:480px;margin:0 auto}
        h1{font-size:18px;margin-bottom:2px}
        .sub{color:#666;font-size:12px;margin-bottom:24px}
        .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:13px}
        .row:last-child{border-bottom:none}
        .label{color:#666}
        .total{font-weight:bold;font-size:16px;margin-top:16px;text-align:right}
        @media print{button{display:none}}
      </style></head><body>
      <h1>Shotota Gas</h1>
      <div class="sub">Payment Receipt</div>
      <div class="row"><span class="label">Customer</span><span>${customer.fullName} (${customer.userId})</span></div>
      <div class="row"><span class="label">Date</span><span>${new Date(p.date).toLocaleDateString("en-GB")}</span></div>
      <div class="row"><span class="label">Method</span><span>${methodLabel}</span></div>
      ${p.transactionId ? `<div class="row"><span class="label">Transaction ID</span><span>${p.transactionId}</span></div>` : ""}
      ${p.invoiceRef ? `<div class="row"><span class="label">Invoice</span><span>${(p.invoiceRef as {invoiceNumber:string}).invoiceNumber}</span></div>` : ""}
      ${p.note ? `<div class="row"><span class="label">Note</span><span>${p.note}</span></div>` : ""}
      <div class="total">৳${p.amount.toLocaleString()}</div>
      <br/><button onclick="window.print()">Print / Save as PDF</button>
      </body></html>`);
    win.document.close();
    win.focus();
  }

  function printStatement(customer: Customer) {
    const win = window.open("", "_blank");
    if (!win) return;
    const invRows = custInvoices.map(inv =>
      `<tr><td>${inv.invoiceNumber}</td><td>${new Date(inv.issuedDate).toLocaleDateString("en-GB")}</td><td>${new Date(inv.dueDate).toLocaleDateString("en-GB")}</td><td>${inv.status.toUpperCase()}</td><td style="text-align:right">৳${inv.total.toLocaleString()}</td></tr>`
    ).join("");
    const payRows = custPayments.map(p => {
      const method = paymentMethods.find(m => m.key === p.method)?.label ?? p.method;
      return `<tr><td>${new Date(p.date).toLocaleDateString("en-GB")}</td><td>${method}</td><td>${p.transactionId ?? "—"}</td><td style="text-align:right">৳${p.amount.toLocaleString()}</td></tr>`;
    }).join("");
    win.document.write(`
      <html><head><title>Statement – ${customer.fullName}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#111}
        h1{font-size:18px;margin-bottom:2px}
        .sub{color:#666;font-size:12px;margin-bottom:16px}
        h2{font-size:14px;margin:24px 0 8px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{background:#f1f5f9;text-align:left;padding:6px 10px}
        td{padding:6px 10px;border-bottom:1px solid #e2e8f0}
        .meta{display:flex;gap:32px;font-size:12px;margin-bottom:20px}
        .meta div{display:flex;flex-direction:column;gap:2px}
        .meta label{font-weight:bold;color:#666;font-size:10px;text-transform:uppercase}
        .balance{font-size:16px;font-weight:bold;margin-top:20px}
        @media print{button{display:none}}
      </style></head><body>
      <h1>Shotota Gas</h1>
      <div class="sub">Customer Account Statement</div>
      <div class="meta">
        <div><label>Customer</label><span>${customer.fullName}</span></div>
        <div><label>ID</label><span>${customer.userId}</span></div>
        <div><label>Package</label><span>${customer.packageType}kg</span></div>
        <div><label>Bill Paid Till</label><span>${customer.billPaidTill ? new Date(customer.billPaidTill).toLocaleDateString("en-GB") : "Never"}</span></div>
      </div>
      <h2>Invoices</h2>
      <table><thead><tr><th>Invoice #</th><th>Issued</th><th>Due</th><th>Status</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${invRows || "<tr><td colspan='5' style='color:#999'>No invoices</td></tr>"}</tbody></table>
      <h2>Payments</h2>
      <table><thead><tr><th>Date</th><th>Method</th><th>Ref</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${payRows || "<tr><td colspan='4' style='color:#999'>No payments</td></tr>"}</tbody></table>
      <div class="balance">Outstanding Balance: ৳${customer.outstandingBalance.toLocaleString()}</div>
      <br/><button onclick="window.print()">Print / Save as PDF</button>
      </body></html>`);
    win.document.close();
    win.focus();
  }

  // ─── Filtered display ─────────────────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const filtered = customers.filter(c => {
    if (tab === "overdue") return c.billPaidTill && new Date(c.billPaidTill) < today;
    if (tab === "unpaid")  return !c.billPaidTill;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Billing & Payments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Customer accounts, dues, and payment history</p>
        </div>
        <button
          onClick={() => { setBulkModal(true); setBulkResult(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          <CalendarCheck size={15} /> Run Monthly Billing
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <TrendingDown size={18} className="text-gray-700" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{fmt(summary.totalOutstanding)}</p>
            <p className="text-xs text-gray-500">Total Outstanding</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <AlertTriangle size={18} className="text-gray-700" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{summary.overdueCount}</p>
            <p className="text-xs text-gray-500">Overdue Customers</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <DollarSign size={18} className="text-gray-700" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{fmt(summary.collectedMonth)}</p>
            <p className="text-xs text-slate-500">Collected This Month</p>
          </div>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Left panel — customer list */}
        <div className="flex-1 min-w-0">

          {/* Tabs + Search */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 flex flex-wrap gap-3 items-center">
            <div className="flex rounded-lg bg-slate-100 p-0.5 gap-0.5">
              {(["all", "overdue", "unpaid"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${tab === t ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"}`}
                >
                  {t === "all" ? "All Customers" : t === "overdue" ? "Overdue" : "Never Paid"}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-36">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="Search customer…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          {/* Customer list */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Users size={36} className="mx-auto mb-2 opacity-30" />
                <p>No customers found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {["Customer", "Package", "Bill Rate", "Outstanding", "Paid Till", "Status", ""].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const overdue = c.billPaidTill && new Date(c.billPaidTill) < today;
                    const daysPast = overdue ? daysSince(c.billPaidTill) : null;
                    const isSelected = selected?._id === c._id;
                    return (
                      <tr
                        key={c._id}
                        onClick={() => loadCustomerDetail(c)}
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${isSelected ? "bg-slate-50 border-l-2 border-l-slate-900" : "hover:bg-slate-50"}`}
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-900">{c.fullName}</p>
                          <p className="text-xs text-slate-400">{c.userId}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{c.packageType}kg</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{fmt(c.billingRate)}/mo</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                          {fmt(c.outstandingBalance)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {c.billPaidTill ? new Date(c.billPaidTill).toLocaleDateString("en-GB") : <span className="text-slate-300">Never</span>}
                          {daysPast !== null && <p className="text-gray-500">{daysPast}d ago</p>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={overdue ? "danger" : !c.billPaidTill ? "warning" : "success"}>
                            {overdue ? "Overdue" : !c.billPaidTill ? "Unpaid" : "Current"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={e => { e.stopPropagation(); setPayModal(c); setPForm({ amount: c.outstandingBalance > 0 ? c.outstandingBalance : c.billingRate, method: "cash", transactionId: "", note: "" }); setPError(""); }}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                              title="Record Payment"
                            >
                              <CreditCard size={14} />
                            </button>
                            <ChevronRight size={14} className="text-slate-300" />
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
        </div>

        {/* Right panel — customer detail */}
        {selected && (
          <div className="w-80 shrink-0 space-y-4">
            {/* Account summary */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-slate-900">{selected.fullName}</p>
                  <p className="text-xs text-slate-400">{selected.userId}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-300 hover:text-slate-600 text-lg leading-none">✕</button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Package</span><span className="font-medium">{selected.packageType}kg</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Billing Rate</span>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{fmt(selected.billingRate)}/mo</span>
                    <button onClick={() => { setRateModal(selected); setRateVal(selected.billingRate); }} className="text-xs text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 hover:bg-slate-50 transition-colors">Edit</button>
                  </div>
                </div>
                <div className="flex justify-between"><span className="text-slate-500">Bill Paid Till</span><span className="font-medium">{selected.billPaidTill ? new Date(selected.billPaidTill).toLocaleDateString("en-GB") : "Never"}</span></div>
                <div className="flex justify-between border-t border-slate-100 pt-2 mt-2">
                  <span className="text-slate-500 font-medium">Outstanding</span>
                  <span className="font-bold text-base text-gray-900">{fmt(selected.outstandingBalance)}</span>
                </div>
              </div>
              <button
                onClick={() => { setPayModal(selected); setPForm({ amount: selected.outstandingBalance > 0 ? selected.outstandingBalance : selected.billingRate, method: "cash", transactionId: "", note: "" }); setPError(""); }}
                className="mt-4 w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard size={14} />Record Payment
              </button>
              {lateFeePerMonth > 0 && selected.billPaidTill && overdueMonths(selected.billPaidTill) > 0 && (
                <button
                  onClick={() => { setLateFeeModal(selected); setLateFeeError(""); }}
                  className="mt-2 w-full bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Clock size={14} />Apply Late Fee ({overdueMonths(selected.billPaidTill)} mo × {fmt(lateFeePerMonth)})
                </button>
              )}
              <button
                onClick={() => printStatement(selected)}
                className="mt-2 w-full bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <FileText size={14} />Print Account Statement
              </button>
            </div>

            {detailLoading ? (
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">Loading…</div>
            ) : (
              <>
                {/* Invoices */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">Invoices</p>
                    <span className="text-xs text-slate-400">{custInvoices.length}</span>
                  </div>
                  {custInvoices.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-slate-400">No invoices</p>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {custInvoices.map(inv => (
                        <div key={inv._id} className="px-4 py-2.5 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-mono font-medium text-slate-700">{inv.invoiceNumber}</p>
                            <p className="text-xs text-slate-400">{new Date(inv.issuedDate).toLocaleDateString("en-GB")}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-slate-900">{fmt(inv.total)}</p>
                            <Badge variant={inv.status === "paid" ? "success" : inv.status === "overdue" ? "danger" : "info"} >{inv.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payments */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">Payment History</p>
                    <span className="text-xs text-slate-400">{custPayments.length}</span>
                  </div>
                  {custPayments.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-slate-400">No payments recorded</p>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {custPayments.map(p => (
                        <div key={p._id} className="px-4 py-2.5 flex items-center justify-between group">
                          <div>
                            <p className="text-xs font-medium text-slate-700">{paymentMethods.find(m => m.key === p.method)?.label ?? p.method}</p>
                            <p className="text-xs text-slate-400">{new Date(p.date).toLocaleDateString("en-GB")}</p>
                            {p.transactionId && <p className="text-xs text-slate-400 font-mono">{p.transactionId}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-bold text-gray-900">{fmt(p.amount)}</p>
                            <button
                              onClick={() => printReceipt(p, selected!)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                              title="Print Receipt"
                            >
                              <Printer size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Payment Modal ── */}
      {payModal && (
        <Modal title="Record Payment" onClose={() => setPayModal(null)}>
          <div className="space-y-4">
            {pError && <div className="bg-gray-50 border border-gray-300 text-gray-800 px-3 py-2 rounded-lg text-sm">{pError}</div>}

            <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Customer:</span><span className="font-medium">{payModal.fullName}</span></div>
              <div className="flex justify-between mt-1"><span className="text-slate-500">Outstanding:</span><span className="font-bold text-gray-900">{fmt(payModal.outstandingBalance)}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount (৳) *</label>
                <input type="number" min="1"
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
                  placeholder="bKash/Nagad/bank ref"
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

      {/* ── Late Fee Modal ── */}
      {lateFeeModal && (
        <Modal title="Apply Late Fee" onClose={() => setLateFeeModal(null)}>
          <div className="space-y-4">
            {lateFeeError && <div className="bg-gray-50 border border-gray-300 text-gray-800 px-3 py-2 rounded-lg text-sm">{lateFeeError}</div>}
            <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">Customer:</span><span className="font-medium">{lateFeeModal.fullName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Bill Paid Till:</span><span className="font-medium">{lateFeeModal.billPaidTill ? new Date(lateFeeModal.billPaidTill).toLocaleDateString("en-GB") : "Never"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Overdue Months:</span><span className="font-semibold">{overdueMonths(lateFeeModal.billPaidTill)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Rate per Month:</span><span>{fmt(lateFeePerMonth)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5"><span className="text-slate-500 font-medium">Total Late Fee:</span><span className="font-bold text-base text-gray-900">{fmt(overdueMonths(lateFeeModal.billPaidTill) * lateFeePerMonth)}</span></div>
            </div>
            <p className="text-xs text-gray-500">This will add the late fee to the customer's outstanding balance.</p>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setLateFeeModal(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleApplyLateFee} disabled={lateFeeSaving} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50">
                {lateFeeSaving ? "Applying…" : `Add ${fmt(overdueMonths(lateFeeModal.billPaidTill) * lateFeePerMonth)} to Balance`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Billing Rate Modal ── */}
      {rateModal && (
        <Modal title="Update Billing Rate" onClose={() => setRateModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Set the monthly billing rate for <strong>{rateModal.fullName}</strong>.</p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Monthly Rate (৳)</label>
              <input
                type="number" min="0"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                value={rateVal}
                onChange={e => setRateVal(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRateModal(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleRateSave} disabled={rateSaving} className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50">
                {rateSaving ? "Saving…" : "Update Rate"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Bulk Billing Modal ── */}
      {bulkModal && (
        <Modal title="Run Monthly Billing" onClose={() => { setBulkModal(false); setBulkResult(null); }}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Generate invoices for all active customers for the selected month. Customers already invoiced that month will be skipped.
            </p>

            {!bulkResult ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Month</label>
                    <select
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                      value={bulkMonth}
                      onChange={e => setBulkMonth(Number(e.target.value))}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>
                          {new Date(2000, m - 1).toLocaleString("en-GB", { month: "long" })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
                    <input
                      type="number"
                      min="2020"
                      max="2100"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                      value={bulkYear}
                      onChange={e => setBulkYear(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-1">
                  <button onClick={() => setBulkModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                  <button onClick={handleBulkBilling} disabled={bulkRunning} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50">
                    {bulkRunning ? "Generating…" : "Generate Invoices"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-slate-50 rounded-lg px-4 py-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Invoices created</span><span className="font-semibold text-green-700">{bulkResult.created}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Skipped (already billed or no rate)</span><span className="font-medium text-slate-700">{bulkResult.skipped}</span></div>
                  {bulkResult.errors.length > 0 && (
                    <div className="pt-1 border-t border-slate-200">
                      <p className="text-xs text-red-600 font-medium mb-1">Errors ({bulkResult.errors.length})</p>
                      {bulkResult.errors.map((e, i) => <p key={i} className="text-xs text-red-500">{e}</p>)}
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button onClick={() => { setBulkModal(false); setBulkResult(null); }} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

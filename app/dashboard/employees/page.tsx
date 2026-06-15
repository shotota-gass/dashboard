"use client";

import { useEffect, useState } from "react";
import SectionHeader from "@/components/ui/SectionHeader";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ROLES, ROLE_LABELS } from "@/lib/constants";

interface Employee { _id: string; name: string; contact: string; nid: string; address: string; role: string; createdAt: string; }
interface UserRecord { _id: string; userId: string; role: string; employeeRef: string; }

const EMPTY_FORM = { name: "", contact: "", nid: "", address: "", role: "delivery_man", userId: "", password: "" };
const inputCls = "w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-500 transition-colors";
const labelCls = "block text-xs font-medium text-slate-600 mb-1.5";

function TableSkeleton() {
  return <div className="divide-y divide-slate-100">{[...Array(5)].map((_, i) => (
    <div key={i} className="flex gap-4 px-4 py-4 animate-pulse">
      <div className="h-3 bg-slate-200 rounded w-32" /><div className="h-3 bg-slate-200 rounded w-24" /><div className="h-3 bg-slate-200 rounded flex-1" />
    </div>
  ))}</div>;
}

export default function EmployeesPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/employees");
    const data = await res.json();
    setEmployees(data.employees ?? []); setUsers(data.users ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function getUserForEmp(empId: string) { return users.find(u => u.employeeRef === empId || u.employeeRef?.toString() === empId); }

  async function handleSave() {
    setSaving(true); setError("");
    const method = editEmp ? "PUT" : "POST";
    const body = editEmp ? { id: editEmp._id, name: form.name, contact: form.contact, nid: form.nid, address: form.address, role: form.role, password: form.password || undefined } : { ...form };
    const res = await fetch("/api/employees", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to save."); return; }
    setAddOpen(false); setEditEmp(null); setForm(EMPTY_FORM);
    load(); toast("success", editEmp ? "Employee updated" : "Employee added");
  }

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/employees?id=${deleteId}`, { method: "DELETE" });
    setDeleteId(null); load(); toast("success", "Employee removed");
  }

  function openEdit(e: Employee) {
    setEditEmp(e);
    const u = getUserForEmp(e._id);
    setForm({ name: e.name, contact: e.contact, nid: e.nid, address: e.address, role: e.role, userId: u?.userId ?? "", password: "" });
    setError("");
  }

  const FormBody = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Full Name</label><input className={inputCls} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
        <div><label className={labelCls}>Role</label><select className={inputCls} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>{ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Contact</label><input className={inputCls} value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} /></div>
        <div><label className={labelCls}>NID Number</label><input className={inputCls} value={form.nid} onChange={e => setForm(p => ({ ...p, nid: e.target.value }))} /></div>
      </div>
      <div><label className={labelCls}>Address</label><input className={inputCls} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
      <div className="border-t border-slate-200 pt-4">
        <p className="text-[10px] font-semibold text-slate-500 mb-3 uppercase tracking-widest">Login Account</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>User ID</label><input className={inputCls} placeholder="SG@XX45" value={form.userId} onChange={e => setForm(p => ({ ...p, userId: e.target.value }))} disabled={!!editEmp} /></div>
          <div><label className={labelCls}>{editEmp ? "New Password (blank = keep)" : "Password"}</label><input type="password" className={inputCls} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></div>
        </div>
      </div>
      {error && <p className="text-xs text-gray-800 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={() => { setAddOpen(false); setEditEmp(null); }} className="px-4 py-2 text-sm rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors">{saving ? "Saving…" : editEmp ? "Update" : "Add Employee"}</button>
      </div>
    </div>
  );

  return (
    <div>
      <SectionHeader
        title="Employees"
        description={`${employees.length} staff members`}
        action={
          <button onClick={() => { setAddOpen(true); setForm(EMPTY_FORM); setError(""); }} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm rounded-xl hover:bg-slate-700 transition-colors font-medium">
            <Plus size={14} /> Add Employee
          </button>
        }
      />

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-[1fr_130px_100px_110px_120px_1fr_72px] px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          {["Name","Role","User ID","Contact","NID","Address",""].map(h => <p key={h} className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{h}</p>)}
        </div>
        {loading ? <TableSkeleton /> : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center"><Plus size={20} className="text-slate-400" /></div>
            <p className="text-sm text-slate-500">No employees added yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {employees.map(e => {
              const u = getUserForEmp(e._id);
              return (
                <div key={e._id} className="grid grid-cols-[1fr_130px_100px_110px_120px_1fr_72px] items-center px-4 py-3.5 hover:bg-slate-50 transition-colors group">
                  <p className="text-sm font-medium text-slate-900 truncate pr-2">{e.name}</p>
                  <Badge>{ROLE_LABELS[e.role] ?? e.role}</Badge>
                  <p className="text-xs font-mono text-slate-500">{u?.userId ?? "—"}</p>
                  <p className="text-xs text-slate-600">{e.contact}</p>
                  <p className="text-xs text-slate-500">{e.nid}</p>
                  <p className="text-xs text-slate-500 truncate">{e.address}</p>
                  <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(e)} className="text-slate-400 hover:text-slate-700 transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => setDeleteId(e._id)} className="text-slate-400 hover:text-gray-900 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Employee" size="md">{FormBody}</Modal>
      <Modal open={!!editEmp} onClose={() => setEditEmp(null)} title="Edit Employee" size="md">{FormBody}</Modal>
      <ConfirmModal open={!!deleteId} title="Remove Employee" message="This will permanently delete the employee and their login account." confirmLabel="Remove" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}

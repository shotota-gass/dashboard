"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/ToastProvider";
import Modal from "@/components/ui/Modal";
import {
  User, Lock, Users, Plus, Key, Eye, EyeOff,
  Building2, CreditCard, Percent, Pencil, Trash2, Check, X, Tag,
  Database, Download, Upload, AlertTriangle, RefreshCw, History,
} from "lucide-react";
import { ROLES, ROLE_LABELS, PACKAGE_SIZES } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────────────
interface UserRow {
  _id: string;
  userId: string;
  displayName?: string;
  email?: string;
  role: string;
  createdAt: string;
}

interface PaymentMethod {
  key: string;
  label: string;
}

// ─── Shared input classes ─────────────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent";
const labelCls = "block text-xs font-medium text-gray-700 mb-1";

// ─── Profile Tab ─────────────────────────────────────────────────────────────
function ProfileTab() {
  const { toast } = useToast();
  const [profile, setProfile] = useState({ userId: "", displayName: "", email: "", role: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setProfile({
            userId: d.user.userId ?? "",
            displayName: d.user.displayName ?? "",
            email: d.user.email ?? "",
            role: d.user.role ?? "",
          });
        }
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: profile.displayName, email: profile.email }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to save.");
        return;
      }
      toast("success", "Profile updated");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md">
      <h2 className="text-base font-semibold text-gray-900 mb-5">Profile</h2>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className={labelCls}>User ID</label>
          <input className={`${inputCls} bg-gray-50 text-gray-500`} value={profile.userId} disabled />
          <p className="text-[11px] text-gray-400 mt-1">User ID cannot be changed.</p>
        </div>
        <div>
          <label className={labelCls}>Role</label>
          <input className={`${inputCls} bg-gray-50 text-gray-500`} value={ROLE_LABELS[profile.role] ?? profile.role} disabled />
        </div>
        <div>
          <label className={labelCls}>Display Name</label>
          <input
            className={inputCls}
            value={profile.displayName}
            onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
            placeholder="Your name"
          />
        </div>
        <div>
          <label className={labelCls}>Email Address</label>
          <input
            type="email"
            className={inputCls}
            value={profile.email}
            onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
            placeholder="you@example.com"
          />
          <p className="text-[11px] text-gray-400 mt-1">Used for password reset emails.</p>
        </div>
        {error && <p className="text-sm text-gray-800 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────
function SecurityTab() {
  const { toast } = useToast();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.newPassword.length < 6) { setError("New password must be at least 6 characters."); return; }
    if (form.newPassword !== form.confirmPassword) { setError("Passwords do not match."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Failed."); return; }
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast("success", "Password changed successfully");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md">
      <h2 className="text-base font-semibold text-gray-900 mb-5">Change Password</h2>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className={labelCls}>Current Password</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              className={inputCls}
              value={form.currentPassword}
              onChange={(e) => setForm((p) => ({ ...p, currentPassword: e.target.value }))}
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className={labelCls}>New Password</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              className={inputCls}
              value={form.newPassword}
              onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className={labelCls}>Confirm New Password</label>
          <input
            type="password"
            className={inputCls}
            value={form.confirmPassword}
            onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
            required
            minLength={6}
          />
        </div>
        {error && <p className="text-sm text-gray-800 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}

// ─── Users Tab (admin only) ───────────────────────────────────────────────────
function UsersTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [resetModal, setResetModal] = useState<UserRow | null>(null);
  const [editModal, setEditModal] = useState<UserRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ userId: "", password: "", role: "computer_operator", email: "", displayName: "" });
  const [editForm, setEditForm] = useState({ displayName: "", email: "", role: "" });
  const [resetPw, setResetPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editError, setEditError] = useState("");
  const [resetError, setResetError] = useState("");

  async function loadUsers() {
    setLoading(true);
    const res = await fetch("/api/settings/users");
    if (res.ok) {
      const d = await res.json();
      setUsers(d.users ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Failed."); return; }
      setCreateModal(false);
      setForm({ userId: "", password: "", role: "computer_operator", email: "", displayName: "" });
      loadUsers();
      toast("success", "User created");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetError("");
    if (!resetModal) return;
    if (resetPw.length < 6) { setResetError("Password must be at least 6 characters."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resetModal._id, password: resetPw }),
      });
      const d = await res.json();
      if (!res.ok) { setResetError(d.error ?? "Failed."); return; }
      setResetModal(null);
      setResetPw("");
      toast("success", `Password reset for ${resetModal.userId}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");
    if (!editModal) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editModal._id, displayName: editForm.displayName, email: editForm.email, role: editForm.role }),
      });
      const d = await res.json();
      if (!res.ok) { setEditError(d.error ?? "Failed."); return; }
      setEditModal(null);
      loadUsers();
      toast("success", `${editModal.userId} updated`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: UserRow) {
    const res = await fetch(`/api/settings/users?id=${user._id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) { toast("error", d.error ?? "Failed to delete."); return; }
    setDeleteConfirm(null);
    loadUsers();
    toast("success", `${user.userId} deleted`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-900">User Accounts</h2>
        <button
          onClick={() => { setCreateModal(true); setError(""); }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Plus size={14} /> New User
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No users found.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-[1fr_1fr_180px_120px_100px] px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            {["User ID", "Display Name", "Email", "Role", ""].map((h) => (
              <p key={h} className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{h}</p>
            ))}
          </div>
          <div className="divide-y divide-gray-100">
            {users.map((u) => (
              <div key={u._id} className="grid grid-cols-[1fr_1fr_180px_120px_auto] items-center px-4 py-3.5 hover:bg-gray-50 transition-colors group">
                <p className="text-sm font-mono font-medium text-gray-900">{u.userId}</p>
                <p className="text-sm text-gray-700 truncate">{u.displayName || <span className="text-gray-400">—</span>}</p>
                <p className="text-xs text-gray-500 truncate">{u.email || <span className="text-gray-400">—</span>}</p>
                <p className="text-xs text-gray-600">{ROLE_LABELS[u.role] ?? u.role}</p>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/dashboard/logs?user=${encodeURIComponent(u.userId)}`}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    title="View History"
                  >
                    <History size={12} /> History
                  </Link>
                  <button
                    onClick={() => { setResetModal(u); setResetPw(""); setResetError(""); }}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Reset Password"
                  >
                    <Key size={12} /> Reset PW
                  </button>
                  <button
                    onClick={() => { setEditModal(u); setEditForm({ displayName: u.displayName ?? "", email: u.email ?? "", role: u.role }); setEditError(""); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    title="Edit"
                  >
                    <Pencil size={13} />
                  </button>
                  {deleteConfirm?._id === u._id ? (
                    <div className="flex items-center gap-1 text-xs text-gray-600 ml-1">
                      <span>Delete?</span>
                      <button onClick={() => handleDelete(u)} className="px-2 py-0.5 rounded bg-gray-900 text-white hover:bg-gray-700 text-xs">Yes</button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs">No</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(u)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="New User">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>User ID *</label>
              <input className={inputCls} placeholder="SG@XX45" value={form.userId} onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Role *</label>
              <select className={inputCls} value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Password *</label>
            <input type="password" className={inputCls} minLength={6} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required />
          </div>
          <div>
            <label className={labelCls}>Display Name</label>
            <input className={inputCls} value={form.displayName} onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </div>
          {error && <p className="text-sm text-gray-800 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setCreateModal(false)} className="px-4 py-2 text-sm rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">{saving ? "Creating…" : "Create User"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!resetModal} onClose={() => setResetModal(null)} title={`Reset Password — ${resetModal?.userId}`}>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-sm text-gray-600">Set a new password for <strong>{resetModal?.userId}</strong>.</p>
          <div>
            <label className={labelCls}>New Password *</label>
            <input type="password" className={inputCls} minLength={6} value={resetPw} onChange={(e) => setResetPw(e.target.value)} required />
          </div>
          {resetError && <p className="text-sm text-gray-800 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2">{resetError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setResetModal(null)} className="px-4 py-2 text-sm rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">{saving ? "Saving…" : "Reset Password"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editModal} onClose={() => setEditModal(null)} title={`Edit User — ${editModal?.userId}`}>
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className={labelCls}>Display Name</label>
            <input className={inputCls} value={editForm.displayName} onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <select className={inputCls} value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          {editError && <p className="text-sm text-gray-800 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2">{editError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setEditModal(null)} className="px-4 py-2 text-sm rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">{saving ? "Saving…" : "Save Changes"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Companies Tab (admin only) ───────────────────────────────────────────────
function CompaniesTab() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings/app");
    if (res.ok) {
      const d = await res.json();
      setCompanies(d.companies ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(updated: string[]) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/app", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: updated }),
      });
      if (!res.ok) { toast("error", "Failed to save."); return; }
      setCompanies(updated);
      toast("success", "Companies updated");
    } finally {
      setSaving(false);
    }
  }

  function commitEdit(idx: number) {
    const trimmed = editVal.trim();
    if (!trimmed) return;
    const updated = companies.map((c, i) => i === idx ? trimmed : c);
    setEditingIdx(null);
    save(updated);
  }

  function addNew() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (companies.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      toast("error", "Company already exists.");
      return;
    }
    setNewName("");
    save([...companies, trimmed]);
  }

  function remove(idx: number) {
    save(companies.filter((_, i) => i !== idx));
    setDeleteConfirm(null);
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Gas Companies</h2>
      <p className="text-xs text-gray-500 mb-5">Manage the list of gas companies shown in sales and stock forms.</p>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="space-y-1 mb-4">
          {companies.map((c, idx) => (
            <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 group">
              {editingIdx === idx ? (
                <>
                  <input
                    className="flex-1 text-sm border-0 outline-none bg-transparent"
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitEdit(idx); if (e.key === "Escape") setEditingIdx(null); }}
                    autoFocus
                  />
                  <button onClick={() => commitEdit(idx)} disabled={saving} className="text-gray-600 hover:text-gray-900 p-1 rounded"><Check size={13} /></button>
                  <button onClick={() => setEditingIdx(null)} className="text-gray-400 hover:text-gray-700 p-1 rounded"><X size={13} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-800">{c}</span>
                  {deleteConfirm === idx ? (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <span>Delete?</span>
                      <button onClick={() => remove(idx)} className="px-2 py-0.5 rounded bg-gray-900 text-white hover:bg-gray-700 text-xs">Yes</button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs">No</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingIdx(idx); setEditVal(c); }} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteConfirm(idx)} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"><Trash2 size={13} /></button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      <div className="flex gap-2">
        <input
          className={`${inputCls} flex-1`}
          placeholder="New company name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addNew(); }}
        />
        <button
          onClick={addNew}
          disabled={saving || !newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
}

// ─── Payment Methods Tab (admin only) ────────────────────────────────────────
function PaymentMethodsTab() {
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState<PaymentMethod>({ key: "", label: "" });
  const [newMethod, setNewMethod] = useState<PaymentMethod>({ key: "", label: "" });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings/app");
    if (res.ok) {
      const d = await res.json();
      setMethods(d.paymentMethods ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveMethods(updated: PaymentMethod[]) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/app", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethods: updated }),
      });
      if (!res.ok) { toast("error", "Failed to save."); return; }
      setMethods(updated);
      toast("success", "Payment methods updated");
    } finally {
      setSaving(false);
    }
  }

  function commitEdit(idx: number) {
    if (!editVal.key.trim() || !editVal.label.trim()) return;
    const updated = methods.map((m, i) => i === idx ? { key: editVal.key.trim(), label: editVal.label.trim() } : m);
    setEditingIdx(null);
    saveMethods(updated);
  }

  function addNew() {
    const key = newMethod.key.trim().toLowerCase().replace(/\s+/g, "_");
    const label = newMethod.label.trim();
    if (!key || !label) return;
    if (methods.some((m) => m.key === key)) {
      toast("error", "Key already exists.");
      return;
    }
    setNewMethod({ key: "", label: "" });
    saveMethods([...methods, { key, label }]);
  }

  function remove(idx: number) {
    saveMethods(methods.filter((_, i) => i !== idx));
    setDeleteConfirm(null);
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Payment Methods</h2>
      <p className="text-xs text-gray-500 mb-5">Manage payment methods shown in billing and invoice forms.</p>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="space-y-1 mb-4">
          {methods.map((m, idx) => (
            <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 group">
              {editingIdx === idx ? (
                <>
                  <input
                    className="w-28 text-xs font-mono border border-gray-300 rounded px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-gray-400"
                    value={editVal.key}
                    onChange={(e) => setEditVal((v) => ({ ...v, key: e.target.value }))}
                    placeholder="key"
                  />
                  <input
                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-gray-400"
                    value={editVal.label}
                    onChange={(e) => setEditVal((v) => ({ ...v, label: e.target.value }))}
                    placeholder="Label"
                    onKeyDown={(e) => { if (e.key === "Enter") commitEdit(idx); if (e.key === "Escape") setEditingIdx(null); }}
                    autoFocus
                  />
                  <button onClick={() => commitEdit(idx)} disabled={saving} className="text-gray-600 hover:text-gray-900 p-1 rounded"><Check size={13} /></button>
                  <button onClick={() => setEditingIdx(null)} className="text-gray-400 hover:text-gray-700 p-1 rounded"><X size={13} /></button>
                </>
              ) : (
                <>
                  <span className="w-28 text-xs font-mono text-gray-500">{m.key}</span>
                  <span className="flex-1 text-sm text-gray-800">{m.label}</span>
                  {deleteConfirm === idx ? (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <span>Delete?</span>
                      <button onClick={() => remove(idx)} className="px-2 py-0.5 rounded bg-gray-900 text-white hover:bg-gray-700 text-xs">Yes</button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs">No</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingIdx(idx); setEditVal(m); }} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteConfirm(idx)} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"><Trash2 size={13} /></button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      <div className="flex gap-2">
        <input
          className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-gray-400"
          placeholder="key…"
          value={newMethod.key}
          onChange={(e) => setNewMethod((v) => ({ ...v, key: e.target.value }))}
        />
        <input
          className={`${inputCls} flex-1`}
          placeholder="Label (e.g. bKash)…"
          value={newMethod.label}
          onChange={(e) => setNewMethod((v) => ({ ...v, label: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") addNew(); }}
        />
        <button
          onClick={addNew}
          disabled={saving || !newMethod.key.trim() || !newMethod.label.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
}

// ─── Price List Tab (admin only) ─────────────────────────────────────────────
function PriceListTab() {
  const { toast } = useToast();
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/app")
      .then((r) => r.json())
      .then((d) => {
        const pl = d.priceList ?? {};
        const parsed: Record<number, number> = {};
        for (const kg of PACKAGE_SIZES) {
          parsed[kg] = pl[kg] ?? pl[String(kg)] ?? 0;
        }
        setPrices(parsed);
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings/app", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceList: prices }),
      });
      if (!res.ok) { toast("error", "Failed to save."); return; }
      toast("success", "Price list updated");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Price List</h2>
      <p className="text-xs text-gray-500 mb-5">
        Default sale prices per package size (BDT). Used as defaults when creating invoices and bulk billing.
      </p>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          {PACKAGE_SIZES.map((kg) => (
            <div key={kg} className="flex items-center gap-3">
              <div className="w-20 shrink-0">
                <span className="text-sm font-medium text-gray-700">{kg} kg</span>
              </div>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">৳</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={`${inputCls} pl-7`}
                  value={prices[kg] ?? 0}
                  onChange={(e) => setPrices((p) => ({ ...p, [kg]: Number(e.target.value) }))}
                />
              </div>
            </div>
          ))}
          <button
            type="submit"
            disabled={saving}
            className="mt-2 px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Prices"}
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Database Tab (admin only) ───────────────────────────────────────────────
interface CollectionStat { collection: string; count: number; }

const COL_LABELS: Record<string, string> = {
  users: "Users", employees: "Employees", branches: "Branches", appsettings: "App Settings",
  customers: "Customers", invoices: "Invoices", payments: "Payments", sales: "Sales",
  stockentries: "Stock Entries", stockmovements: "Stock Movements", logs: "Logs",
};

const PRESERVED_COLS = new Set(["users", "employees", "branches", "appsettings"]);

function DatabaseTab() {
  const { toast } = useToast();
  const [stats, setStats] = useState<CollectionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [backing, setBacking] = useState(false);
  const [resetPhase, setResetPhase] = useState<"idle" | "confirm" | "running">("idle");
  const [confirmText, setConfirmText] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePhase, setRestorePhase] = useState<"idle" | "confirm" | "running">("idle");
  const [restoreConfirmText, setRestoreConfirmText] = useState("");

  async function loadStats() {
    setLoading(true);
    const res = await fetch("/api/settings/database");
    if (res.ok) {
      const d = await res.json();
      setStats(d.stats ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { loadStats(); }, []);

  async function handleBackup() {
    setBacking(true);
    try {
      const res = await fetch("/api/settings/database/backup");
      if (!res.ok) { toast("error", "Backup failed."); return; }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "backup.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      toast("success", "Backup downloaded");
    } finally {
      setBacking(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    setRestoreFile(file);
    setRestorePhase("confirm");
    setRestoreConfirmText("");
  }

  async function handleRestore() {
    if (!restoreFile || restoreConfirmText !== "RESTORE") return;
    setRestorePhase("running");
    try {
      const text = await restoreFile.text();
      const data = JSON.parse(text);
      const res = await fetch("/api/settings/database/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESTORE", data }),
      });
      if (!res.ok) { toast("error", "Restore failed."); setRestorePhase("confirm"); return; }
      toast("success", "Database restored from backup");
      setRestorePhase("idle");
      setRestoreFile(null);
      setRestoreConfirmText("");
      loadStats();
    } catch {
      toast("error", "Restore failed — invalid backup file.");
      setRestorePhase("confirm");
    }
  }

  async function handleReset() {
    if (confirmText !== "RESET") return;
    setResetPhase("running");
    try {
      const res = await fetch("/api/settings/database/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET" }),
      });
      if (!res.ok) { toast("error", "Reset failed."); setResetPhase("confirm"); return; }
      toast("success", "Database reset — operational data wiped");
      setResetPhase("idle");
      setConfirmText("");
      loadStats();
    } catch {
      toast("error", "Reset failed.");
      setResetPhase("confirm");
    }
  }

  const operationalTotal = stats
    .filter(s => !PRESERVED_COLS.has(s.collection))
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="max-w-lg">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Database</h2>
      <p className="text-xs text-gray-500 mb-5">Backup, inspect, or reset operational data. Users, employees, branches, and settings are always preserved.</p>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={handleBackup}
          disabled={backing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          <Download size={14} /> {backing ? "Preparing…" : "Download Backup"}
        </button>
        <button
          onClick={loadStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
        <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
          <Upload size={14} /> Upload Backup
          <input type="file" accept="application/json" className="hidden" onChange={handleFileSelect} />
        </label>
      </div>

      {/* Restore section */}
      {restoreFile && (
        <div className="border border-amber-200 rounded-xl p-4 bg-amber-50 mb-6">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Restore from {restoreFile.name}</p>
              <p className="text-xs text-amber-600 mt-0.5">
                This will overwrite existing data for every collection present in the file. This cannot be undone.
              </p>
            </div>
          </div>

          {restorePhase === "confirm" && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-amber-700">Type <span className="font-mono bg-amber-100 px-1 rounded">RESTORE</span> to confirm:</p>
              <input
                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                placeholder="RESTORE"
                value={restoreConfirmText}
                onChange={e => setRestoreConfirmText(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRestore}
                  disabled={restoreConfirmText !== "RESTORE"}
                  className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-40 transition-colors"
                >
                  Confirm Restore
                </button>
                <button
                  onClick={() => { setRestorePhase("idle"); setRestoreFile(null); setRestoreConfirmText(""); }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {restorePhase === "running" && (
            <p className="text-sm text-amber-600 flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin" /> Restoring…
            </p>
          )}
        </div>
      )}

      {/* Collection stats */}
      {loading ? (
        <div className="space-y-1.5">
          {[1,2,3,4,5].map(i => <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="grid grid-cols-[1fr_auto] px-4 py-2 bg-gray-50 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Collection</p>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-right">Documents</p>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.map(s => (
              <div key={s.collection} className="grid grid-cols-[1fr_auto] items-center px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${PRESERVED_COLS.has(s.collection) ? "bg-gray-300" : "bg-gray-700"}`} />
                  <span className="text-sm text-gray-700">{COL_LABELS[s.collection] ?? s.collection}</span>
                  {PRESERVED_COLS.has(s.collection) && (
                    <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1 py-px">preserved</span>
                  )}
                </div>
                <span className="text-sm font-mono font-medium text-gray-900">{s.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reset section */}
      <div className="border border-red-200 rounded-xl p-4 bg-red-50">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">Reset Operational Data</p>
            <p className="text-xs text-red-600 mt-0.5">
              Permanently deletes all customers, invoices, payments, sales, stock, and logs
              ({operationalTotal.toLocaleString()} documents). Users, employees, branches, and settings are kept.
            </p>
          </div>
        </div>

        {resetPhase === "idle" && (
          <button
            onClick={() => { setResetPhase("confirm"); setConfirmText(""); }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
          >
            Reset Database
          </button>
        )}

        {resetPhase === "confirm" && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-red-700">Type <span className="font-mono bg-red-100 px-1 rounded">RESET</span> to confirm:</p>
            <input
              className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400 font-mono"
              placeholder="RESET"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                disabled={confirmText !== "RESET"}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                Confirm Reset
              </button>
              <button
                onClick={() => { setResetPhase("idle"); setConfirmText(""); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {resetPhase === "running" && (
          <p className="text-sm text-red-600 flex items-center gap-2">
            <RefreshCw size={14} className="animate-spin" /> Resetting…
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Late Fees Tab (admin only) ───────────────────────────────────────────────
function LateFeesTab() {
  const { toast } = useToast();
  const [rate, setRate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/app")
      .then((r) => r.json())
      .then((d) => {
        setRate(String(d.lateFeePerMonth ?? 0));
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const val = Number(rate);
    if (isNaN(val) || val < 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/app", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lateFeePerMonth: val }),
      });
      if (!res.ok) { toast("error", "Failed to save."); return; }
      toast("success", "Late fee rate updated");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Late Payment Fees</h2>
      <p className="text-xs text-gray-500 mb-5">
        Set a flat monthly late fee (BDT) charged per overdue billing month. A fee of ৳0 disables late fees.
      </p>

      {loading ? (
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className={labelCls}>Monthly Late Fee (৳ per overdue month)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">৳</span>
              <input
                type="number"
                min="0"
                step="1"
                className={`${inputCls} pl-7`}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Applied per complete overdue month in the billing page.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Rate"}
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────
type TabId = "profile" | "security" | "users" | "companies" | "paymentMethods" | "priceList" | "lateFees" | "database";

const TABS: { id: TabId; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { id: "profile",        label: "Profile",          icon: User },
  { id: "security",       label: "Security",          icon: Lock },
  { id: "users",          label: "Users",             icon: Users,        adminOnly: true },
  { id: "companies",      label: "Companies",         icon: Building2,    adminOnly: true },
  { id: "paymentMethods", label: "Payment Methods",   icon: CreditCard,   adminOnly: true },
  { id: "priceList",      label: "Price List",        icon: Tag,          adminOnly: true },
  { id: "lateFees",       label: "Late Fees",         icon: Percent,      adminOnly: true },
  { id: "database",       label: "Database",          icon: Database,     adminOnly: true },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>("profile");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/settings/profile")
      .then((r) => r.json())
      .then((d) => { if (d.user?.role === "admin") setIsAdmin(true); });
  }, []);

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account and system preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <aside className="w-48 shrink-0">
          <nav className="space-y-0.5">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg transition-colors text-left ${
                  tab === t.id ? "bg-gray-900 text-white font-medium" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <t.icon size={15} />
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm min-h-[400px]">
          {tab === "profile"        && <ProfileTab />}
          {tab === "security"       && <SecurityTab />}
          {tab === "users"          && <UsersTab />}
          {tab === "companies"      && <CompaniesTab />}
          {tab === "paymentMethods" && <PaymentMethodsTab />}
          {tab === "priceList"      && <PriceListTab />}
          {tab === "lateFees"       && <LateFeesTab />}
          {tab === "database"       && <DatabaseTab />}
        </div>
      </div>
    </div>
  );
}

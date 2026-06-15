"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Building2, Edit2, PowerOff, Phone, MapPin, Hash, Users } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";

interface Branch {
  _id: string;
  name: string;
  code: string;
  address: string;
  contact: string;
  isActive: boolean;
  managerRef?: { userId: string; role: string } | null;
  createdAt: string;
}

const EMPTY_FORM = { name: "", code: "", address: "", contact: "", managerRef: "" };

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/branches?active=${!showAll}`);
      const data = await res.json();
      setBranches(data.branches ?? []);
    } catch {
      setError("Failed to load branches");
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setModal("create");
  }

  function openEdit(b: Branch) {
    setEditing(b);
    setForm({ name: b.name, code: b.code, address: b.address, contact: b.contact, managerRef: b.managerRef?.userId ?? "" });
    setFormError("");
    setModal("edit");
  }

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim() || !form.address.trim() || !form.contact.trim()) {
      setFormError("All fields except manager are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      let res;
      if (modal === "create") {
        res = await fetch("/api/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        res = await fetch(`/api/branches?id=${editing!._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error ?? "Failed to save");
        return;
      }
      setModal(null);
      fetchBranches();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(b: Branch) {
    if (!confirm(`Deactivate branch "${b.name}"?`)) return;
    await fetch(`/api/branches?id=${b._id}`, { method: "DELETE" });
    fetchBranches();
  }

  const active   = branches.filter(b => b.isActive);
  const inactive = branches.filter(b => !b.isActive);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Branches</h1>
          <p className="text-sm text-slate-500 mt-0.5">{active.length} active branch{active.length !== 1 ? "es" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showAll}
              onChange={e => setShowAll(e.target.checked)}
              className="rounded"
            />
            Show inactive
          </label>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            <Plus size={16} />
            New Branch
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-gray-50 border border-gray-300 text-gray-800 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-1/2 mb-3" />
              <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
              <div className="h-4 bg-slate-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : branches.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Building2 size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No branches yet</p>
          <p className="text-sm mt-1">Add your first branch to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(b => (
            <div
              key={b._id}
              className={`bg-white border rounded-xl p-5 transition-all ${b.isActive ? "border-slate-200 shadow-sm" : "border-slate-100 opacity-60"}`}
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${b.isActive ? "bg-slate-900" : "bg-slate-300"}`}>
                    <Building2 size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm leading-tight">{b.name}</p>
                    <p className="text-xs text-slate-400">{b.code}</p>
                  </div>
                </div>
                <Badge variant={b.isActive ? "success" : "default"}>{b.isActive ? "Active" : "Inactive"}</Badge>
              </div>

              {/* Details */}
              <div className="space-y-1.5 mb-4">
                <div className="flex items-start gap-2 text-xs text-slate-600">
                  <MapPin size={12} className="mt-0.5 shrink-0 text-slate-400" />
                  <span className="leading-tight">{b.address}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Phone size={12} className="shrink-0 text-slate-400" />
                  <span>{b.contact}</span>
                </div>
                {b.managerRef && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Users size={12} className="shrink-0 text-slate-400" />
                    <span>{b.managerRef.userId}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => openEdit(b)}
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <Edit2 size={12} />
                  Edit
                </button>
                {b.isActive && (
                  <button
                    onClick={() => handleDeactivate(b)}
                    className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors ml-auto"
                  >
                    <PowerOff size={12} />
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary stats */}
      {!loading && branches.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          {[
            { label: "Total Branches", value: branches.length, icon: Building2 },
            { label: "Active", value: active.length, icon: Hash },
            { label: "Inactive", value: inactive.length, icon: PowerOff },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
                <stat.icon size={16} className="text-slate-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modal && (
        <Modal title={modal === "create" ? "New Branch" : "Edit Branch"} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {formError && (
              <div className="bg-gray-50 border border-gray-300 text-gray-800 px-3 py-2 rounded-lg text-sm">{formError}</div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Branch Name *</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="e.g. Dhaka Main Branch"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Branch Code *</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 uppercase"
                  placeholder="e.g. DHK-01"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  disabled={modal === "edit"}
                />
                {modal === "edit" && <p className="text-xs text-slate-400 mt-1">Code cannot be changed</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Address *</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="Full address"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Contact *</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="01XXXXXXXXX"
                  value={form.contact}
                  onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Manager User ID</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="SG@**45 (optional)"
                  value={form.managerRef}
                  onChange={e => setForm(f => ({ ...f, managerRef: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : modal === "create" ? "Create Branch" : "Save Changes"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

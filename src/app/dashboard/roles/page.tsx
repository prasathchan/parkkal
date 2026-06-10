"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { useToast } from "@/context/toast-context";
import { orgApi, ApiError } from "@/api";
import type { OrgRole } from "@/types";

const ALL_PERMISSIONS = [
  { group: "Patients", perms: ["patients.view", "patients.create", "patients.edit", "patients.delete"] },
  { group: "Appointments", perms: ["appointments.view", "appointments.create", "appointments.edit"] },
  { group: "Visits", perms: ["visits.view", "visits.create", "visits.edit"] },
  { group: "Billing", perms: ["billing.view", "billing.manage"] },
  { group: "Staff", perms: ["staff.view", "staff.manage"] },
  { group: "Salary", perms: ["salary.view", "salary.manage"] },
  { group: "Settings", perms: ["settings.manage"] },
  { group: "Reports", perms: ["reports.view"] },
  { group: "Roles", perms: ["roles.manage"] },
];

const PRESET_COLORS = [
  { label: "Red", value: "#EF4444" },
  { label: "Purple", value: "#8B5CF6" },
  { label: "Pink", value: "#EC4899" },
  { label: "Blue", value: "#3B82F6" },
  { label: "Amber", value: "#F59E0B" },
  { label: "Gray", value: "#6B7280" },
];

// Use the shared type from @/types
type Role = OrgRole;

interface SlideoverFormProps {
  role?: Role | null;
  onClose: () => void;
  onSave: () => void;
}

function permLabel(perm: string): string {
  const part = perm.split(".")[1];
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function SlideoverForm({ role, onClose, onSave }: SlideoverFormProps) {
  const { toast } = useToast();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [color, setColor] = useState(role?.color ?? "#3B82F6");
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const togglePerm = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  async function handleSave() {
    if (!name.trim()) { setError("Role name is required"); return; }
    setSaving(true);
    setError("");
    try {
      if (role) {
        await orgApi.roles.update(role.id, { name, description, color, permissions });
      } else {
        await orgApi.roles.create({ name, description, color, permissions });
      }
      toast.success(role ? "Role updated" : "Role created");
      onSave();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to save role";
      toast.error(msg);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-xl flex flex-col overflow-y-auto">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {role ? "Edit Role" : "New Role"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-5">
          {role && role.userCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm text-amber-800">
                This will affect <strong>{role.userCount} member{role.userCount !== 1 ? "s" : ""}</strong> who have this role.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Head Nurse"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c.value,
                    borderColor: color === c.value ? "#1e40af" : "transparent",
                    boxShadow: color === c.value ? "0 0 0 2px white, 0 0 0 4px #1e40af" : "none",
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Permissions</label>
            <div className="space-y-4">
              {ALL_PERMISSIONS.map((group) => (
                <div key={group.group}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    {group.group}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.perms.map((perm) => (
                      <label key={perm} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.includes(perm)}
                          onChange={() => togglePerm(perm)}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded"
                        />
                        <span className="text-sm text-slate-700">{permLabel(perm)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition disabled:opacity-60"
          >
            {saving ? "Saving..." : role ? "Save Changes" : "Create Role"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface DeleteModalProps {
  role: Role;
  allRoles: Role[];
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteModal({ role, allRoles, onClose, onDeleted }: DeleteModalProps) {
  const { toast } = useToast();
  const [targetRoleId, setTargetRoleId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const otherRoles = allRoles.filter((r) => r.id !== role.id);

  async function handleDelete() {
    setLoading(true);
    setError("");
    try {
      await orgApi.roles.delete(role.id);
      toast.success(`Role "${role.name}" deleted`);
      onDeleted();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to delete role";
      toast.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleMigrateAndDelete() {
    if (!targetRoleId) { setError("Please select a target role"); return; }
    setLoading(true);
    setError("");
    try {
      await orgApi.roles.migrate(role.id, targetRoleId);
      toast.success(`Members migrated and role "${role.name}" deleted`);
      onDeleted();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to migrate role";
      toast.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {role.userCount > 0 ? "Cannot Delete Role" : "Delete Role"}
          </h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          {role.userCount > 0 ? (
            <>
              <p className="text-sm text-slate-600">
                This role has <strong>{role.userCount} member{role.userCount !== 1 ? "s" : ""}</strong> assigned. To delete it, first migrate all members to another role.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select target role</label>
                <select
                  value={targetRoleId}
                  onChange={(e) => setTargetRoleId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select a role --</option>
                  {otherRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleMigrateAndDelete}
                  disabled={loading || !targetRoleId}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition disabled:opacity-60"
                >
                  {loading ? "Migrating..." : `Migrate ${role.userCount} member${role.userCount !== 1 ? "s" : ""} & Delete`}
                </button>
                <button onClick={onClose} className="px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition">
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Are you sure you want to delete <strong>{role.name}</strong>? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition disabled:opacity-60"
                >
                  {loading ? "Deleting..." : "Delete Role"}
                </button>
                <button onClick={onClose} className="px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await orgApi.roles.list();
      setRoles(data.roles ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  function handleSaved() {
    setShowForm(false);
    setEditingRole(null);
    fetchRoles();
  }

  function handleDeleted() {
    setDeletingRole(null);
    fetchRoles();
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Role Management"
        breadcrumb={[{ label: "Dashboard" }, { label: "Roles" }]}
      />

      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Roles</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage custom roles and their permissions for your organization.
            </p>
          </div>
          <button
            onClick={() => { setEditingRole(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Role
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse h-48" />
            ))}
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium mb-1">No roles yet</p>
            <p className="text-sm text-slate-400 mb-4">Create your first role or reload to generate defaults.</p>
            <button
              onClick={() => { setEditingRole(null); setShowForm(true); }}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              + New Role
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                onEdit={() => { setEditingRole(role); setShowForm(true); }}
                onDelete={() => setDeletingRole(role)}
              />
            ))}
          </div>
        )}
      </main>

      {(showForm || editingRole) && (
        <SlideoverForm
          role={editingRole}
          onClose={() => { setShowForm(false); setEditingRole(null); }}
          onSave={handleSaved}
        />
      )}

      {deletingRole && (
        <DeleteModal
          role={deletingRole}
          allRoles={roles}
          onClose={() => setDeletingRole(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

interface RoleCardProps {
  role: Role;
  onEdit: () => void;
  onDelete: () => void;
}

function RoleCard({ role, onEdit, onDelete }: RoleCardProps) {
  const visiblePerms = role.permissions.slice(0, 4);
  const extraCount = role.permissions.length - 4;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
            style={{ backgroundColor: role.color }}
          >
            {role.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 text-sm">{role.name}</h3>
              {role.isSystem === 1 && (
                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                  System
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{role.description || "No description"}</p>
          </div>
        </div>
        <span
          className="text-xs font-medium px-2 py-1 rounded-full text-white flex-shrink-0"
          style={{ backgroundColor: role.color }}
        >
          {role.userCount} member{role.userCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {visiblePerms.map((perm) => (
          <span
            key={perm}
            className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium"
          >
            {perm}
          </span>
        ))}
        {extraCount > 0 && (
          <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
            +{extraCount} more
          </span>
        )}
        {role.permissions.length === 0 && (
          <span className="text-[11px] text-slate-400 italic">No permissions</span>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
        {role.isSystem === 1 ? (
          <span
            title="System roles cannot be deleted"
            className="flex items-center gap-1.5 text-xs text-slate-300 px-2.5 py-1.5 rounded-lg cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </span>
        ) : (
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

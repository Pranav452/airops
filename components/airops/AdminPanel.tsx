"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAiropsStatuses } from "@/lib/queries/airops";
import {
  useAiropsUsers,
  useApproveUser,
  useRejectUser,
  useSetUserRole,
  useColumnAssignments,
  useCreateColumnAssignment,
  useDeleteColumnAssignment,
  useUpdateColumnAssignment,
  useAllRequiredFields,
  useSetRequiredFields,
  useAutoProgressionRules,
  useCreateAutoProgressionRule,
  useDeleteAutoProgressionRule,
} from "@/lib/queries/airops-admin";
import type { AiropsRole } from "@/lib/types/airops-admin";
import { CANDIDATE_FIELD_KEYS } from "@/lib/types/airops-admin";

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = "users" | "column-access" | "required-fields" | "auto-progression";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "users",
    label: "Users",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "column-access",
    label: "Column Access",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="18" rx="1" />
        <rect x="14" y="3" width="7" height="10" rx="1" />
        <path d="M14 17h7M17 14v6" />
      </svg>
    ),
  },
  {
    id: "required-fields",
    label: "Required Fields",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    id: "auto-progression",
    label: "Auto-Progression",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    ),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<AiropsRole, { bg: string; color: string; border: string }> = {
  superadmin: { bg: "#fdf4ff", color: "#9333ea", border: "#e9d5ff" },
  admin:      { bg: "#eef2ff", color: "#4f46e5", border: "#c7d2fe" },
  user:       { bg: "var(--surface-2)", color: "var(--text-2)", border: "var(--border)" },
};

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  pending:  { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  approved: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  rejected: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
};

function Badge({ label, type }: { label: string; type: "role" | "status"; value: string }) {
  const colors = type === "role" ? ROLE_COLORS[label as AiropsRole] : STATUS_COLORS[label];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold"
      style={{
        background: colors?.bg ?? "var(--surface-2)",
        color: colors?.color ?? "var(--text-2)",
        border: `1px solid ${colors?.border ?? "var(--border)"}`,
      }}
    >
      {label}
    </span>
  );
}

// ─── Section: Users ───────────────────────────────────────────────────────────

function UsersTab({ currentUserEmail }: { currentUserEmail: string }) {
  const { data: users = [], isLoading } = useAiropsUsers();
  const approveUser = useApproveUser();
  const rejectUser = useRejectUser();
  const setRole = useSetUserRole();

  const pending = users.filter((u) => u.status === "pending");
  const approved = users.filter((u) => u.status === "approved");
  const rejected = users.filter((u) => u.status === "rejected");

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      {/* Pending approvals */}
      <section>
        <SectionHeader title="Pending Approvals" count={pending.length} accent="#b45309" />
        {pending.length === 0 ? (
          <EmptyState message="No pending approvals." />
        ) : (
          <div className="space-y-2 mt-3">
            {pending.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <Avatar email={u.email} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                    {u.full_name ?? u.email}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--text-3)" }}>{u.email}</p>
                  {u.team && (
                    <p className="text-xs" style={{ color: "var(--text-3)" }}>Team: {u.team}</p>
                  )}
                </div>
                <Badge label="pending" type="status" value="pending" />
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => approveUser.mutate({ email: u.email, approvedBy: currentUserEmail })}
                    disabled={approveUser.isPending}
                    className="px-3 h-7 rounded-lg text-xs font-semibold text-white transition-opacity"
                    style={{ background: "#16a34a" }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => rejectUser.mutate(u.email)}
                    disabled={rejectUser.isPending}
                    className="px-3 h-7 rounded-lg text-xs font-semibold transition-colors"
                    style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Approved users */}
      <section>
        <SectionHeader title="Approved Users" count={approved.length} accent="#16a34a" />
        {approved.length === 0 ? (
          <EmptyState message="No approved users." />
        ) : (
          <div className="space-y-2 mt-3">
            {approved.map((u) => {
              const isSelf = u.email === currentUserEmail;
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <Avatar email={u.email} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                      {u.full_name ?? u.email}
                      {isSelf && (
                        <span className="ml-2 text-[10px] font-normal" style={{ color: "var(--text-3)" }}>(you)</span>
                      )}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--text-3)" }}>{u.email}</p>
                  </div>
                  <Badge label={u.role} type="role" value={u.role} />
                  {/* Role selector */}
                  <select
                    value={u.role}
                    disabled={isSelf || setRole.isPending}
                    onChange={(e) => setRole.mutate({ email: u.email, role: e.target.value as AiropsRole })}
                    className="h-7 rounded-lg px-2 text-xs font-medium"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      opacity: isSelf ? 0.5 : 1,
                      cursor: isSelf ? "not-allowed" : "pointer",
                    }}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="superadmin">superadmin</option>
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Rejected users */}
      {rejected.length > 0 && (
        <section>
          <SectionHeader title="Rejected" count={rejected.length} accent="#dc2626" />
          <div className="space-y-2 mt-3">
            {rejected.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 p-3 rounded-xl opacity-60"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <Avatar email={u.email} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{u.email}</p>
                </div>
                <Badge label="rejected" type="status" value="rejected" />
                <button
                  onClick={() => approveUser.mutate({ email: u.email, approvedBy: currentUserEmail })}
                  disabled={approveUser.isPending}
                  className="px-3 h-7 rounded-lg text-xs font-semibold"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)" }}
                >
                  Re-approve
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Section: Column Access ───────────────────────────────────────────────────

function ColumnAccessTab() {
  const { data: statuses = [] } = useAiropsStatuses();
  const { data: users = [] } = useAiropsUsers();
  const { data: assignments = [], isLoading } = useColumnAssignments();
  const createAssignment = useCreateColumnAssignment();
  const deleteAssignment = useDeleteColumnAssignment();
  const updateAssignment = useUpdateColumnAssignment();

  const approvedEmails = users.filter((u) => u.status === "approved").map((u) => u.email);

  const [email, setEmail] = useState("");
  const [statusId, setStatusId] = useState<string>("__board_wide__");
  const [canEdit, setCanEdit] = useState(true);
  const [canMove, setCanMove] = useState(true);
  const [canAssign, setCanAssign] = useState(false);
  const [emailError, setEmailError] = useState("");

  function handleAdd() {
    if (!email.trim()) { setEmailError("Email required"); return; }
    setEmailError("");
    createAssignment.mutate({
      user_email: email.trim(),
      status_id: statusId === "__board_wide__" ? null : statusId,
      can_edit: canEdit,
      can_move: canMove,
      can_assign: canAssign,
    });
    setEmail("");
    setStatusId("__board_wide__");
    setCanEdit(true);
    setCanMove(true);
    setCanAssign(false);
  }

  const statusName = (id: string | null) =>
    id == null ? "Board-wide" : statuses.find((s) => s.id === id)?.name ?? id;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Add assignment */}
      <div
        className="p-4 rounded-xl space-y-4"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
          New Assignment
        </p>
        <div className="flex flex-wrap gap-3">
          {/* Email */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs mb-1" style={{ color: "var(--text-2)" }}>User email</label>
            <input
              list="approved-emails"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
              placeholder="user@example.com"
              className="w-full h-8 rounded-lg px-3 text-xs"
              style={{
                background: "var(--surface)",
                border: `1px solid ${emailError ? "#dc2626" : "var(--border)"}`,
                color: "var(--text)",
                outline: "none",
              }}
            />
            <datalist id="approved-emails">
              {approvedEmails.map((e) => <option key={e} value={e} />)}
            </datalist>
            {emailError && <p className="text-[11px] mt-0.5" style={{ color: "#dc2626" }}>{emailError}</p>}
          </div>
          {/* Status */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs mb-1" style={{ color: "var(--text-2)" }}>Column (null = board-wide)</label>
            <select
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
              className="w-full h-8 rounded-lg px-3 text-xs"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              <option value="__board_wide__">Board-wide</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        {/* Toggles */}
        <div className="flex flex-wrap gap-4">
          {([
            ["can_edit", "Can edit", canEdit, setCanEdit],
            ["can_move", "Can move", canMove, setCanMove],
            ["can_assign", "Can assign", canAssign, setCanAssign],
          ] as [string, string, boolean, React.Dispatch<React.SetStateAction<boolean>>][]).map(([, label, val, setter]) => (
            <label key={label} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={val}
                onChange={(e) => setter(e.target.checked)}
                className="w-3.5 h-3.5 rounded"
                style={{ accentColor: "#6366f1" }}
              />
              <span className="text-xs" style={{ color: "var(--text-2)" }}>{label}</span>
            </label>
          ))}
          <button
            onClick={handleAdd}
            disabled={createAssignment.isPending}
            className="ml-auto px-4 h-8 rounded-lg text-xs font-semibold text-white"
            style={{ background: "#6366f1" }}
          >
            Add
          </button>
        </div>
      </div>

      {/* List */}
      <div>
        <SectionHeader title="Existing Assignments" count={assignments.length} />
        {assignments.length === 0 ? (
          <EmptyState message="No assignments configured. All users can access all columns." />
        ) : (
          <div className="space-y-2 mt-3">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{a.user_email}</p>
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>
                    Column: <span style={{ color: "var(--text-2)" }}>{statusName(a.status_id)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {(["can_edit", "can_move", "can_assign"] as const).map((key) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={a[key]}
                        onChange={(e) =>
                          updateAssignment.mutate({ id: a.id, updates: { [key]: e.target.checked } })
                        }
                        className="w-3 h-3"
                        style={{ accentColor: "#6366f1" }}
                      />
                      <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                        {key.replace("can_", "")}
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={() => deleteAssignment.mutate(a.id)}
                  disabled={deleteAssignment.isPending}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-3)" }}
                  title="Delete"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section: Required Fields ─────────────────────────────────────────────────

function RequiredFieldsTab() {
  const { data: statuses = [], isLoading: statusLoading } = useAiropsStatuses();
  const { data: allFields = [], isLoading: fieldsLoading } = useAllRequiredFields();
  const setRequired = useSetRequiredFields();
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const fieldsByStatus: Record<string, Set<string>> = {};
  allFields.forEach((f) => {
    if (!fieldsByStatus[f.status_id]) fieldsByStatus[f.status_id] = new Set();
    fieldsByStatus[f.status_id].add(f.field_key);
  });

  function toggleField(statusId: string, fieldKey: string) {
    const current = new Set(fieldsByStatus[statusId] ?? []);
    if (current.has(fieldKey)) current.delete(fieldKey); else current.add(fieldKey);
    setSaving(statusId);
    setRequired.mutate(
      { statusId, fieldKeys: Array.from(current) },
      { onSettled: () => setSaving(null) }
    );
  }

  if (statusLoading || fieldsLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-2">
      <p className="text-xs mb-4" style={{ color: "var(--text-3)" }}>
        Fields checked here must be filled before a job can be moved INTO that column. If a job is missing them, the user will be warned (soft gate — they can override).
      </p>
      {statuses.map((status) => {
        const isOpen = openStatusId === status.id;
        const statusFields = fieldsByStatus[status.id] ?? new Set();
        const hexColor = `#${status.color_hex.replace(/^#/, "")}`;
        const isSaving = saving === status.id;

        return (
          <div key={status.id} style={{ border: "1px solid var(--border)", borderRadius: 10 }}>
            <button
              className="w-full flex items-center gap-2.5 p-3 text-left"
              onClick={() => setOpenStatusId(isOpen ? null : status.id)}
            >
              <span className="size-2.5 rounded-full shrink-0" style={{ background: hexColor }} />
              <span className="text-sm font-medium flex-1" style={{ color: "var(--text)" }}>
                {status.name}
              </span>
              {statusFields.size > 0 && (
                <span
                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{ background: "#eef2ff", color: "#4f46e5" }}
                >
                  {statusFields.size} required
                </span>
              )}
              {isSaving && <span className="text-[11px]" style={{ color: "var(--text-3)" }}>saving…</span>}
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                style={{ color: "var(--text-3)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ overflow: "hidden" }}
                >
                  <div
                    className="px-3 pb-3 flex flex-wrap gap-2"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    {CANDIDATE_FIELD_KEYS.map((f) => {
                      const checked = statusFields.has(f.key);
                      return (
                        <button
                          key={f.key}
                          onClick={() => toggleField(status.id, f.key)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors mt-2"
                          style={{
                            background: checked ? "#eef2ff" : "var(--surface-2)",
                            color: checked ? "#4f46e5" : "var(--text-2)",
                            border: `1px solid ${checked ? "#c7d2fe" : "var(--border)"}`,
                          }}
                        >
                          {checked && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          )}
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ─── Section: Auto-Progression ────────────────────────────────────────────────

function AutoProgressionTab() {
  const { data: statuses = [] } = useAiropsStatuses();
  const { data: rules = [], isLoading } = useAutoProgressionRules();
  const createRule = useCreateAutoProgressionRule();
  const deleteRule = useDeleteAutoProgressionRule();

  const [triggerField, setTriggerField] = useState("");
  const [targetStatusId, setTargetStatusId] = useState("");
  const [description, setDescription] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [statusError, setStatusError] = useState("");

  function handleAdd() {
    let ok = true;
    if (!triggerField) { setFieldError("Trigger field required"); ok = false; } else setFieldError("");
    if (!targetStatusId) { setStatusError("Target status required"); ok = false; } else setStatusError("");
    if (!ok) return;
    createRule.mutate({ trigger_field: triggerField, target_status_id: targetStatusId, description: description || null });
    setTriggerField("");
    setTargetStatusId("");
    setDescription("");
  }

  const statusName = (id: string) => statuses.find((s) => s.id === id)?.name ?? id;
  const fieldLabel = (key: string) => CANDIDATE_FIELD_KEYS.find((f) => f.key === key)?.label ?? key;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <p className="text-xs" style={{ color: "var(--text-3)" }}>
        When a trigger field transitions from empty to filled on a job, the job is automatically moved to the target status — but only forward (never backward). Rules are evaluated after every field save.
      </p>

      {/* Add rule */}
      <div
        className="p-4 rounded-xl space-y-4"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
          New Rule
        </p>
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs mb-1" style={{ color: "var(--text-2)" }}>Trigger field</label>
            <select
              value={triggerField}
              onChange={(e) => { setTriggerField(e.target.value); setFieldError(""); }}
              className="w-full h-8 rounded-lg px-2 text-xs"
              style={{
                background: "var(--surface)",
                border: `1px solid ${fieldError ? "#dc2626" : "var(--border)"}`,
                color: "var(--text)",
              }}
            >
              <option value="">— pick field —</option>
              {CANDIDATE_FIELD_KEYS.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
            {fieldError && <p className="text-[11px] mt-0.5" style={{ color: "#dc2626" }}>{fieldError}</p>}
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs mb-1" style={{ color: "var(--text-2)" }}>Target status</label>
            <select
              value={targetStatusId}
              onChange={(e) => { setTargetStatusId(e.target.value); setStatusError(""); }}
              className="w-full h-8 rounded-lg px-2 text-xs"
              style={{
                background: "var(--surface)",
                border: `1px solid ${statusError ? "#dc2626" : "var(--border)"}`,
                color: "var(--text)",
              }}
            >
              <option value="">— pick status —</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {statusError && <p className="text-[11px] mt-0.5" style={{ color: "#dc2626" }}>{statusError}</p>}
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs mb-1" style={{ color: "var(--text-2)" }}>Description (optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Move to Clearance when clearance ticked"
              className="w-full h-8 rounded-lg px-3 text-xs"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            disabled={createRule.isPending}
            className="px-4 h-8 rounded-lg text-xs font-semibold text-white"
            style={{ background: "#6366f1" }}
          >
            Add Rule
          </button>
        </div>
      </div>

      {/* List */}
      <div>
        <SectionHeader title="Active Rules" count={rules.length} />
        {rules.length === 0 ? (
          <EmptyState message="No auto-progression rules configured." />
        ) : (
          <div className="space-y-2 mt-3">
            {rules.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                      style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}
                    >
                      {fieldLabel(r.trigger_field)}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--text-3)", flexShrink: 0 }}>
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    <span
                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                      style={{ background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe" }}
                    >
                      {statusName(r.target_status_id)}
                    </span>
                  </div>
                  {r.description && (
                    <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>{r.description}</p>
                  )}
                </div>
                <button
                  onClick={() => deleteRule.mutate(r.id)}
                  disabled={deleteRule.isPending}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-3)" }}
                  title="Delete rule"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function Avatar({ email }: { email: string }) {
  const initial = (email[0] ?? "?").toUpperCase();
  const hue = [...email].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="size-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ background: `hsl(${hue},60%,50%)` }}
    >
      {initial}
    </div>
  );
}

function SectionHeader({ title, count, accent }: { title: string; count?: number; accent?: string }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent ?? "var(--text-3)" }}>
        {title}
      </p>
      {count !== undefined && (
        <span
          className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
          style={{ background: "var(--surface-2)", color: "var(--text-3)" }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="flex items-center justify-center py-8 rounded-xl mt-3"
      style={{ border: "1px dashed var(--border)", color: "var(--text-3)", fontSize: 13 }}
    >
      {message}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16 gap-2">
      {[0, 150, 300].map((d) => (
        <div
          key={d}
          className="size-2 rounded-full animate-pulse"
          style={{ background: "var(--border)", animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  );
}

// ─── AdminPanel (root export) ─────────────────────────────────────────────────

interface AdminPanelProps {
  currentUserEmail: string;
  currentUserRole: AiropsRole;
}

export function AdminPanel({ currentUserEmail, currentUserRole }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("users");

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "#6366f1" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M2 20a10 10 0 0 1 20 0" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Admin Panel</h1>
          <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
            {currentUserEmail} &middot; {currentUserRole}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-1 px-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 h-10 text-xs font-medium transition-colors relative"
              style={{ color: active ? "#6366f1" : "var(--text-3)" }}
            >
              {tab.icon}
              {tab.label}
              {active && (
                <motion.div
                  layoutId="tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: "#6366f1" }}
                  transition={{ duration: 0.15 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === "users" && <UsersTab currentUserEmail={currentUserEmail} />}
            {activeTab === "column-access" && <ColumnAccessTab />}
            {activeTab === "required-fields" && <RequiredFieldsTab />}
            {activeTab === "auto-progression" && <AutoProgressionTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAiropsStore } from "@/lib/stores/airops-store";
import { useAiropsJob, useAiropsComments, useUpdateJob, useAddAiropsComment, useAiropsStatuses } from "@/lib/queries/airops";
import type { AiropsJobData } from "@/lib/types/airops";
import { StuffingEmailModal } from "./StuffingEmailModal";

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isDateInPast(dateStr?: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// ─── Cutoff Banner ────────────────────────────────────────────────────────────

const VESSEL_CUTOFFS: { key: "port_cutoff" | "si_cutoff" | "docs_cutoff" | "vgm_cutoff" | "cargo_handover_cutoff"; label: string }[] = [
  { key: "port_cutoff",           label: "Port Cutoff" },
  { key: "si_cutoff",             label: "SI Cutoff" },
  { key: "docs_cutoff",           label: "Docs Cutoff" },
  { key: "vgm_cutoff",            label: "VGM Cutoff" },
  { key: "cargo_handover_cutoff", label: "Cargo Handover" },
];

type CutoffStatus = "overdue" | "today" | "tomorrow" | "ok";

function getCutoffStatus(dateStr: string): CutoffStatus {
  const now = new Date();
  const t = new Date(dateStr);
  if (isNaN(t.getTime())) return "ok";
  const diffMs = t.getTime() - now.getTime();
  if (diffMs < 0) return "overdue";
  const diffH = diffMs / 3_600_000;
  if (diffH <= 24) return "today";
  if (diffH <= 48) return "tomorrow";
  return "ok";
}

const CUTOFF_STATUS_STYLES: Record<CutoffStatus, { bg: string; color: string; border: string; label: string }> = {
  overdue:  { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", label: "Overdue" },
  today:    { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", label: "Today" },
  tomorrow: { bg: "#fffbeb", color: "#92400e", border: "#fde68a", label: "Tomorrow" },
  ok:       { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", label: "OK" },
};

import type { AiropsVessel } from "@/lib/types/airops";

function CutoffBanner({ vessel }: { vessel: AiropsVessel }) {
  const rows = VESSEL_CUTOFFS
    .map(({ key, label }) => ({ label, value: vessel[key] }))
    .filter((r): r is { label: string; value: string } => typeof r.value === "string" && r.value.length > 0);

  if (rows.length === 0) return null;

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
      <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500, display: "block", marginBottom: 6, paddingLeft: 2 }}>
        CUTOFF REMINDERS
      </span>
      <div className="flex flex-col gap-1">
        {rows.map(({ label, value }) => {
          const status = getCutoffStatus(value);
          const s = CUTOFF_STATUS_STYLES[status];
          return (
            <div
              key={label}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}
            >
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 12, color: s.color, fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 11.5, color: s.color }}>{formatDateTime(value)}</span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: 20,
                  background: s.color,
                  color: "#fff",
                  letterSpacing: "0.04em",
                }}
              >
                {s.label.toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Accordion Section ────────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5"
        style={{ background: "transparent", cursor: "pointer" }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", letterSpacing: "0.03em", textTransform: "uppercase" }}>
          {title}
        </span>
        <span style={{ color: "var(--text-3)" }}>
          <IconChevronDown open={open} />
        </span>
      </button>
      {open && <div className="px-4 pb-3 pt-0.5">{children}</div>}
    </div>
  );
}

// ─── Job Type Field ───────────────────────────────────────────────────────────

const JOB_TYPE_OPTIONS = [
  { value: "cc",      label: "CC",      full: "Custom Clearance" },
  { value: "ff",      label: "FF",      full: "Freight Forwarding" },
  { value: "x_works", label: "X Works", full: "Ex-Works" },
];

function JobTypeField({ value, onSave }: { value?: string | null; onSave: (v: string) => void }) {
  return (
    <div className="px-2 py-1.5">
      <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500, lineHeight: 1, display: "block", marginBottom: 4 }}>Job Type</span>
      <select
        value={value ?? ""}
        onChange={(e) => { if (e.target.value) onSave(e.target.value); }}
        style={{
          width: "100%",
          height: 30,
          borderRadius: 6,
          padding: "0 8px",
          fontSize: 13,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: value ? "var(--text)" : "var(--text-3)",
          outline: "none",
        }}
      >
        <option value="" disabled>Select…</option>
        {JOB_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label} – {opt.full}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Document Row ─────────────────────────────────────────────────────────────

function DocumentRow({ doc, jobId }: { doc: { name: string; path: string; size: number }; jobId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  async function open() {
    if (fetching) return;
    setFetching(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      const { data } = await sb.storage.from("job-documents").createSignedUrl(doc.path, 300);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    } finally {
      setFetching(false);
    }
  }

  const ext = doc.name.split(".").pop()?.toUpperCase() ?? "FILE";
  const sizeMB = (doc.size / 1024 / 1024).toFixed(1);

  return (
    <div
      className="flex items-center justify-between py-1.5 px-1 rounded-lg"
      style={{ border: "1px solid var(--border)", background: "var(--surface-2)", marginBottom: 2 }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
          background: "#eef2ff", color: "#6366f1", border: "1px solid #c7d2fe", flexShrink: 0,
        }}>{ext}</span>
        <span className="text-xs truncate" style={{ color: "var(--text-2)" }}>{doc.name}</span>
        <span className="text-xs shrink-0" style={{ color: "var(--text-3)" }}>{sizeMB} MB</span>
      </div>
      <button
        onClick={open}
        disabled={fetching}
        style={{
          fontSize: 11, fontWeight: 500, padding: "2px 10px", borderRadius: 5, flexShrink: 0,
          background: fetching ? "var(--surface-2)" : "#eef2ff", color: "#4f46e5",
          border: "1px solid #c7d2fe", cursor: "pointer",
        }}
      >
        {fetching ? "…" : "Open"}
      </button>
    </div>
  );
}

// ─── Editable Field ───────────────────────────────────────────────────────────

interface EditableFieldProps {
  label: string;
  value?: string | number | null;
  type?: "text" | "date" | "number";
  onSave: (val: string) => void;
  redIfPast?: boolean;
  placeholder?: string;
}

function EditableField({ label, value, type = "text", onSave, redIfPast, placeholder }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = type === "date" && value ? formatDate(String(value)) : (value !== undefined && value !== null ? String(value) : "");
  const isPast = redIfPast && isDateInPast(value as string);

  function startEdit() {
    const rawVal = type === "date" && value
      ? String(value).substring(0, 10) // keep YYYY-MM-DD for date input
      : (value !== undefined && value !== null ? String(value) : "");
    setDraft(rawVal);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commit() {
    setEditing(false);
    if (draft !== String(value ?? "")) onSave(draft);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  }

  return (
    <div
      className="flex flex-col gap-0.5 px-2 py-1.5 rounded"
      style={{
        background: hovered || editing ? "var(--surface-2)" : "transparent",
        borderRadius: "var(--radius-md, 6px)",
        cursor: editing ? "default" : "pointer",
        transition: "background 0.12s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!editing) startEdit(); }}
    >
      <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500, lineHeight: 1 }}>{label}</span>
      {editing ? (
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          style={{
            fontSize: 13,
            color: "var(--text)",
            background: "transparent",
            border: "none",
            outline: "none",
            width: "100%",
            padding: 0,
            fontFamily: "inherit",
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="flex items-center gap-1.5">
          <span
            style={{
              fontSize: 13,
              color: isPast ? "#ef4444" : (displayValue ? "var(--text)" : "var(--text-3)"),
              fontWeight: isPast ? 500 : 400,
            }}
          >
            {displayValue || placeholder || <span style={{ color: "var(--text-3)", fontStyle: "italic" }}>—</span>}
          </span>
          {hovered && (
            <span style={{ color: "var(--text-3)", opacity: 0.7, flexShrink: 0 }}>
              <IconPencil />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5">
      <span style={{ fontSize: 13, color: "var(--text)" }}>{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? "#6366f1" : "var(--surface-2)",
          border: `1.5px solid ${checked ? "#6366f1" : "var(--border)"}`,
          position: "relative",
          cursor: "pointer",
          transition: "background 0.15s, border-color 0.15s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 17 : 2,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: checked ? "#fff" : "var(--text-3)",
            transition: "left 0.15s",
          }}
        />
      </button>
    </div>
  );
}

// ─── Milestone Checkbox ───────────────────────────────────────────────────────

function MilestoneCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 px-2 py-1.5 rounded w-full text-left"
      style={{
        background: "transparent",
        cursor: "pointer",
        borderRadius: "var(--radius-md, 6px)",
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          border: `2px solid ${checked ? "#16a34a" : "var(--border)"}`,
          background: checked ? "#16a34a" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background 0.12s, border-color 0.12s",
        }}
      >
        {checked && <span style={{ color: "#fff" }}><IconCheck /></span>}
      </span>
      <span style={{ fontSize: 12.5, color: checked ? "#16a34a" : "var(--text)", fontWeight: checked ? 500 : 400 }}>
        {label}
      </span>
    </button>
  );
}

// ─── Chip Input (multi-value) ─────────────────────────────────────────────────

function ChipInput({ label, values, onSave }: { label: string; values: string[]; onSave: (vals: string[]) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(values.join(", "));
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commit() {
    setEditing(false);
    const parsed = draft.split(",").map((s) => s.trim()).filter(Boolean);
    onSave(parsed);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  }

  return (
    <div
      className="flex flex-col gap-1 px-2 py-1.5 rounded"
      style={{
        background: hovered || editing ? "var(--surface-2)" : "transparent",
        borderRadius: "var(--radius-md, 6px)",
        cursor: editing ? "default" : "pointer",
        transition: "background 0.12s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!editing) startEdit(); }}
    >
      <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>{label}</span>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          placeholder="Comma-separated values"
          style={{
            fontSize: 13,
            color: "var(--text)",
            background: "transparent",
            border: "none",
            outline: "none",
            width: "100%",
            padding: 0,
            fontFamily: "inherit",
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : values.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {values.map((v) => (
            <span
              key={v}
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 20,
                background: "#eef2ff",
                color: "#4f46e5",
                fontWeight: 500,
                border: "1px solid #c7d2fe",
              }}
            >
              {v}
            </span>
          ))}
          {hovered && (
            <span style={{ color: "var(--text-3)", opacity: 0.7, alignSelf: "center" }}>
              <IconPencil />
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 13, color: "var(--text-3)", fontStyle: "italic" }}>—</span>
          {hovered && <span style={{ color: "var(--text-3)", opacity: 0.7 }}><IconPencil /></span>}
        </div>
      )}
    </div>
  );
}

// ─── Field Row helper (two columns) ──────────────────────────────────────────

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-1 gap-y-0.5">{children}</div>;
}

function FieldFull({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function AiropsDetailPanel() {
  const { selectedJobId, isPanelOpen, closePanel } = useAiropsStore();
  const { data: job, isLoading } = useAiropsJob(selectedJobId);
  const { data: comments = [] } = useAiropsComments(selectedJobId);
  const { data: statuses = [] } = useAiropsStatuses();
  const updateJob = useUpdateJob();
  const addComment = useAddAiropsComment();

  // Resolve status IDs by name for CSD actions
  const statusByName = Object.fromEntries(statuses.map((s) => [s.name, s.id]));
  const isConsigneeApproval = job?.status?.name === "Consignee Approval";

  function approveJob() {
    if (!job) return;
    const nextId = statusByName["Container Planning"];
    if (!nextId) return;
    updateJob.mutate({ id: job.id, updates: { status_id: nextId } });
  }

  function rejectJob() {
    if (!job) return;
    const nextId = statusByName["Booking Request"];
    if (!nextId) return;
    updateJob.mutate({ id: job.id, updates: { status_id: nextId } });
  }

  const isStuffingFinalisation = job?.status?.name === "Stuffing Finalisation";
  const [showStuffingEmail, setShowStuffingEmail] = useState(false);

  const [commentText, setCommentText] = useState("");
  const [consoleEditMode, setConsoleEditMode] = useState(false);
  const [consoleDraft, setConsoleDraft] = useState("");
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const consoleInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape" && isPanelOpen) closePanel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPanelOpen, closePanel]);

  // Scroll comments to bottom when new ones arrive
  useEffect(() => {
    if (comments.length > 0) {
      commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments.length]);

  // ── Mutation helpers ──────────────────────────────────────────────────────

  const saveData = useCallback(
    (field: keyof AiropsJobData, value: string | boolean | number | string[] | null) => {
      if (!job) return;
      updateJob.mutate({ id: job.id, updates: { data: { [field]: value } } });
    },
    [job, updateJob]
  );

  const saveJobField = useCallback(
    (updates: { console_no?: string | null; cross_verified?: boolean }) => {
      if (!job) return;
      updateJob.mutate({ id: job.id, updates });
    },
    [job, updateJob]
  );

  function submitComment() {
    if (!selectedJobId || !commentText.trim()) return;
    addComment.mutate({ jobId: selectedJobId, content: commentText.trim() });
    setCommentText("");
  }

  function startConsoleEdit() {
    setConsoleDraft(job?.console_no ?? "");
    setConsoleEditMode(true);
    setTimeout(() => consoleInputRef.current?.focus(), 0);
  }

  function commitConsole() {
    setConsoleEditMode(false);
    saveJobField({ console_no: consoleDraft.trim() || null });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const d = job?.data ?? {};

  return (
    <AnimatePresence>
      {isPanelOpen && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closePanel}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.25)",
              zIndex: 40,
            }}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: 440,
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              background: "#fff",
              borderLeft: "1px solid var(--border)",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.10)",
            }}
          >
            {/* ── Header ── */}
            <div
              className="flex items-center gap-3 px-4 py-3 shrink-0"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                    {d.order_no || "Untitled Job"}
                  </span>
                  {job?.status && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: job.status.color_hex + "22",
                        color: job.status.color_hex,
                        border: `1px solid ${job.status.color_hex}55`,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {job.status.name}
                    </span>
                  )}
                </div>
                {job?.container?.vessel && (
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {job.container.vessel.name}
                  </span>
                )}
                {/* CSD Approve / Reject — shown only when in Consignee Approval */}
                {isConsigneeApproval && (
                  <div className="flex gap-1.5 mt-1.5">
                    <button
                      onClick={approveJob}
                      disabled={updateJob.isPending}
                      style={{
                        padding: "3px 12px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: "#16a34a",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                        opacity: updateJob.isPending ? 0.6 : 1,
                      }}
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={rejectJob}
                      disabled={updateJob.isPending}
                      style={{
                        padding: "3px 12px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                        opacity: updateJob.isPending ? 0.6 : 1,
                      }}
                    >
                      ✕ Reject
                    </button>
                  </div>
                )}
                {/* Stuffing Finalisation — Email Consignee */}
                {isStuffingFinalisation && (
                  <div className="mt-2">
                    <button
                      onClick={() => setShowStuffingEmail(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 14px",
                        borderRadius: 7,
                        fontSize: 12,
                        fontWeight: 600,
                        background: "#4f46e5",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                        boxShadow: "0 1px 4px rgba(79,70,229,0.25)",
                        letterSpacing: "0.01em",
                      }}
                    >
                      🔒 Finalise &amp; Email Consignee
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={closePanel}
                style={{
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "var(--radius-md, 6px)",
                  color: "var(--text-3)",
                  background: "transparent",
                  cursor: "pointer",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <IconClose />
              </button>
            </div>

            {/* ── Loading ── */}
            {isLoading && (
              <div className="flex-1 flex items-center justify-center" style={{ color: "var(--text-3)", fontSize: 13 }}>
                Loading…
              </div>
            )}

            {/* ── Body ── */}
            {!isLoading && job && (
              <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>

                {/* 1. Booking Info */}
                <Section title="Booking Info">
                  <FieldGrid>
                    <EditableField label="Consignee" value={d.consignee_name} onSave={(v) => saveData("consignee_name", v)} />
                    <EditableField label="Shipper" value={d.shipper_name} onSave={(v) => saveData("shipper_name", v)} />
                    <JobTypeField value={d.job_type} onSave={(v) => saveData("job_type", v)} />
                    <EditableField label="Qty (pcs)" value={d.quantity_pcs} type="number" onSave={(v) => saveData("quantity_pcs", parseFloat(v) || 0)} />
                    <EditableField label="Volume (CBM)" value={d.volume} type="number" onSave={(v) => saveData("volume", parseFloat(v) || 0)} />
                    <EditableField label="No. of Cartons" value={d.no_of_cartons} type="number" onSave={(v) => saveData("no_of_cartons", parseInt(v) || 0)} />
                    <EditableField label="Cargo Handover" value={d.cargo_handover_date} type="date" onSave={(v) => saveData("cargo_handover_date", v)} />
                    <EditableField label="Gross Weight" value={d.gross_weight} type="number" onSave={(v) => saveData("gross_weight", parseFloat(v) || 0)} />
                    <EditableField label="Net Weight" value={d.net_weight} type="number" onSave={(v) => saveData("net_weight", parseFloat(v) || 0)} />
                  </FieldGrid>
                  <FieldFull>
                    <EditableField label="Pkgs / Cases" value={d.pkgs_cases} onSave={(v) => saveData("pkgs_cases", v)} />
                  </FieldFull>
                  <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8 }}>
                    <div className="flex items-center justify-between px-2">
                      <span style={{ fontSize: 13, color: "var(--text)" }}>Cross-Verified</span>
                      <button
                        role="switch"
                        aria-checked={job.cross_verified}
                        onClick={() => saveJobField({ cross_verified: !job.cross_verified })}
                        style={{
                          width: 36,
                          height: 20,
                          borderRadius: 10,
                          background: job.cross_verified ? "#6366f1" : "var(--surface-2)",
                          border: `1.5px solid ${job.cross_verified ? "#6366f1" : "var(--border)"}`,
                          position: "relative",
                          cursor: "pointer",
                          transition: "background 0.15s, border-color 0.15s",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: 2,
                            left: job.cross_verified ? 17 : 2,
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: job.cross_verified ? "#fff" : "var(--text-3)",
                            transition: "left 0.15s",
                          }}
                        />
                      </button>
                    </div>
                  </div>
                </Section>

                {/* 2. Vessel & Carrier */}
                <Section title="Vessel & Carrier">
                  <FieldGrid>
                    <EditableField label="Booking No." value={d.booking_no} onSave={(v) => saveData("booking_no", v)} />
                    <EditableField label="Vessel Name" value={d.vessel_name} onSave={(v) => saveData("vessel_name", v)} />
                    <EditableField label="ETD" value={d.etd} type="date" onSave={(v) => saveData("etd", v)} redIfPast />
                    <EditableField label="ETA" value={d.eta} type="date" onSave={(v) => saveData("eta", v)} />
                    <EditableField label="Current ETD" value={d.current_etd} type="date" onSave={(v) => saveData("current_etd", v)} redIfPast />
                    <EditableField label="DO ETD" value={d.do_etd} type="date" onSave={(v) => saveData("do_etd", v)} />
                  </FieldGrid>
                  {job.container?.vessel && <CutoffBanner vessel={job.container.vessel} />}
                </Section>

                {/* 3. Container Info */}
                <Section title="Container Info">
                  <FieldGrid>
                    <EditableField label="Container Type" value={d.container_type} onSave={(v) => saveData("container_type", v)} />
                    <EditableField label="MBL Number" value={d.mbl_number} onSave={(v) => saveData("mbl_number", v)} />
                    <EditableField label="HBL Number" value={d.hbl_number} onSave={(v) => saveData("hbl_number", v)} />
                    <EditableField label="SB Number" value={d.sb_number} onSave={(v) => saveData("sb_number", v)} />
                  </FieldGrid>
                  <FieldFull>
                    <EditableField label="ERP Exp Number" value={d.erp_exp_number} onSave={(v) => saveData("erp_exp_number", v)} />
                  </FieldFull>
                  <div className="mt-2 flex flex-col gap-1">
                    <ChipInput
                      label="Container Numbers"
                      values={d.container_numbers ?? []}
                      onSave={(vals) => saveData("container_numbers", vals)}
                    />
                    <ChipInput
                      label="Seal Nos."
                      values={d.seal_nos ?? []}
                      onSave={(vals) => saveData("seal_nos", vals)}
                    />
                  </div>
                </Section>

                {/* 4. Stuffing Checklist */}
                <Section title="Stuffing Checklist">
                  <div className="flex flex-col gap-0.5">
                    <ToggleSwitch
                      label="SI Filing"
                      checked={!!d.si_filing_tick}
                      onChange={(v) => saveData("si_filing_tick", v)}
                    />
                    <ToggleSwitch
                      label="VGM"
                      checked={!!d.vgm_tick}
                      onChange={(v) => saveData("vgm_tick", v)}
                    />
                    <ToggleSwitch
                      label="Form 13"
                      checked={!!d.form_13_tick}
                      onChange={(v) => saveData("form_13_tick", v)}
                    />
                  </div>
                </Section>

                {/* 5. Documentation */}
                <Section title="Documentation">
                  <FieldGrid>
                    <EditableField label="Transporter" value={d.transporter} onSave={(v) => saveData("transporter", v)} />
                    <EditableField label="LEO Date" value={d.leo_date} type="date" onSave={(v) => saveData("leo_date", v)} />
                    <EditableField label="Gate In Date" value={d.gate_in_date} type="date" onSave={(v) => saveData("gate_in_date", v)} />
                    <EditableField label="BL Date" value={d.bl_date} type="date" onSave={(v) => saveData("bl_date", v)} />
                  </FieldGrid>
                  <FieldFull>
                    <EditableField label="Gate Details" value={d.gate_details} onSave={(v) => saveData("gate_details", v)} />
                    <EditableField label="POL" value={d.pol} onSave={(v) => saveData("pol", v)} />
                  </FieldFull>
                  <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8 }}>
                    <ToggleSwitch
                      label="E-Docs Uploaded"
                      checked={!!d.edocs_uploaded}
                      onChange={(v) => saveData("edocs_uploaded", v)}
                    />
                  </div>
                </Section>

                {/* 6. Billing */}
                <Section title="Billing">
                  <FieldFull>
                    <EditableField label="Invoice Number" value={d.invoice_number} onSave={(v) => saveData("invoice_number", v)} />
                  </FieldFull>
                  <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8 }}>
                    <div className="px-2">
                      <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>Console No.</span>
                      {consoleEditMode ? (
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            ref={consoleInputRef}
                            type="text"
                            value={consoleDraft}
                            onChange={(e) => setConsoleDraft(e.target.value)}
                            onBlur={commitConsole}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitConsole();
                              if (e.key === "Escape") setConsoleEditMode(false);
                            }}
                            placeholder="Enter console no."
                            style={{
                              flex: 1,
                              fontSize: 13,
                              padding: "4px 8px",
                              borderRadius: "var(--radius-md, 6px)",
                              border: "1.5px solid #6366f1",
                              outline: "none",
                              fontFamily: "inherit",
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mt-1">
                          <span style={{ fontSize: 13, color: job.console_no ? "var(--text)" : "var(--text-3)", fontStyle: job.console_no ? "normal" : "italic" }}>
                            {job.console_no || "—"}
                          </span>
                          <button
                            onClick={startConsoleEdit}
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              padding: "3px 10px",
                              borderRadius: "var(--radius-md, 6px)",
                              background: "#eef2ff",
                              color: "#4f46e5",
                              border: "1px solid #c7d2fe",
                              cursor: "pointer",
                            }}
                          >
                            Assign Console No
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </Section>

                {/* 7. Post-Departure Tracking */}
                <Section title="Post-Departure Tracking">
                  <FieldGrid>
                    <EditableField label="RDV Date" value={d.rdv_date} type="date" onSave={(v) => saveData("rdv_date", v)} />
                    <EditableField label="ATA" value={d.ata} type="date" onSave={(v) => saveData("ata", v)} />
                    <EditableField label="CPU / SCR" value={d.cpu_scr} onSave={(v) => saveData("cpu_scr", v)} />
                    <EditableField label="HAWB No." value={d.hawb_no} onSave={(v) => saveData("hawb_no", v)} />
                    {/* T1 split into number + date */}
                    <EditableField label="T1 No." value={d.t1_no} onSave={(v) => saveData("t1_no", v)} />
                    <EditableField label="T1 Date" value={d.t1_date} type="date" onSave={(v) => saveData("t1_date", v)} />
                    {/* FACTURE split: client invoice vs shipping line */}
                    <EditableField label="Facture (Client Inv.)" value={d.facture_no} onSave={(v) => saveData("facture_no", v)} />
                    <EditableField label="Shipping Line Inv." value={d.shipping_line_inv} onSave={(v) => saveData("shipping_line_inv", v)} />
                  </FieldGrid>
                  <FieldFull>
                    <EditableField label="Container Release Info" value={d.container_release_info} onSave={(v) => saveData("container_release_info", v)} />
                  </FieldFull>
                  {/* Instructions Douane — AMR ref + date */}
                  <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500, padding: "0 8px", display: "block", marginBottom: 2 }}>Instructions Douane</span>
                    <FieldGrid>
                      <EditableField label="AMR Ref" value={d.douane_amr_ref} placeholder="e.g. AMR 18/05" onSave={(v) => saveData("douane_amr_ref", v)} />
                      <EditableField label="Douane Date" value={d.douane_date} type="date" onSave={(v) => saveData("douane_date", v)} />
                    </FieldGrid>
                  </div>
                  {/* ODT + Arrival Notice — toggle + date side by side */}
                  <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 6 }} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div style={{ flex: 1 }}>
                        <ToggleSwitch label="ODT Sent" checked={!!d.odt_sent} onChange={(v) => saveData("odt_sent", v)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <EditableField label="ODT Date" value={d.odt_date} type="date" onSave={(v) => saveData("odt_date", v)} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div style={{ flex: 1 }}>
                        <ToggleSwitch label="Arrival Notice Sent" checked={!!d.arrival_notice_sent} onChange={(v) => saveData("arrival_notice_sent", v)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <EditableField label="Notice Date" value={d.arrival_notice_date} type="date" onSave={(v) => saveData("arrival_notice_date", v)} />
                      </div>
                    </div>
                  </div>
                </Section>

                {/* 8. Milestone Ticks */}
                <Section title="Milestone Ticks">
                  <div className="grid grid-cols-2 gap-x-2">
                    <MilestoneCheck label="Booking Released" checked={!!d.booking_released} onChange={(v) => saveData("booking_released", v)} />
                    <MilestoneCheck label="Container Lifted" checked={!!d.container_lifted} onChange={(v) => saveData("container_lifted", v)} />
                    <MilestoneCheck label="Clearance" checked={!!d.clearance} onChange={(v) => saveData("clearance", v)} />
                    <MilestoneCheck label="SI Filing Done" checked={!!d.si_filing_done} onChange={(v) => saveData("si_filing_done", v)} />
                    <MilestoneCheck label="Gate In Done" checked={!!d.gate_in_done} onChange={(v) => saveData("gate_in_done", v)} />
                    <MilestoneCheck label="BL Released" checked={!!d.bl_released} onChange={(v) => saveData("bl_released", v)} />
                    <MilestoneCheck label="Billing Done" checked={!!d.billing_done} onChange={(v) => saveData("billing_done", v)} />
                  </div>
                </Section>

                {/* 9. Shipper Documents */}
                {d.documents && d.documents.length > 0 && (
                  <Section title="Shipper Documents">
                    <div className="flex flex-col gap-1 px-2">
                      {d.documents.map((doc) => (
                        <DocumentRow key={doc.path} doc={doc} jobId={job.id} />
                      ))}
                    </div>
                  </Section>
                )}

                {/* 10. Comments */}
                <Section title="Comments">
                  <div className="flex flex-col gap-2 mb-3" style={{ maxHeight: 280, overflowY: "auto" }}>
                    {comments.length === 0 && (
                      <span style={{ fontSize: 12.5, color: "var(--text-3)", fontStyle: "italic", padding: "4px 8px" }}>
                        No comments yet.
                      </span>
                    )}
                    {comments.map((c) => {
                      const authorName = c.author?.full_name || c.author?.email || "Unknown";
                      const initial = authorName.charAt(0).toUpperCase();
                      return (
                        <div key={c.id} className="flex gap-2 items-start">
                          <div
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: "50%",
                              background: "#eef2ff",
                              color: "#4f46e5",
                              fontSize: 11,
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              border: "1px solid #c7d2fe",
                            }}
                          >
                            {initial}
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5">
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text)" }}>
                                {authorName}
                              </span>
                              <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                                {relativeTime(c.created_at)}
                              </span>
                            </div>
                            <span
                              style={{
                                fontSize: 12.5,
                                color: "var(--text)",
                                lineHeight: 1.5,
                                wordBreak: "break-word",
                              }}
                            >
                              {c.content}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={commentsEndRef} />
                  </div>

                  {/* Comment input */}
                  <div
                    className="flex gap-2 items-end"
                    style={{
                      borderTop: "1px solid var(--border)",
                      paddingTop: 10,
                    }}
                  >
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          submitComment();
                        }
                      }}
                      placeholder="Add a comment… (Enter to send)"
                      rows={2}
                      style={{
                        flex: 1,
                        fontSize: 12.5,
                        padding: "6px 8px",
                        borderRadius: "var(--radius-md, 6px)",
                        border: "1.5px solid var(--border)",
                        outline: "none",
                        resize: "none",
                        fontFamily: "inherit",
                        color: "var(--text)",
                        background: "var(--surface)",
                        lineHeight: 1.5,
                        transition: "border-color 0.12s",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                    />
                    <button
                      onClick={submitComment}
                      disabled={!commentText.trim() || addComment.isPending}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--radius-md, 6px)",
                        background: commentText.trim() ? "#6366f1" : "var(--surface-2)",
                        color: commentText.trim() ? "#fff" : "var(--text-3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: commentText.trim() ? "pointer" : "default",
                        border: "none",
                        transition: "background 0.12s",
                        flexShrink: 0,
                      }}
                    >
                      <IconSend />
                    </button>
                  </div>
                </Section>

                {/* Bottom padding */}
                <div style={{ height: 24 }} />
              </div>
            )}
          </motion.div>
        </>
      )}
      {/* Stuffing Email Modal — rendered outside panel so z-index stacks correctly */}
      {showStuffingEmail && job && (
        <StuffingEmailModal job={job} onClose={() => setShowStuffingEmail(false)} />
      )}
    </AnimatePresence>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useAiropsJobs,
  useAiropsContainers,
  useAiropsVessels,
  useUpdateJob,
  useCreateContainer,
} from "@/lib/queries/airops";
import type { AiropsJob, AiropsContainer, AiropsVessel } from "@/lib/types/airops";

// Module-level drag state — avoids re-renders during drag
let _dragJobId: string | null = null;

const VESSEL_COLORS = [
  { bg: "#eef2ff", border: "#6366f1", text: "#4f46e5", accent: "#6366f1", light: "#c7d2fe" },
  { bg: "#eff6ff", border: "#3b82f6", text: "#1d4ed8", accent: "#3b82f6", light: "#bfdbfe" },
  { bg: "#f0fdf4", border: "#22c55e", text: "#15803d", accent: "#22c55e", light: "#bbf7d0" },
  { bg: "#fff7ed", border: "#f97316", text: "#c2410c", accent: "#f97316", light: "#fed7aa" },
  { bg: "#fdf4ff", border: "#a855f7", text: "#7e22ce", accent: "#a855f7", light: "#e9d5ff" },
];

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

// ─── New Container Modal ──────────────────────────────────────────────────────

function NewContainerModal({
  vesselName,
  onClose,
  onCreate,
}: {
  vesselName: string;
  onClose: () => void;
  onCreate: (num: string, type: string) => void;
}) {
  const [num, setNum] = useState("");
  const [type, setType] = useState("20GP");
  const TYPES = ["20GP", "40GP", "40HC", "FCR"];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!num.trim()) return;
    onCreate(num.trim(), type);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onMouseDown={onClose}
    >
      <div
        className="w-80 rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>New Container</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{vesselName}</p>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded" style={{ color: "var(--text-3)" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 1l10 10M11 1L1 11" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-2)" }}>Container Number</label>
            <input
              type="text"
              value={num}
              onChange={(e) => setNum(e.target.value)}
              placeholder="e.g. MSCU1234567"
              autoFocus
              className="w-full h-9 rounded-lg px-3 text-sm"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-2)" }}>Type</label>
            <div className="grid grid-cols-4 gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className="h-8 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: type === t ? "#eef2ff" : "var(--surface-2)",
                    color: type === t ? "#4f46e5" : "var(--text-2)",
                    border: type === t ? "1.5px solid #6366f1" : "1px solid var(--border)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-lg text-sm font-medium"
              style={{ background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)" }}
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 h-9 rounded-lg text-sm font-medium text-white" style={{ background: "#6366f1" }}>
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Container Detail Modal ───────────────────────────────────────────────────

function ContainerDetailModal({
  container,
  allJobs,
  unassignedJobs,
  onClose,
  onRemoveJob,
  onAddJob,
}: {
  container: AiropsContainer;
  allJobs: AiropsJob[];
  unassignedJobs: AiropsJob[];
  onClose: () => void;
  onRemoveJob: (jobId: string) => void;
  onAddJob: (jobId: string) => void;
}) {
  const assignedJobs = allJobs.filter((j) => j.container_id === container.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onMouseDown={onClose}
    >
      <div
        className="w-[480px] rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "82vh" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#eff6ff" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                {container.container_number ?? "(no number)"}
              </p>
              {container.container_type && (
                <p className="text-xs" style={{ color: "var(--text-3)" }}>{container.container_type}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ color: "var(--text-3)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 1l10 10M11 1L1 11" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "calc(82vh - 73px)" }}>
          {/* Assigned jobs */}
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Assigned Jobs</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#eff6ff", color: "#3b82f6" }}>{assignedJobs.length}</span>
            </div>
            {assignedJobs.length === 0 ? (
              <p className="text-xs py-2" style={{ color: "var(--text-3)" }}>No jobs yet.</p>
            ) : (
              <div className="space-y-2">
                {assignedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#eff6ff", color: "#3b82f6", fontSize: 14 }}>📦</div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                          {job.data.order_no ?? job.id.slice(0, 8).toUpperCase()}
                        </p>
                        {job.data.consignee_name && (
                          <p className="text-xs" style={{ color: "var(--text-3)" }}>{job.data.consignee_name}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onRemoveJob(job.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-full text-sm transition-colors"
                      style={{ color: "#ef4444" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available jobs */}
          {unassignedJobs.length > 0 && (
            <div className="px-6 py-4">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Add More Jobs</span>
              <div className="space-y-2 mt-3">
                {unassignedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                    onClick={() => onAddJob(job.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--border)", color: "var(--text-3)", fontSize: 14 }}>📋</div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                          {job.data.order_no ?? job.id.slice(0, 8).toUpperCase()}
                        </p>
                        {job.data.consignee_name && (
                          <p className="text-xs" style={{ color: "var(--text-3)" }}>{job.data.consignee_name}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: "#6366f1" }}>+ Add</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Vessel Dock Card ─────────────────────────────────────────────────────────

function VesselDock({
  vessel,
  containers,
  allJobs,
  colorIdx,
  dropTarget,
  onDragOverContainer,
  onDragOverEmpty,
  onDragLeave,
  onDropContainer,
  onDropEmpty,
  onClickContainer,
  onAddContainer,
}: {
  vessel: AiropsVessel;
  containers: AiropsContainer[];
  allJobs: AiropsJob[];
  colorIdx: number;
  dropTarget: string | null;
  onDragOverContainer: (e: React.DragEvent, ctrId: string) => void;
  onDragOverEmpty: (e: React.DragEvent, vesselId: string) => void;
  onDragLeave: () => void;
  onDropContainer: (e: React.DragEvent, ctrId: string) => void;
  onDropEmpty: (e: React.DragEvent, vesselId: string) => void;
  onClickContainer: (ctr: AiropsContainer) => void;
  onAddContainer: (vesselId: string) => void;
}) {
  const vc = VESSEL_COLORS[colorIdx % VESSEL_COLORS.length];
  const vesselJobs = allJobs.filter((j) => containers.some((c) => c.id === j.container_id));
  const emptyDropKey = `vessel:${vessel.id}:empty`;

  // Rough fill % based on job count vs containers*5 capacity estimate
  const fillPct =
    containers.length > 0 ? Math.min(100, Math.round((vesselJobs.length / (containers.length * 5)) * 100)) : 0;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--surface)",
        border: `2px solid ${vc.border}`,
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
      }}
    >
      {/* Vessel header */}
      <div className="px-5 pt-4 pb-3" style={{ background: vc.bg, borderBottom: `1px solid ${vc.light}` }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {/* Ship icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={vc.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2" />
                <path d="M7 20V12a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v8" />
                <path d="M12 12V8M8 8h8M5 12H2l2-7h14l2 7h-3" />
              </svg>
              <span className="text-sm font-bold" style={{ color: vc.text }}>{vessel.name}</span>
            </div>
            <p className="text-xs" style={{ color: vc.text, opacity: 0.65 }}>
              {[vessel.pol, vessel.pod].filter(Boolean).join(" → ")}
              {vessel.etd ? ` · ETD ${fmtDate(vessel.etd)}` : ""}
              {vessel.eta ? ` · ETA ${fmtDate(vessel.eta)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: "white", color: vc.text, border: `1px solid ${vc.light}` }}
            >
              {containers.length} ctr{containers.length !== 1 ? "s" : ""}
            </span>
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: "white", color: vc.text, border: `1px solid ${vc.light}` }}
            >
              {vesselJobs.length} job{vesselJobs.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Capacity bar */}
        {containers.length > 0 && (
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.5)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${fillPct}%`, background: vc.accent }} />
            </div>
            <span className="text-xs font-bold shrink-0" style={{ color: vc.text }}>{fillPct}%</span>
          </div>
        )}
      </div>

      {/* Container grid */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          {/* Filled containers */}
          {containers.map((ctr) => {
            const ctrJobs = allJobs.filter((j) => j.container_id === ctr.id);
            const isDrop = dropTarget === ctr.id;
            return (
              <div
                key={ctr.id}
                onDragOver={(e) => onDragOverContainer(e, ctr.id)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDropContainer(e, ctr.id)}
                onClick={() => onClickContainer(ctr)}
                className="rounded-xl p-3 cursor-pointer select-none"
                style={{
                  background: isDrop ? "#f0fdf4" : vc.bg,
                  border: isDrop ? "2px solid #22c55e" : `2px solid ${vc.light}`,
                  boxShadow: isDrop ? "0 0 0 4px #bbf7d0" : "none",
                  transform: isDrop ? "scale(1.04)" : "scale(1)",
                  transition: "all 0.1s",
                  minHeight: 76,
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <span
                    className="text-xs font-bold truncate"
                    style={{ color: isDrop ? "#15803d" : vc.text, maxWidth: "70%" }}
                  >
                    {ctr.container_number ?? "CTR"}
                  </span>
                  {ctr.container_type && (
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: "white", color: vc.accent }}
                    >
                      {ctr.container_type}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={isDrop ? "#22c55e" : vc.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                  <span className="text-xs" style={{ color: isDrop ? "#15803d" : vc.text, opacity: 0.8 }}>
                    {isDrop ? "Drop here" : `${ctrJobs.length} job${ctrJobs.length !== 1 ? "s" : ""}`}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Empty slots (always show 3) */}
          {Array.from({ length: 3 }).map((_, i) => {
            const isDrop = dropTarget === emptyDropKey;
            return (
              <div
                key={`empty-${i}`}
                onDragOver={(e) => onDragOverEmpty(e, vessel.id)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDropEmpty(e, vessel.id)}
                onClick={() => onAddContainer(vessel.id)}
                className="rounded-xl flex flex-col items-center justify-center cursor-pointer select-none"
                style={{
                  background: isDrop ? "#f0fdf4" : "transparent",
                  border: isDrop ? "2px solid #22c55e" : "2px dashed var(--border)",
                  boxShadow: isDrop ? "0 0 0 4px #bbf7d0" : "none",
                  transform: isDrop ? "scale(1.04)" : "scale(1)",
                  transition: "all 0.1s",
                  minHeight: 76,
                }}
              >
                {isDrop ? (
                  <span className="text-xs font-semibold" style={{ color: "#15803d" }}>Create & assign</span>
                ) : (
                  <>
                    <span className="text-xl font-light" style={{ color: "var(--text-3)", lineHeight: 1 }}>+</span>
                    <span className="text-[10px] mt-1" style={{ color: "var(--text-3)" }}>Add container</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AiropsDockyardView() {
  const { data: jobs = [] } = useAiropsJobs();
  const { data: containers = [] } = useAiropsContainers();
  const { data: vessels = [] } = useAiropsVessels();

  const updateJob = useUpdateJob();
  const createContainer = useCreateContainer();

  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [newCtrModal, setNewCtrModal] = useState<{ vesselId: string; pendingJobId?: string } | null>(null);
  const [detailModal, setDetailModal] = useState<{ container: AiropsContainer } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showAllJobs, setShowAllJobs] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const unassignedJobs = jobs.filter((j) => !j.container_id);
  const assignedCount = jobs.filter((j) => j.container_id).length;
  const pct = jobs.length > 0 ? Math.round((assignedCount / jobs.length) * 100) : 0;
  const displayedJobs = showAllJobs ? jobs : unassignedJobs;

  const vesselsSorted = [...vessels].sort((a, b) => {
    if (!a.etd) return 1;
    if (!b.etd) return -1;
    return new Date(a.etd).getTime() - new Date(b.etd).getTime();
  });

  // ── Drag handlers ────────────────────────────────────────────────────────────

  function handleJobDragStart(e: React.DragEvent, jobId: string) {
    _dragJobId = jobId;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleJobDragEnd() {
    _dragJobId = null;
    setDropTarget(null);
  }

  function handleDragOverContainer(e: React.DragEvent, ctrId: string) {
    e.preventDefault();
    if (_dragJobId) setDropTarget(ctrId);
  }

  function handleDragOverEmpty(e: React.DragEvent, vesselId: string) {
    e.preventDefault();
    if (_dragJobId) setDropTarget(`vessel:${vesselId}:empty`);
  }

  function handleDragLeave() {
    setDropTarget(null);
  }

  function handleDropContainer(e: React.DragEvent, ctrId: string) {
    e.preventDefault();
    if (!_dragJobId) return;
    const jobId = _dragJobId;
    _dragJobId = null;
    setDropTarget(null);
    updateJob.mutate(
      { id: jobId, updates: { container_id: ctrId } },
      {
        onSuccess: () => {
          const ctr = containers.find((c) => c.id === ctrId);
          showToast(`Job assigned to ${ctr?.container_number ?? "container"}`);
        },
      }
    );
  }

  function handleDropEmpty(e: React.DragEvent, vesselId: string) {
    e.preventDefault();
    if (!_dragJobId) return;
    const jobId = _dragJobId;
    _dragJobId = null;
    setDropTarget(null);
    setNewCtrModal({ vesselId, pendingJobId: jobId });
  }

  function handleRemoveJob(jobId: string) {
    updateJob.mutate(
      { id: jobId, updates: { container_id: null } },
      { onSuccess: () => showToast("Job removed from container") }
    );
  }

  function handleAddJob(jobId: string, containerId: string) {
    updateJob.mutate(
      { id: jobId, updates: { container_id: containerId } },
      {
        onSuccess: () => {
          const ctr = containers.find((c) => c.id === containerId);
          showToast(`Job added to ${ctr?.container_number ?? "container"}`);
        },
      }
    );
  }

  function handleCreateContainer(vesselId: string, num: string, type: string) {
    const pendingJobId = newCtrModal?.pendingJobId;
    createContainer.mutate(
      { vessel_id: vesselId, container_number: num, container_type: type } as Parameters<typeof createContainer.mutate>[0],
      {
        onSuccess: (newCtr: any) => {
          if (pendingJobId && newCtr?.id) {
            updateJob.mutate(
              { id: pendingJobId, updates: { container_id: newCtr.id } },
              { onSuccess: () => showToast(`Job assigned to new container ${num}`) }
            );
          } else {
            showToast(`Container ${num} created`);
          }
        },
      }
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden" style={{ background: "var(--background)" }}>

      {/* ── Left panel — job pool ─────────────────────────────────────────────── */}
      <div
        className="flex flex-col shrink-0 overflow-hidden"
        style={{ width: 284, borderRight: "1px solid var(--border)", background: "var(--surface)" }}
      >
        {/* Header */}
        <div className="px-4 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          {/* Title + back link */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#6366f1" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 12v5M9.5 14.5l2.5-2.5 2.5 2.5" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold leading-none" style={{ color: "var(--text)" }}>Dockyard</p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-3)" }}>Drag jobs into containers</p>
            </div>
            <Link
              href="/airops/board"
              className="text-[10px] font-medium px-2 py-1 rounded-lg"
              style={{ color: "var(--text-3)", background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              Board
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[
              { label: "Jobs", value: jobs.length, color: "#6366f1" },
              { label: "Ctrs", value: containers.length, color: "#3b82f6" },
              { label: "Vessels", value: vessels.length, color: "#8b5cf6" },
            ].map((s) => (
              <div key={s.label} className="px-2 py-2 rounded-lg text-center" style={{ background: "var(--surface-2)" }}>
                <p className="text-base font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-3)" }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Assignment progress */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px]" style={{ color: "var(--text-3)" }}>Assigned</span>
              <span className="text-[10px] font-bold" style={{ color: "#10b981" }}>{pct}%</span>
            </div>
            <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "var(--border)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "#10b981" }} />
            </div>
          </div>
        </div>

        {/* Job list header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
            {showAllJobs ? "All" : "Unassigned"} ({displayedJobs.length})
          </span>
          <button
            className="text-[10px] font-medium px-2 py-0.5 rounded-md"
            style={{ color: "var(--text-3)", background: "var(--surface-2)", border: "1px solid var(--border)" }}
            onClick={() => setShowAllJobs((v) => !v)}
          >
            {showAllJobs ? "Unassigned" : "All"}
          </button>
        </div>

        {/* Draggable job list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5">
          {displayedJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#f0fdf4" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>All jobs assigned</p>
              <button
                className="text-xs mt-2"
                style={{ color: "#6366f1" }}
                onClick={() => setShowAllJobs(true)}
              >
                View all →
              </button>
            </div>
          ) : (
            displayedJobs.map((job) => (
              <div
                key={job.id}
                draggable
                onDragStart={(e) => handleJobDragStart(e, job.id)}
                onDragEnd={handleJobDragEnd}
                className="px-3 py-2.5 rounded-xl cursor-grab active:cursor-grabbing select-none transition-all"
                style={{
                  background: job.container_id ? "#f0fdf4" : "var(--surface-2)",
                  border: job.container_id ? "1px solid #86efac" : "1px solid var(--border)",
                }}
                onMouseEnter={(e) => {
                  if (!job.container_id) (e.currentTarget as HTMLElement).style.borderColor = "#a5b4fc";
                }}
                onMouseLeave={(e) => {
                  if (!job.container_id) (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                }}
              >
                <div className="flex items-center gap-2">
                  {/* Grip dots */}
                  <svg width="8" height="12" viewBox="0 0 8 12" fill="none" className="shrink-0" style={{ color: "var(--text-3)" }}>
                    {[0, 4].map((cx) => [1, 5, 9].map((cy) => (
                      <circle key={`${cx}-${cy}`} cx={cx + 1} cy={cy} r="1.1" fill="currentColor" />
                    )))}
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: "var(--text)" }}>
                      {job.data.order_no ?? job.id.slice(0, 8).toUpperCase()}
                    </p>
                    {job.data.consignee_name && (
                      <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--text-3)" }}>{job.data.consignee_name}</p>
                    )}
                  </div>
                  {job.container_id ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "#dcfce7", color: "#15803d" }}>✓</span>
                  ) : (
                    <span className="text-[9px] font-semibold shrink-0" style={{ color: "var(--text-3)" }}>→</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Vessel docks ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold" style={{ color: "var(--text)" }}>Vessel Docks</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              Drag jobs from the left into container slots · Click container to manage jobs
            </p>
          </div>
          <Link
            href="/airops/canvas"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: "var(--surface)", color: "var(--text-2)", border: "1px solid var(--border)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="8" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="12" cy="17" r="2" />
              <path d="M8 8h8M7 10l4 6M17 10l-4 6" />
            </svg>
            Node Canvas
          </Link>
        </div>

        {vessels.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-2xl py-20 text-center"
            style={{ background: "var(--surface)", border: "2px dashed var(--border)" }}
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#f5f3ff" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2" />
                <path d="M7 20V12a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v8" />
                <path d="M12 12V8M8 8h8M5 12H2l2-7h14l2 7h-3" />
              </svg>
            </div>
            <p className="text-sm font-bold" style={{ color: "var(--text-2)" }}>No vessels yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>Create vessels on the Node Canvas first</p>
            <Link
              href="/airops/canvas"
              className="mt-4 text-xs px-4 py-2 rounded-lg text-white"
              style={{ background: "#6366f1" }}
            >
              Open Node Canvas →
            </Link>
          </div>
        ) : (
          vesselsSorted.map((vessel, i) => (
            <VesselDock
              key={vessel.id}
              vessel={vessel}
              containers={containers.filter((c) => c.vessel_id === vessel.id)}
              allJobs={jobs}
              colorIdx={i}
              dropTarget={dropTarget}
              onDragOverContainer={handleDragOverContainer}
              onDragOverEmpty={handleDragOverEmpty}
              onDragLeave={handleDragLeave}
              onDropContainer={handleDropContainer}
              onDropEmpty={handleDropEmpty}
              onClickContainer={(ctr) => setDetailModal({ container: ctr })}
              onAddContainer={(vesselId) => setNewCtrModal({ vesselId })}
            />
          ))
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {newCtrModal && (
        <NewContainerModal
          vesselName={vessels.find((v) => v.id === newCtrModal.vesselId)?.name ?? "vessel"}
          onClose={() => setNewCtrModal(null)}
          onCreate={(num, type) => handleCreateContainer(newCtrModal.vesselId, num, type)}
        />
      )}

      {detailModal && (
        <ContainerDetailModal
          container={detailModal.container}
          allJobs={jobs}
          unassignedJobs={unassignedJobs}
          onClose={() => setDetailModal(null)}
          onRemoveJob={handleRemoveJob}
          onAddJob={(jobId) => {
            handleAddJob(jobId, detailModal.container.id);
            setDetailModal(null);
          }}
        />
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg z-50"
          style={{ background: "#1e293b", color: "white", fontSize: 13, fontWeight: 500, pointerEvents: "none" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toast}
        </div>
      )}
    </div>
  );
}

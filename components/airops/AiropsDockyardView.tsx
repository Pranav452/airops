"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useAiropsJobs,
  useAiropsContainers,
  useAiropsVessels,
  useUpdateJob,
  useCreateContainer,
  useCreateVessel,
} from "@/lib/queries/airops";
import type { AiropsJob, AiropsContainer, AiropsVessel } from "@/lib/types/airops";

// Module-level drag state
let _dragJobId: string | null = null;

const VESSEL_PALETTE = [
  { bg: "#eef2ff", border: "#818cf8", text: "#4338ca", accent: "#6366f1", soft: "#e0e7ff" },
  { bg: "#eff6ff", border: "#60a5fa", text: "#1d4ed8", accent: "#3b82f6", soft: "#dbeafe" },
  { bg: "#fdf4ff", border: "#c084fc", text: "#7e22ce", accent: "#a855f7", soft: "#f3e8ff" },
  { bg: "#fff7ed", border: "#fb923c", text: "#c2410c", accent: "#f97316", soft: "#ffedd5" },
  { bg: "#f0fdf4", border: "#4ade80", text: "#15803d", accent: "#22c55e", soft: "#dcfce7" },
  { bg: "#fefce8", border: "#facc15", text: "#854d0e", accent: "#eab308", soft: "#fef9c3" },
];

const CONTAINER_TYPES = ["20GP", "40GP", "40HC", "FCR"];

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }); }
  catch { return iso; }
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function NewContainerModal({ vesselName, onClose, onCreate }: {
  vesselName: string;
  onClose: () => void;
  onCreate: (num: string, type: string) => void;
}) {
  const [num, setNum] = useState("");
  const [type, setType] = useState("20GP");
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onMouseDown={onClose}
      >
        <motion.div
          className="w-80 rounded-2xl p-6 shadow-2xl"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 16 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
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
          <form onSubmit={(e) => { e.preventDefault(); if (!num.trim()) return; onCreate(num.trim(), type); onClose(); }} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-2)" }}>Container Number</label>
              <input
                value={num} onChange={(e) => setNum(e.target.value)}
                placeholder="e.g. MSCU1234567" autoFocus
                className="w-full h-9 rounded-lg px-3 text-sm"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-2)" }}>Type</label>
              <div className="grid grid-cols-4 gap-1.5">
                {CONTAINER_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className="h-8 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: type === t ? "#eef2ff" : "var(--surface-2)", color: type === t ? "#4f46e5" : "var(--text-2)", border: type === t ? "1.5px solid #6366f1" : "1px solid var(--border)" }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)" }}>Cancel</button>
              <button type="submit" className="flex-1 h-9 rounded-lg text-sm font-medium text-white" style={{ background: "#6366f1" }}>Create</button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function NewVesselModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (data: { name: string; pol: string; pod: string; etd: string; eta: string }) => void;
}) {
  const [form, setForm] = useState({ name: "", pol: "", pod: "", etd: "", eta: "" });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onMouseDown={onClose}
      >
        <motion.div
          className="w-96 rounded-2xl p-6 shadow-2xl"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 16 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>Add Vessel</h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>Create a new vessel for this voyage</p>
            </div>
            <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded" style={{ color: "var(--text-3)" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 1l10 10M11 1L1 11" /></svg>
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return; onCreate(form); onClose(); }} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>Vessel Name *</label>
              <input value={form.name} onChange={set("name")} placeholder="e.g. MSC ANNA" autoFocus
                className="w-full h-9 rounded-lg px-3 text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>POL</label>
                <input value={form.pol} onChange={set("pol")} placeholder="e.g. CNSHA"
                  className="w-full h-9 rounded-lg px-3 text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>POD</label>
                <input value={form.pod} onChange={set("pod")} placeholder="e.g. FRLEH"
                  className="w-full h-9 rounded-lg px-3 text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>ETD</label>
                <input type="date" value={form.etd} onChange={set("etd")}
                  className="w-full h-9 rounded-lg px-3 text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>ETA</label>
                <input type="date" value={form.eta} onChange={set("eta")}
                  className="w-full h-9 rounded-lg px-3 text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)" }}>Cancel</button>
              <button type="submit" className="flex-1 h-9 rounded-lg text-sm font-medium text-white" style={{ background: "#6366f1" }}>Create Vessel</button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Container slot ───────────────────────────────────────────────────────────

function ContainerSlot({
  container,
  jobs,
  dropTarget,
  vc,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
}: {
  container: AiropsContainer;
  jobs: AiropsJob[];
  dropTarget: string | null;
  vc: typeof VESSEL_PALETTE[0];
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onClick: () => void;
}) {
  const isDrop = dropTarget === container.id;
  const jobCount = jobs.length;
  const fillColor = jobCount === 0 ? vc.soft : jobCount < 3 ? "#fef9c3" : "#dcfce7";
  const fillBorder = jobCount === 0 ? vc.border : jobCount < 3 ? "#fde68a" : "#86efac";
  const fillText = jobCount === 0 ? vc.text : jobCount < 3 ? "#854d0e" : "#15803d";

  return (
    <motion.div
      layout
      onDragOver={(e) => onDragOver(e, container.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, container.id)}
      onClick={onClick}
      animate={isDrop ? { scale: 1.06, boxShadow: "0 0 0 3px #22c55e66" } : { scale: 1, boxShadow: "0 0 0 0px transparent" }}
      transition={{ type: "spring", damping: 18, stiffness: 260 }}
      className="rounded-xl p-2.5 cursor-pointer select-none"
      style={{
        background: isDrop ? "#f0fdf4" : fillColor,
        border: `1.5px solid ${isDrop ? "#22c55e" : fillBorder}`,
        minHeight: 64,
      }}
    >
      {/* Container number */}
      <p className="text-[10px] font-bold truncate mb-1" style={{ color: isDrop ? "#15803d" : fillText }}>
        {container.container_number ?? "CTR"}
      </p>
      {/* Type badge */}
      {container.container_type && (
        <span className="text-[9px] font-semibold px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.7)", color: vc.accent }}>
          {container.container_type}
        </span>
      )}
      {/* Job pill */}
      <div className="flex items-center gap-1 mt-1.5">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: isDrop ? "#22c55e" : fillText }}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
        <span className="text-[10px] font-medium" style={{ color: isDrop ? "#15803d" : fillText }}>
          {isDrop ? "Drop" : `${jobCount} job${jobCount !== 1 ? "s" : ""}`}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Empty slot ───────────────────────────────────────────────────────────────

function EmptySlot({ dropKey, dropTarget, vc, onDragOver, onDragLeave, onDrop, onClick }: {
  dropKey: string;
  dropTarget: string | null;
  vc: typeof VESSEL_PALETTE[0];
  onDragOver: (e: React.DragEvent, key: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, key: string) => void;
  onClick: () => void;
}) {
  const isDrop = dropTarget === dropKey;
  return (
    <motion.div
      animate={isDrop ? { scale: 1.06, boxShadow: "0 0 0 3px #22c55e66" } : { scale: 1, boxShadow: "0 0 0 0px transparent" }}
      transition={{ type: "spring", damping: 18, stiffness: 260 }}
      onDragOver={(e) => onDragOver(e, dropKey)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, dropKey)}
      onClick={onClick}
      className="rounded-xl flex flex-col items-center justify-center cursor-pointer select-none"
      style={{
        background: isDrop ? "#f0fdf4" : "transparent",
        border: isDrop ? "1.5px solid #22c55e" : "1.5px dashed var(--border)",
        minHeight: 64,
      }}
    >
      {isDrop ? (
        <span className="text-[10px] font-bold" style={{ color: "#15803d" }}>+ New</span>
      ) : (
        <>
          <span className="text-lg font-light leading-none" style={{ color: "var(--border)" }}>+</span>
          <span className="text-[9px] mt-0.5" style={{ color: "var(--text-3)" }}>Add</span>
        </>
      )}
    </motion.div>
  );
}

// ─── Vessel Bay ───────────────────────────────────────────────────────────────

function VesselBay({
  vessel, containers, allJobs, colorIdx, dropTarget,
  onDragOverContainer, onDragOverEmpty, onDragLeave,
  onDropContainer, onDropEmpty, onClickContainer, onAddContainer,
}: {
  vessel: AiropsVessel;
  containers: AiropsContainer[];
  allJobs: AiropsJob[];
  colorIdx: number;
  dropTarget: string | null;
  onDragOverContainer: (e: React.DragEvent, id: string) => void;
  onDragOverEmpty: (e: React.DragEvent, key: string) => void;
  onDragLeave: () => void;
  onDropContainer: (e: React.DragEvent, id: string) => void;
  onDropEmpty: (e: React.DragEvent, key: string) => void;
  onClickContainer: (ctr: AiropsContainer) => void;
  onAddContainer: (vesselId: string) => void;
}) {
  const vc = VESSEL_PALETTE[colorIdx % VESSEL_PALETTE.length];
  const vesselJobs = allJobs.filter((j) => containers.some((c) => c.id === j.container_id));
  const assignedCount = vesselJobs.length;
  const totalCap = containers.length * 5;
  const fillPct = totalCap > 0 ? Math.min(100, Math.round((assignedCount / totalCap) * 100)) : 0;

  // Color code fill level
  const barColor = fillPct > 80 ? "#22c55e" : fillPct > 40 ? "#eab308" : vc.accent;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 22, stiffness: 280 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface)", border: `2px solid ${vc.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
    >
      {/* Vessel header */}
      <div className="px-4 pt-3.5 pb-3" style={{ background: vc.bg, borderBottom: `1px solid ${vc.soft}` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: vc.accent }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2" />
                <path d="M7 20V12a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v8" />
                <path d="M12 12V8M8 8h8M5 12H2l2-7h14l2 7h-3" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: vc.text }}>{vessel.name}</p>
              <p className="text-[10px] truncate" style={{ color: vc.text, opacity: 0.65 }}>
                {[vessel.pol, vessel.pod].filter(Boolean).join(" → ")}
                {vessel.etd ? ` · ETD ${fmtDate(vessel.etd)}` : ""}
                {vessel.eta ? ` · ETA ${fmtDate(vessel.eta)}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "white", color: vc.text, border: `1px solid ${vc.soft}` }}>
              {containers.length} ctr
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "white", color: vc.text, border: `1px solid ${vc.soft}` }}>
              {assignedCount} job
            </span>
          </div>
        </div>

        {/* Capacity bar */}
        <div className="flex items-center gap-2 mt-2.5">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.55)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: barColor }}
              initial={{ width: 0 }}
              animate={{ width: `${fillPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <span className="text-[10px] font-bold shrink-0" style={{ color: vc.text }}>{fillPct}%</span>
        </div>
      </div>

      {/* Container grid */}
      <div className="p-3">
        <motion.div layout className="grid grid-cols-4 gap-2">
          {containers.map((ctr) => (
            <ContainerSlot
              key={ctr.id}
              container={ctr}
              jobs={allJobs.filter((j) => j.container_id === ctr.id)}
              dropTarget={dropTarget}
              vc={vc}
              onDragOver={onDragOverContainer}
              onDragLeave={onDragLeave}
              onDrop={onDropContainer}
              onClick={() => onClickContainer(ctr)}
            />
          ))}
          {/* Always show 2 add slots */}
          {[0, 1].map((i) => {
            const key = `vessel:${vessel.id}:empty:${i}`;
            return (
              <EmptySlot
                key={key}
                dropKey={key}
                dropTarget={dropTarget}
                vc={vc}
                onDragOver={onDragOverEmpty}
                onDragLeave={onDragLeave}
                onDrop={(e, k) => {
                  // Only first empty slot triggers create; rest are visual
                  if (i === 0) onDropEmpty(e, k);
                  else onDropEmpty(e, key);
                }}
                onClick={() => i === 0 ? onAddContainer(vessel.id) : onAddContainer(vessel.id)}
              />
            );
          })}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Container Detail Panel ───────────────────────────────────────────────────

function ContainerDetailPanel({ container, allJobs, unassignedJobs, onClose, onRemoveJob, onAddJob }: {
  container: AiropsContainer;
  allJobs: AiropsJob[];
  unassignedJobs: AiropsJob[];
  onClose: () => void;
  onRemoveJob: (id: string) => void;
  onAddJob: (id: string) => void;
}) {
  const assignedJobs = allJobs.filter((j) => j.container_id === container.id);
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onMouseDown={onClose}
    >
      <motion.div
        className="w-[460px] rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "80vh" }}
        initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 16 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#eff6ff" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{container.container_number ?? "(no number)"}</p>
              {container.container_type && <p className="text-xs" style={{ color: "var(--text-3)" }}>{container.container_type}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ color: "var(--text-3)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 1l10 10M11 1L1 11" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "calc(80vh - 73px)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Assigned Jobs</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#eff6ff", color: "#3b82f6" }}>{assignedJobs.length}</span>
            </div>
            {assignedJobs.length === 0 ? (
              <p className="text-xs py-2" style={{ color: "var(--text-3)" }}>No jobs assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {assignedJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{job.data.order_no ?? job.id.slice(0, 8).toUpperCase()}</p>
                      {job.data.consignee_name && <p className="text-xs" style={{ color: "var(--text-3)" }}>{job.data.consignee_name}</p>}
                    </div>
                    <button onClick={() => onRemoveJob(job.id)} className="w-7 h-7 flex items-center justify-center rounded-full text-lg transition-colors"
                      style={{ color: "#ef4444" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {unassignedJobs.length > 0 && (
            <div className="px-5 py-4">
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Add More Jobs</span>
              <div className="space-y-2 mt-3">
                {unassignedJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#a5b4fc")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                    onClick={() => onAddJob(job.id)}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{job.data.order_no ?? job.id.slice(0, 8).toUpperCase()}</p>
                      {job.data.consignee_name && <p className="text-xs" style={{ color: "var(--text-3)" }}>{job.data.consignee_name}</p>}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: "#6366f1" }}>+ Add</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AiropsDockyardView() {
  const { data: jobs = [] } = useAiropsJobs();
  const { data: containers = [] } = useAiropsContainers();
  const { data: vessels = [] } = useAiropsVessels();

  const updateJob = useUpdateJob();
  const createContainer = useCreateContainer();
  const createVessel = useCreateVessel();

  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [newCtrModal, setNewCtrModal] = useState<{ vesselId: string; pendingJobId?: string } | null>(null);
  const [newVesselModal, setNewVesselModal] = useState(false);
  const [detailModal, setDetailModal] = useState<{ container: AiropsContainer } | null>(null);
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [jobSearch, setJobSearch] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  const unassignedJobs = jobs.filter((j) => !j.container_id);
  const assignedCount = jobs.filter((j) => j.container_id).length;
  const pct = jobs.length > 0 ? Math.round((assignedCount / jobs.length) * 100) : 0;

  const displayedJobs = (showAllJobs ? jobs : unassignedJobs).filter((j) => {
    if (!jobSearch.trim()) return true;
    const q = jobSearch.toLowerCase();
    return (
      (j.data.order_no ?? "").toLowerCase().includes(q) ||
      (j.data.consignee_name ?? "").toLowerCase().includes(q)
    );
  });

  // Sort by arrival: upcoming ETAs first (soonest on top), already-arrived
  // after (most recent first), undated last. ETD stands in when ETA missing.
  const todayIso = new Date().toISOString().slice(0, 10);
  const vesselsSorted = [...vessels].sort((a, b) => {
    const ka = a.eta ?? a.etd ?? "";
    const kb = b.eta ?? b.etd ?? "";
    if (!ka) return 1;
    if (!kb) return -1;
    const aFuture = ka >= todayIso;
    const bFuture = kb >= todayIso;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    return aFuture ? ka.localeCompare(kb) : kb.localeCompare(ka);
  });

  // ── Drag ────────────────────────────────────────────────────────────────────

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

  function handleDragOverEmpty(e: React.DragEvent, key: string) {
    e.preventDefault();
    if (_dragJobId) setDropTarget(key);
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
    updateJob.mutate({ id: jobId, updates: { container_id: ctrId } }, {
      onSuccess: () => {
        const ctr = containers.find((c) => c.id === ctrId);
        showToast(`Job assigned to ${ctr?.container_number ?? "container"}`);
      },
    });
  }

  function handleDropEmpty(e: React.DragEvent, key: string) {
    e.preventDefault();
    if (!_dragJobId) return;
    const jobId = _dragJobId;
    // Extract vesselId from key: "vessel:{id}:empty:0"
    const vesselId = key.split(":")[1];
    _dragJobId = null;
    setDropTarget(null);
    setNewCtrModal({ vesselId, pendingJobId: jobId });
  }

  function handleRemoveJob(jobId: string) {
    updateJob.mutate({ id: jobId, updates: { container_id: null } }, {
      onSuccess: () => showToast("Job removed from container"),
    });
  }

  function handleAddJob(jobId: string, containerId: string) {
    updateJob.mutate({ id: jobId, updates: { container_id: containerId } }, {
      onSuccess: () => {
        const ctr = containers.find((c) => c.id === containerId);
        showToast(`Job added to ${ctr?.container_number ?? "container"}`);
      },
    });
  }

  function handleCreateContainer(vesselId: string, num: string, type: string) {
    const pendingJobId = newCtrModal?.pendingJobId;
    createContainer.mutate(
      { vessel_id: vesselId, container_number: num, container_type: type } as Parameters<typeof createContainer.mutate>[0],
      {
        onSuccess: (newCtr: any) => {
          if (pendingJobId && newCtr?.id) {
            updateJob.mutate({ id: pendingJobId, updates: { container_id: newCtr.id } }, {
              onSuccess: () => showToast(`Job assigned to new container ${num}`),
            });
          } else {
            showToast(`Container ${num} created`);
          }
        },
      }
    );
  }

  function handleCreateVessel(form: { name: string; pol: string; pod: string; etd: string; eta: string }) {
    createVessel.mutate(
      { name: form.name, pol: form.pol || null, pod: form.pod || null, etd: form.etd || null, eta: form.eta || null, canvas_x: 0, canvas_y: 0 } as any,
      { onSuccess: () => showToast(`Vessel "${form.name}" created`) }
    );
  }

  // ── Summary numbers ──────────────────────────────────────────────────────────

  const stats = [
    { label: "Total Jobs", value: jobs.length, color: "#6366f1", bg: "#eef2ff" },
    { label: "Unassigned", value: unassignedJobs.length, color: "#ef4444", bg: "#fef2f2" },
    { label: "Containers", value: containers.length, color: "#3b82f6", bg: "#eff6ff" },
    { label: "Vessels", value: vessels.length, color: "#8b5cf6", bg: "#f5f3ff" },
    { label: "Assigned", value: `${pct}%`, color: "#10b981", bg: "#f0fdf4" },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden" style={{ background: "var(--background)" }}>

      {/* ── Left: Job Pool ───────────────────────────────────────────────────── */}
      <div className="flex flex-col shrink-0 overflow-hidden" style={{ width: 272, borderRight: "1px solid var(--border)", background: "var(--surface)" }}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#6366f1" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 12v5M9.5 14.5l2.5-2.5 2.5 2.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold leading-none" style={{ color: "var(--text)" }}>Dockyard</p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-3)" }}>Drag jobs into containers</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {stats.slice(0, 3).map((s) => (
              <div key={s.label} className="px-2 py-2 rounded-lg text-center" style={{ background: s.bg }}>
                <p className="text-sm font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px] mt-0.5 leading-tight" style={{ color: s.color, opacity: 0.7 }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {stats.slice(3).map((s) => (
              <div key={s.label} className="px-2 py-2 rounded-lg text-center" style={{ background: s.bg }}>
                <p className="text-sm font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px] mt-0.5 leading-tight" style={{ color: s.color, opacity: 0.7 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px]" style={{ color: "var(--text-3)" }}>Assignment progress</span>
              <span className="text-[10px] font-bold" style={{ color: "#10b981" }}>{pct}%</span>
            </div>
            <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: "var(--border)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: "#10b981" }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>

        {/* Search + toggle */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="flex items-center gap-1.5 h-7 rounded-lg px-2.5 mb-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0" style={{ color: "var(--text-3)" }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input value={jobSearch} onChange={(e) => setJobSearch(e.target.value)} placeholder="Search jobs…"
              className="flex-1 bg-transparent text-[11px] min-w-0"
              style={{ color: "var(--text)", border: "none", outline: "none" }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              {showAllJobs ? "All" : "Unassigned"} ({displayedJobs.length})
            </span>
            <button className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
              style={{ color: "var(--text-3)", background: "var(--surface-2)", border: "1px solid var(--border)" }}
              onClick={() => setShowAllJobs((v) => !v)}>
              {showAllJobs ? "Unassigned" : "All"}
            </button>
          </div>
        </div>

        {/* Job list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <AnimatePresence mode="popLayout">
            {displayedJobs.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-10 text-center"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#f0fdf4" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <p className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>All jobs assigned</p>
                <button className="text-xs mt-2" style={{ color: "#6366f1" }} onClick={() => setShowAllJobs(true)}>View all →</button>
              </motion.div>
            ) : (
              displayedJobs.map((job) => (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ type: "spring", damping: 22, stiffness: 280 }}
                  draggable
                  onDragStart={(e) => handleJobDragStart(e as unknown as React.DragEvent, job.id)}
                  onDragEnd={handleJobDragEnd}
                  className="mb-1.5 px-3 py-2.5 rounded-xl cursor-grab active:cursor-grabbing select-none"
                  style={{
                    background: job.container_id ? "#f0fdf4" : "var(--surface-2)",
                    border: job.container_id ? "1px solid #86efac" : "1px solid var(--border)",
                  }}
                  whileHover={{ scale: 1.02, transition: { duration: 0.12 } }}
                  whileDrag={{ scale: 1.05, opacity: 0.85, cursor: "grabbing" }}
                >
                  <div className="flex items-center gap-2">
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
                    {job.container_id
                      ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "#dcfce7", color: "#15803d" }}>✓</span>
                      : <span className="text-[9px] font-semibold shrink-0" style={{ color: "var(--text-3)" }}>→</span>
                    }
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Right: Vessel Docks ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
          <div>
            <h1 className="text-sm font-bold" style={{ color: "var(--text)" }}>Vessel Bays</h1>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>
              Drag jobs from the left into container slots · Click a container to manage
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            onClick={() => setNewVesselModal(true)}
            className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-semibold text-white"
            style={{ background: "#6366f1" }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Add Vessel
          </motion.button>
        </div>

        {/* Vessel grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {vessels.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center rounded-2xl py-24 text-center"
              style={{ background: "var(--surface)", border: "2px dashed var(--border)" }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: "#f5f3ff" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2" />
                  <path d="M7 20V12a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v8" />
                  <path d="M12 12V8M8 8h8M5 12H2l2-7h14l2 7h-3" />
                </svg>
              </div>
              <p className="text-sm font-bold" style={{ color: "var(--text-2)" }}>No vessels yet</p>
              <p className="text-xs mt-1 mb-5" style={{ color: "var(--text-3)" }}>Create your first vessel to start allocating containers</p>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                onClick={() => setNewVesselModal(true)}
                className="flex items-center gap-1.5 h-9 px-5 rounded-xl text-sm font-semibold text-white"
                style={{ background: "#6366f1" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Add First Vessel
              </motion.button>
            </motion.div>
          ) : (
            <motion.div layout className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))" }}>
              {vesselsSorted.map((vessel, i) => (
                <VesselBay
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
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {newVesselModal && (
          <NewVesselModal key="vessel-modal" onClose={() => setNewVesselModal(false)} onCreate={handleCreateVessel} />
        )}
        {newCtrModal && (
          <NewContainerModal
            key="ctr-modal"
            vesselName={vessels.find((v) => v.id === newCtrModal.vesselId)?.name ?? "vessel"}
            onClose={() => setNewCtrModal(null)}
            onCreate={(num, type) => handleCreateContainer(newCtrModal.vesselId, num, type)}
          />
        )}
        {detailModal && (
          <ContainerDetailPanel
            key="detail-modal"
            container={detailModal.container}
            allJobs={jobs}
            unassignedJobs={unassignedJobs}
            onClose={() => setDetailModal(null)}
            onRemoveJob={handleRemoveJob}
            onAddJob={(jobId) => { handleAddJob(jobId, detailModal.container.id); setDetailModal(null); }}
          />
        )}
      </AnimatePresence>

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg z-50"
            style={{ background: "#1e293b", color: "white", fontSize: 13, fontWeight: 500, pointerEvents: "none" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

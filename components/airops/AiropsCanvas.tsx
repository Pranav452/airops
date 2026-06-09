"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useAiropsJobs,
  useAiropsContainers,
  useAiropsVessels,
  useUpdateJob,
  useUpdateContainer,
  useUpdateVessel,
  useCreateContainer,
  useCreateVessel,
} from "@/lib/queries/airops";
import type { AiropsJob, AiropsContainer, AiropsVessel } from "@/lib/types/airops";

// ─── Constants ─────────────────────────────────────────────────────────────────

const JOB_W = 200;
const JOB_H = 82;
const CTR_W = 220;
const CTR_H = 96;
const VSL_W = 250;
const VSL_H = 112;

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3;

const COL_JOB = 80;
const COL_CTR = 380;
const COL_VSL = 720;
const ROW_GAP_JOB = 110;
const ROW_GAP_CTR = 130;
const ROW_GAP_VSL = 150;
const ROW_START = 80;

// ─── Types ─────────────────────────────────────────────────────────────────────

type NodeKind = "job" | "container" | "vessel";

type DragMode =
  | { kind: "pan"; startX: number; startY: number; startPanX: number; startPanY: number }
  | { kind: "node"; id: string; nodeKind: NodeKind; offsetX: number; offsetY: number }
  | {
      kind: "connect";
      fromId: string;
      fromKind: NodeKind;
      curX: number;
      curY: number;
      fromX: number;
      fromY: number;
    };

interface NodePos {
  x: number;
  y: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
  } catch {
    return iso;
  }
}

/** Cubic bezier SVG path between two points with vertical control handles */
function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dy = Math.abs(y2 - y1);
  const cp = Math.max(60, dy * 0.5);
  return `M${x1},${y1} C${x1},${y1 + cp} ${x2},${y2 - cp} ${x2},${y2}`;
}

// ─── Auto-layout calculator ───────────────────────────────────────────────────

function computeInitialLayout(
  jobs: AiropsJob[],
  containers: AiropsContainer[],
  vessels: AiropsVessel[]
): Record<string, NodePos> {
  const pos: Record<string, NodePos> = {};

  // Vessels: use saved canvas_x/y or lay out in a column
  vessels.forEach((v, i) => {
    pos[v.id] = {
      x: v.canvas_x > 0 ? v.canvas_x : COL_VSL,
      y: v.canvas_y > 0 ? v.canvas_y : ROW_START + i * ROW_GAP_VSL,
    };
  });

  // Containers: group under their vessel, else in unassigned column
  const vesselContainers: Record<string, AiropsContainer[]> = {};
  const unassignedCtrs: AiropsContainer[] = [];
  for (const ctr of containers) {
    if (ctr.vessel_id && pos[ctr.vessel_id]) {
      vesselContainers[ctr.vessel_id] = vesselContainers[ctr.vessel_id] ?? [];
      vesselContainers[ctr.vessel_id].push(ctr);
    } else {
      unassignedCtrs.push(ctr);
    }
  }

  for (const vslId of Object.keys(vesselContainers)) {
    const vPos = pos[vslId];
    const ctrs = vesselContainers[vslId];
    const totalH = ctrs.length * ROW_GAP_CTR;
    const startY = vPos.y + VSL_H / 2 - totalH / 2 + ROW_GAP_CTR / 2;
    ctrs.forEach((ctr, i) => {
      pos[ctr.id] = {
        x: ctr.canvas_x > 0 ? ctr.canvas_x : COL_CTR,
        y: ctr.canvas_y > 0 ? ctr.canvas_y : startY + i * ROW_GAP_CTR,
      };
    });
  }
  unassignedCtrs.forEach((ctr, i) => {
    pos[ctr.id] = {
      x: ctr.canvas_x > 0 ? ctr.canvas_x : COL_CTR,
      y: ctr.canvas_y > 0 ? ctr.canvas_y : ROW_START + i * ROW_GAP_CTR,
    };
  });

  // Jobs: group under their container, else unassigned column
  const ctrJobs: Record<string, AiropsJob[]> = {};
  const unassignedJobs: AiropsJob[] = [];
  for (const job of jobs) {
    if (job.container_id && pos[job.container_id]) {
      ctrJobs[job.container_id] = ctrJobs[job.container_id] ?? [];
      ctrJobs[job.container_id].push(job);
    } else {
      unassignedJobs.push(job);
    }
  }

  for (const ctrId of Object.keys(ctrJobs)) {
    const cPos = pos[ctrId];
    const jbs = ctrJobs[ctrId];
    const totalH = jbs.length * ROW_GAP_JOB;
    const startY = cPos.y + CTR_H / 2 - totalH / 2 + ROW_GAP_JOB / 2;
    jbs.forEach((job, i) => {
      pos[job.id] = {
        x: job.canvas_x > 0 ? job.canvas_x : COL_JOB,
        y: job.canvas_y > 0 ? job.canvas_y : startY + i * ROW_GAP_JOB,
      };
    });
  }
  unassignedJobs.forEach((job, i) => {
    pos[job.id] = {
      x: job.canvas_x > 0 ? job.canvas_x : COL_JOB,
      y: job.canvas_y > 0 ? job.canvas_y : ROW_START + i * ROW_GAP_JOB,
    };
  });

  return pos;
}

// ─── Icon components ──────────────────────────────────────────────────────────

function ShipIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h20" />
      <path d="M5 20l-1-7h16l-1 7" />
      <path d="M8 13V7h8v6" />
      <path d="M12 7V3" />
      <path d="M10 3h4" />
    </svg>
  );
}

function BoxIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function FileIcon({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function PlusIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 1v10M1 6h10" />
    </svg>
  );
}

// ─── Connection Port ──────────────────────────────────────────────────────────

function Port({
  role,
  onPointerDown,
  highlighted,
}: {
  role: "source" | "target";
  onPointerDown: (e: React.PointerEvent) => void;
  highlighted?: boolean;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: highlighted ? "#22c55e" : "#6366f1",
        border: "2px solid white",
        boxShadow: highlighted ? "0 0 0 3px #bbf7d0" : "0 0 0 2px #6366f1",
        cursor: "crosshair",
        flexShrink: 0,
        transition: "background 0.15s, box-shadow 0.15s",
      }}
    />
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({
  kind,
  onClose,
  onCreate,
}: {
  kind: "container" | "vessel";
  onClose: () => void;
  onCreate: (values: Record<string, string>) => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>({});

  const fields: { key: string; label: string; placeholder?: string; type?: string }[] =
    kind === "container"
      ? [
          { key: "container_number", label: "Container No", placeholder: "e.g. MSCU1234567" },
          { key: "container_type", label: "Type", placeholder: "e.g. 20GP" },
        ]
      : [
          { key: "name", label: "Vessel Name", placeholder: "e.g. MSC OSCAR" },
          { key: "pol", label: "POL", placeholder: "e.g. FRLEH" },
          { key: "pod", label: "POD", placeholder: "e.g. INMAA" },
          { key: "etd", label: "ETD", type: "date" },
        ];

  const titles = { container: "New Container", vessel: "New Vessel" };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onCreate(vals);
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onPointerDown={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="w-80 rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>
            {titles[kind]}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ background: "var(--surface-2)", color: "var(--text-3)" }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {fields.map((f, i) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-2)" }}>
                {f.label}
              </label>
              <input
                type={f.type ?? "text"}
                placeholder={f.placeholder}
                value={vals[f.key] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm rounded-lg outline-none focus:ring-2"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
                autoFocus={i === 0}
              />
            </div>
          ))}
          <button
            type="submit"
            className="mt-2 w-full py-2 rounded-xl text-sm font-semibold text-white shadow-sm"
            style={{ background: "#6366f1" }}
          >
            Create
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Node sub-components ──────────────────────────────────────────────────────

function JobNodeCard({
  job,
  pos,
  isDragging,
  isGlowing,
  isConnectTarget,
  onGripDown,
  onPortDown,
  onContextMenu,
}: {
  job: AiropsJob;
  pos: NodePos;
  isDragging: boolean;
  isGlowing: boolean;
  isConnectTarget: boolean;
  onGripDown: (e: React.PointerEvent) => void;
  onPortDown: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const statusColor = job.status?.color_hex ?? "#6366f1";
  const isAssigned = !!job.container_id;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{
        scale: isGlowing ? 1.04 : 1,
        opacity: 1,
        boxShadow: isGlowing
          ? "0 0 0 3px #bbf7d0, 0 8px 24px rgba(0,0,0,0.14)"
          : isConnectTarget
          ? "0 0 0 3px #a5f3fc, 0 8px 24px rgba(0,0,0,0.12)"
          : isDragging
          ? "0 16px 40px rgba(0,0,0,0.2)"
          : "0 2px 8px rgba(0,0,0,0.07)",
      }}
      whileHover={{ scale: isDragging ? 1.02 : 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      onContextMenu={onContextMenu}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: JOB_W,
        height: JOB_H,
        background: "var(--surface)",
        border: isGlowing
          ? "2px solid #22c55e"
          : isConnectTarget
          ? "2px solid #06b6d4"
          : "1.5px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        cursor: "default",
        zIndex: isDragging ? 100 : 3,
        userSelect: "none",
      }}
    >
      {/* Status accent bar */}
      <div style={{ height: 3, background: statusColor, flexShrink: 0 }} />

      <div className="flex flex-col justify-between px-3 py-2" style={{ height: JOB_H - 3 }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileIcon size={13} color={statusColor} />
            <span className="font-semibold truncate" style={{ fontSize: 12.5, color: "var(--text)" }}>
              {job.data.order_no ?? "(no order no)"}
            </span>
          </div>
          {/* Drag grip */}
          <div
            onPointerDown={onGripDown}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded cursor-grab active:cursor-grabbing"
            style={{ color: "var(--text-3)" }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              {[0, 4, 8].map((cx) =>
                [2, 6, 10].map((cy) => (
                  <circle key={`${cx}-${cy}`} cx={cy} cy={cx + 2} r="1.2" fill="currentColor" />
                ))
              )}
            </svg>
          </div>
        </div>

        {/* Consignee */}
        {job.data.consignee_name && (
          <span className="truncate text-xs" style={{ color: "var(--text-2)" }}>
            {job.data.consignee_name}
          </span>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            {job.data.volume != null && (
              <span
                className="px-1.5 py-0.5 rounded text-xs"
                style={{ background: "var(--surface-2)", color: "var(--text-3)", fontSize: 10.5 }}
              >
                {job.data.volume} cbm
              </span>
            )}
            {!isAssigned && (
              <span
                className="px-1.5 py-0.5 rounded text-xs"
                style={{ background: "#fef3c7", color: "#92400e", fontSize: 10.5 }}
              >
                Unassigned
              </span>
            )}
          </div>
          {/* Connection port (source for job→container) */}
          <Port role="source" onPointerDown={onPortDown} highlighted={isGlowing} />
        </div>
      </div>
    </motion.div>
  );
}

function ContainerNodeCard({
  ctr,
  pos,
  isDragging,
  isJobDropTarget,
  isConnectTarget,
  jobCount,
  onGripDown,
  onPortDown,
  onContextMenu,
}: {
  ctr: AiropsContainer;
  pos: NodePos;
  isDragging: boolean;
  isJobDropTarget: boolean;
  isConnectTarget: boolean;
  jobCount: number;
  onGripDown: (e: React.PointerEvent) => void;
  onPortDown: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{
        scale: isJobDropTarget ? 1.05 : 1,
        opacity: 1,
        boxShadow: isJobDropTarget
          ? "0 0 0 4px #86efac, 0 8px 24px rgba(0,0,0,0.14)"
          : isConnectTarget
          ? "0 0 0 3px #a5f3fc, 0 8px 24px rgba(0,0,0,0.12)"
          : isDragging
          ? "0 16px 40px rgba(0,0,0,0.2)"
          : "0 2px 8px rgba(0,0,0,0.07)",
      }}
      whileHover={{ scale: isDragging ? 1.02 : 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      onContextMenu={onContextMenu}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: CTR_W,
        height: CTR_H,
        background: isJobDropTarget ? "#f0fdf4" : "#eff6ff",
        border: isJobDropTarget
          ? "2px solid #22c55e"
          : isConnectTarget
          ? "2px solid #06b6d4"
          : "1.5px solid #93c5fd",
        borderRadius: 12,
        overflow: "hidden",
        cursor: "default",
        zIndex: isDragging ? 100 : 2,
        userSelect: "none",
      }}
    >
      {/* Blue accent bar */}
      <div style={{ height: 3, background: isJobDropTarget ? "#22c55e" : "#3b82f6" }} />

      <div className="flex flex-col justify-between px-3 py-2" style={{ height: CTR_H - 3 }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BoxIcon size={14} color="#3b82f6" />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold truncate" style={{ fontSize: 12.5, color: "#1e40af" }}>
                {ctr.container_number ?? "(no number)"}
              </span>
              {ctr.container_type && (
                <span style={{ fontSize: 10.5, color: "#60a5fa" }}>{ctr.container_type}</span>
              )}
            </div>
          </div>
          <div
            onPointerDown={onGripDown}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded cursor-grab active:cursor-grabbing"
            style={{ color: "#93c5fd" }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              {[0, 4, 8].map((cx) =>
                [2, 6, 10].map((cy) => (
                  <circle key={`${cx}-${cy}`} cx={cy} cy={cx + 2} r="1.2" fill="currentColor" />
                ))
              )}
            </svg>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span style={{ fontSize: 11, color: "#60a5fa" }}>
            {jobCount} {jobCount === 1 ? "job" : "jobs"}
          </span>
          <div className="flex items-center gap-2">
            {!ctr.vessel_id && (
              <span style={{ fontSize: 10.5, color: "#3b82f6", background: "#dbeafe", borderRadius: 4, padding: "1px 6px" }}>
                No vessel
              </span>
            )}
            <Port role="source" onPointerDown={onPortDown} highlighted={isJobDropTarget} />
          </div>
        </div>
      </div>

      {/* Drop hint overlay */}
      <AnimatePresence>
        {isJobDropTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 10, background: "rgba(240,253,244,0.7)" }}
          >
            <span className="px-2 py-1 rounded-lg text-xs font-bold text-white" style={{ background: "#16a34a" }}>
              Drop to assign
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function VesselNodeCard({
  vessel,
  pos,
  isDragging,
  isCtrDropTarget,
  isConnectTarget,
  containerCount,
  onGripDown,
  onContextMenu,
}: {
  vessel: AiropsVessel;
  pos: NodePos;
  isDragging: boolean;
  isCtrDropTarget: boolean;
  isConnectTarget: boolean;
  containerCount: number;
  onGripDown: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{
        scale: isCtrDropTarget ? 1.05 : 1,
        opacity: 1,
        boxShadow: isCtrDropTarget
          ? "0 0 0 4px #fde68a, 0 8px 24px rgba(0,0,0,0.14)"
          : isConnectTarget
          ? "0 0 0 3px #a5f3fc, 0 8px 24px rgba(0,0,0,0.12)"
          : isDragging
          ? "0 16px 40px rgba(0,0,0,0.2)"
          : "0 2px 8px rgba(0,0,0,0.07)",
      }}
      whileHover={{ scale: isDragging ? 1.02 : 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      onContextMenu={onContextMenu}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: VSL_W,
        height: VSL_H,
        background: isCtrDropTarget ? "#fefce8" : "#f5f3ff",
        border: isCtrDropTarget
          ? "2px solid #eab308"
          : isConnectTarget
          ? "2px solid #06b6d4"
          : "1.5px solid #c4b5fd",
        borderRadius: 14,
        overflow: "hidden",
        cursor: "default",
        zIndex: isDragging ? 100 : 1,
        userSelect: "none",
      }}
    >
      {/* Purple accent bar */}
      <div style={{ height: 3, background: isCtrDropTarget ? "#eab308" : "#8b5cf6" }} />

      <div className="flex flex-col justify-between px-3 py-2.5" style={{ height: VSL_H - 3 }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShipIcon size={16} color="#7c3aed" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold truncate" style={{ fontSize: 13, color: "#4c1d95" }}>
                {vessel.name}
              </span>
              <div className="flex gap-2 flex-wrap">
                {vessel.pol && (
                  <span style={{ fontSize: 10.5, color: "#7c3aed" }}>{vessel.pol}</span>
                )}
                {vessel.pod && (
                  <span style={{ fontSize: 10.5, color: "#7c3aed" }}>→ {vessel.pod}</span>
                )}
              </div>
            </div>
          </div>
          <div
            onPointerDown={onGripDown}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded cursor-grab active:cursor-grabbing"
            style={{ color: "#c4b5fd" }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              {[0, 4, 8].map((cx) =>
                [2, 6, 10].map((cy) => (
                  <circle key={`${cx}-${cy}`} cx={cy} cy={cx + 2} r="1.2" fill="currentColor" />
                ))
              )}
            </svg>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex gap-3">
            {vessel.etd && (
              <span style={{ fontSize: 11, color: "#a78bfa" }}>
                ETD {fmtDate(vessel.etd)}
              </span>
            )}
            {vessel.eta && (
              <span style={{ fontSize: 11, color: "#a78bfa" }}>
                ETA {fmtDate(vessel.eta)}
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: "#a78bfa" }}>
            {containerCount} ctr{containerCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {isCtrDropTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 10, background: "rgba(254,252,232,0.7)" }}
          >
            <span className="px-2 py-1 rounded-lg text-xs font-bold text-white" style={{ background: "#d97706" }}>
              Assign container
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AiropsCanvas() {
  // ── Data hooks ────────────────────────────────────────────────────────────────
  const { data: jobs = [] } = useAiropsJobs();
  const { data: containers = [] } = useAiropsContainers();
  const { data: vessels = [] } = useAiropsVessels();

  const updateJob = useUpdateJob();
  const updateContainer = useUpdateContainer();
  const updateVessel = useUpdateVessel();
  const createContainer = useCreateContainer();
  const createVessel = useCreateVessel();

  // ── Canvas transform state ────────────────────────────────────────────────────
  const stageRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // ── Drag state ────────────────────────────────────────────────────────────────
  const dragRef = useRef<DragMode | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [ghostEdge, setGhostEdge] = useState<{ fx: number; fy: number; tx: number; ty: number } | null>(null);

  // ── Drop target state ─────────────────────────────────────────────────────────
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // ── Optimistic positions ──────────────────────────────────────────────────────
  const [optPos, setOptPos] = useState<Record<string, NodePos>>({});

  // ── UI state ──────────────────────────────────────────────────────────────────
  const [createModal, setCreateModal] = useState<"container" | "vessel" | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: string; kind: NodeKind } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Initial layout (computed once per data identity) ──────────────────────────
  const layoutRef = useRef<Record<string, NodePos>>({});
  const prevDataRef = useRef({ jLen: -1, cLen: -1, vLen: -1 });

  if (
    jobs.length !== prevDataRef.current.jLen ||
    containers.length !== prevDataRef.current.cLen ||
    vessels.length !== prevDataRef.current.vLen
  ) {
    prevDataRef.current = { jLen: jobs.length, cLen: containers.length, vLen: vessels.length };
    const newLayout = computeInitialLayout(jobs, containers, vessels);
    // Merge: keep opt positions for existing nodes, add new ones
    const merged: Record<string, NodePos> = { ...newLayout };
    for (const id of Object.keys(optPos)) {
      if (merged[id]) merged[id] = optPos[id];
    }
    layoutRef.current = newLayout;
  }

  // ─── Node position getter ──────────────────────────────────────────────────────
  function getPos(id: string): NodePos {
    return optPos[id] ?? layoutRef.current[id] ?? { x: 100, y: 100 };
  }

  // ─── Screen → Canvas conversion ───────────────────────────────────────────────
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number): NodePos => {
      const rect = stageRef.current!.getBoundingClientRect();
      return {
        x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
        y: (clientY - rect.top - panRef.current.y) / zoomRef.current,
      };
    },
    []
  );

  // ─── Node center in canvas coords (for port positions) ────────────────────────
  function nodePortOut(id: string, kind: NodeKind): NodePos {
    const p = getPos(id);
    const w = kind === "job" ? JOB_W : kind === "container" ? CTR_W : VSL_W;
    const h = kind === "job" ? JOB_H : kind === "container" ? CTR_H : VSL_H;
    return { x: p.x + w - 14, y: p.y + h - 14 }; // bottom-right port area
  }

  function nodePortIn(id: string, kind: NodeKind): NodePos {
    const p = getPos(id);
    const w = kind === "job" ? JOB_W : kind === "container" ? CTR_W : VSL_W;
    return { x: p.x + w / 2, y: p.y }; // top-center
  }

  // ─── Hit tests ────────────────────────────────────────────────────────────────
  function hitContainer(cx: number, cy: number): AiropsContainer | null {
    for (const ctr of containers) {
      const p = getPos(ctr.id);
      if (cx >= p.x && cx <= p.x + CTR_W && cy >= p.y && cy <= p.y + CTR_H) return ctr;
    }
    return null;
  }

  function hitVessel(cx: number, cy: number): AiropsVessel | null {
    for (const v of vessels) {
      const p = getPos(v.id);
      if (cx >= p.x && cx <= p.x + VSL_W && cy >= p.y && cy <= p.y + VSL_H) return v;
    }
    return null;
  }

  // ─── Toast ─────────────────────────────────────────────────────────────────────
  function showToast(msg: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  }

  // ─── Zoom helpers ──────────────────────────────────────────────────────────────
  function setZoomAt(newZoom: number, pivotX: number, pivotY: number) {
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
    const curZ = zoomRef.current;
    const curP = panRef.current;
    setPan({
      x: pivotX - ((pivotX - curP.x) / curZ) * clamped,
      y: pivotY - ((pivotY - curP.y) / curZ) * clamped,
    });
    setZoom(clamped);
  }

  function setZoomCentered(newZoom: number) {
    if (!stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    setZoomAt(newZoom, r.width / 2, r.height / 2);
  }

  function fitToView() {
    if (!stageRef.current) return;
    const allNodes = [
      ...jobs.map((j) => ({ ...getPos(j.id), w: JOB_W, h: JOB_H })),
      ...containers.map((c) => ({ ...getPos(c.id), w: CTR_W, h: CTR_H })),
      ...vessels.map((v) => ({ ...getPos(v.id), w: VSL_W, h: VSL_H })),
    ];
    if (!allNodes.length) return;
    const minX = Math.min(...allNodes.map((n) => n.x));
    const minY = Math.min(...allNodes.map((n) => n.y));
    const maxX = Math.max(...allNodes.map((n) => n.x + n.w));
    const maxY = Math.max(...allNodes.map((n) => n.y + n.h));
    const r = stageRef.current.getBoundingClientRect();
    const pad = 80;
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(
      (r.width - pad * 2) / (maxX - minX || 1),
      (r.height - pad * 2) / (maxY - minY || 1)
    )));
    setPan({ x: pad - minX * z, y: pad - minY * z });
    setZoom(z);
  }

  // ─── Wheel ─────────────────────────────────────────────────────────────────────
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const r = stageRef.current!.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    if (e.ctrlKey || e.metaKey) {
      setZoomAt(zoomRef.current * (1 - e.deltaY * 0.002), px, py);
    } else {
      setPan((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  }

  // ─── Pointer events (global via useEffect) ─────────────────────────────────────
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.kind === "pan") {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        setPan({ x: drag.startPanX + dx, y: drag.startPanY + dy });
        return;
      }

      if (drag.kind === "node") {
        const canvas = screenToCanvas(e.clientX, e.clientY);
        const newX = canvas.x - drag.offsetX;
        const newY = canvas.y - drag.offsetY;
        setOptPos((prev) => ({ ...prev, [drag.id]: { x: newX, y: newY } }));

        // Compute drop target during node drag
        const cx = newX;
        const cy = newY;
        if (drag.nodeKind === "job") {
          const ctr = hitContainer(cx + JOB_W / 2, cy + JOB_H / 2);
          setDropTargetId(ctr ? ctr.id : null);
        } else if (drag.nodeKind === "container") {
          const vsl = hitVessel(cx + CTR_W / 2, cy + CTR_H / 2);
          setDropTargetId(vsl ? vsl.id : null);
        } else {
          setDropTargetId(null);
        }
        return;
      }

      if (drag.kind === "connect") {
        const canvas = screenToCanvas(e.clientX, e.clientY);
        dragRef.current = { ...drag, curX: canvas.x, curY: canvas.y };
        setGhostEdge({ fx: drag.fromX, fy: drag.fromY, tx: canvas.x, ty: canvas.y });

        // Highlight valid drop targets for connect
        if (drag.fromKind === "job") {
          const ctr = hitContainer(canvas.x, canvas.y);
          setDropTargetId(ctr ? ctr.id : null);
        } else if (drag.fromKind === "container") {
          const vsl = hitVessel(canvas.x, canvas.y);
          setDropTargetId(vsl ? vsl.id : null);
        }
        return;
      }
    }

    function onUp(e: PointerEvent) {
      const drag = dragRef.current;
      dragRef.current = null;
      setDraggingId(null);
      setDropTargetId(null);

      if (!drag) return;

      if (drag.kind === "node") {
        const pos = optPos[drag.id] ?? layoutRef.current[drag.id];
        if (!pos) return;
        const snapped = { x: Math.round(pos.x), y: Math.round(pos.y) };

        if (drag.nodeKind === "job") {
          const job = jobs.find((j) => j.id === drag.id);
          if (!job) return;
          const ctr = hitContainer(snapped.x + JOB_W / 2, snapped.y + JOB_H / 2);
          if (ctr && ctr.id !== job.container_id) {
            updateJob.mutate(
              { id: drag.id, updates: { container_id: ctr.id, canvas_x: snapped.x, canvas_y: snapped.y } },
              { onSuccess: () => showToast(`Job assigned to ${ctr.container_number ?? "container"}`) }
            );
          } else {
            updateJob.mutate({ id: drag.id, updates: { canvas_x: snapped.x, canvas_y: snapped.y } });
          }
        } else if (drag.nodeKind === "container") {
          const ctr = containers.find((c) => c.id === drag.id);
          if (!ctr) return;
          const vsl = hitVessel(snapped.x + CTR_W / 2, snapped.y + CTR_H / 2);
          if (vsl && vsl.id !== ctr.vessel_id) {
            updateContainer.mutate(
              { id: drag.id, updates: { vessel_id: vsl.id, canvas_x: snapped.x, canvas_y: snapped.y } },
              { onSuccess: () => showToast(`Container assigned to ${vsl.name}`) }
            );
          } else {
            updateContainer.mutate({ id: drag.id, updates: { canvas_x: snapped.x, canvas_y: snapped.y } });
          }
        } else if (drag.nodeKind === "vessel") {
          updateVessel.mutate({ id: drag.id, updates: { canvas_x: Math.round(pos.x), canvas_y: Math.round(pos.y) } });
        }
      }

      if (drag.kind === "connect") {
        setGhostEdge(null);
        const canvas = screenToCanvas(e.clientX, e.clientY);

        if (drag.fromKind === "job") {
          const ctr = hitContainer(canvas.x, canvas.y);
          if (ctr) {
            updateJob.mutate(
              { id: drag.fromId, updates: { container_id: ctr.id } },
              { onSuccess: () => showToast(`Job connected to ${ctr.container_number ?? "container"}`) }
            );
          }
        } else if (drag.fromKind === "container") {
          const vsl = hitVessel(canvas.x, canvas.y);
          if (vsl) {
            updateContainer.mutate(
              { id: drag.fromId, updates: { vessel_id: vsl.id } },
              { onSuccess: () => showToast(`Container connected to ${vsl.name}`) }
            );
          }
        }
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, containers, vessels, screenToCanvas]);

  // ─── Stage pointer down (pan) ─────────────────────────────────────────────────
  function handleStagePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    dragRef.current = {
      kind: "pan",
      startX: e.clientX,
      startY: e.clientY,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y,
    };
  }

  // ─── Node grip pointer down ────────────────────────────────────────────────────
  function startNodeDrag(e: React.PointerEvent, id: string, nodeKind: NodeKind) {
    e.stopPropagation();
    e.preventDefault();
    const canvas = screenToCanvas(e.clientX, e.clientY);
    const pos = getPos(id);
    dragRef.current = {
      kind: "node",
      id,
      nodeKind,
      offsetX: canvas.x - pos.x,
      offsetY: canvas.y - pos.y,
    };
    setDraggingId(id);
  }

  // ─── Port pointer down (connect mode) ─────────────────────────────────────────
  function startConnect(e: React.PointerEvent, fromId: string, fromKind: NodeKind) {
    e.stopPropagation();
    e.preventDefault();
    const port = nodePortOut(fromId, fromKind);
    const canvas = screenToCanvas(e.clientX, e.clientY);
    dragRef.current = {
      kind: "connect",
      fromId,
      fromKind,
      fromX: port.x,
      fromY: port.y,
      curX: canvas.x,
      curY: canvas.y,
    };
  }

  // ─── Context menu ──────────────────────────────────────────────────────────────
  function handleCtxMenu(e: React.MouseEvent, nodeId: string, kind: NodeKind) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, nodeId, kind });
  }

  function handleCtxAction(action: string) {
    if (!ctxMenu) return;
    const { nodeId, kind } = ctxMenu;
    if (action === "detachContainer" && kind === "job") {
      updateJob.mutate(
        { id: nodeId, updates: { container_id: null } },
        { onSuccess: () => showToast("Job detached from container") }
      );
    } else if (action === "detachVessel" && kind === "container") {
      updateContainer.mutate(
        { id: nodeId, updates: { vessel_id: null } },
        { onSuccess: () => showToast("Container detached from vessel") }
      );
    }
    setCtxMenu(null);
  }

  // ─── Create handlers ───────────────────────────────────────────────────────────
  function handleCreate(kind: "container" | "vessel", vals: Record<string, string>) {
    const cx = (-panRef.current.x + 200) / zoomRef.current;
    const cy = (-panRef.current.y + 200) / zoomRef.current;
    if (kind === "container") {
      createContainer.mutate({
        container_number: vals.container_number || null,
        container_type: vals.container_type || null,
        canvas_x: cx,
        canvas_y: cy,
      });
    } else {
      createVessel.mutate({
        name: vals.name,
        pol: vals.pol || null,
        pod: vals.pod || null,
        etd: vals.etd || null,
        canvas_x: cx + 300,
        canvas_y: cy,
      } as Parameters<typeof createVessel.mutate>[0]);
    }
  }

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setCtxMenu(null);
        setCreateModal(null);
        dragRef.current = null;
        setGhostEdge(null);
        setDropTargetId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!ctxMenu) return;
    function handler() { setCtxMenu(null); }
    window.addEventListener("pointerdown", handler);
    return () => window.removeEventListener("pointerdown", handler);
  }, [ctxMenu]);

  // ─── Derived stats ──────────────────────────────────────────────────────────────
  const assignedJobs = jobs.filter((j) => j.container_id).length;
  const completionPct = jobs.length > 0 ? Math.round((assignedJobs / jobs.length) * 100) : 0;
  const unassignedJobCount = jobs.length - assignedJobs;
  const unassignedCtrCount = containers.filter((c) => !c.vessel_id).length;

  // ─── Edge data ──────────────────────────────────────────────────────────────────
  const jobEdges = jobs
    .filter((j) => j.container_id && containers.find((c) => c.id === j.container_id))
    .map((j) => {
      const jp = getPos(j.id);
      const cp = getPos(j.container_id!);
      return {
        key: `je-${j.id}`,
        x1: jp.x + JOB_W - 12,
        y1: jp.y + JOB_H - 12,
        x2: cp.x + CTR_W / 2,
        y2: cp.y,
      };
    });

  const ctrEdges = containers
    .filter((c) => c.vessel_id && vessels.find((v) => v.id === c.vessel_id))
    .map((c) => {
      const cp = getPos(c.id);
      const vp = getPos(c.vessel_id!);
      return {
        key: `ce-${c.id}`,
        x1: cp.x + CTR_W - 12,
        y1: cp.y + CTR_H - 12,
        x2: vp.x + VSL_W / 2,
        y2: vp.y,
      };
    });

  // ─── Which nodes are valid connect targets ────────────────────────────────────
  const connectingFrom = dragRef.current?.kind === "connect" ? dragRef.current : null;
  const isValidConnectTarget = (id: string, kind: NodeKind): boolean => {
    if (!connectingFrom) return false;
    if (connectingFrom.fromKind === "job" && kind === "container") return true;
    if (connectingFrom.fromKind === "container" && kind === "vessel") return true;
    return false;
  };

  // ─── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col" style={{ height: "100%", overflow: "hidden", background: "var(--background)" }}>
      {/* ── Toolbar ─────────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-4 py-2 shrink-0"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", zIndex: 20 }}
      >
        {/* Title */}
        <div className="flex items-center gap-2 mr-2">
          <ShipIcon size={16} color="#6366f1" />
          <div className="flex flex-col">
            <span className="font-bold text-sm leading-none" style={{ color: "var(--text)" }}>
              Allocation Graph
            </span>
            <span className="text-xs" style={{ color: "var(--text-3)" }}>
              Job → Container → Vessel
            </span>
          </div>
        </div>

        <div style={{ width: 1, height: 28, background: "var(--border)" }} />

        {/* Add buttons */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #93c5fd" }}
          onClick={() => setCreateModal("container")}
        >
          <PlusIcon /> Container
        </button>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: "#f5f3ff", color: "#6d28d9", border: "1px solid #c4b5fd" }}
          onClick={() => setCreateModal("vessel")}
        >
          <PlusIcon /> Vessel
        </button>

        <div style={{ width: 1, height: 28, background: "var(--border)" }} />

        {/* Stats pills */}
        <div className="flex items-center gap-2">
          {[
            { label: `${jobs.length} jobs`, bg: "#eef2ff", color: "#4f46e5" },
            { label: `${containers.length} ctrs`, bg: "#eff6ff", color: "#1d4ed8" },
            { label: `${vessels.length} vessels`, bg: "#f5f3ff", color: "#6d28d9" },
            ...(unassignedJobCount > 0
              ? [{ label: `${unassignedJobCount} unassigned`, bg: "#fef3c7", color: "#92400e" }]
              : []),
          ].map((s) => (
            <span
              key={s.label}
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: s.bg, color: s.color }}
            >
              {s.label}
            </span>
          ))}
        </div>

        <div className="flex-1" />

        {/* Completion bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            {completionPct}% assigned
          </span>
          <div
            className="rounded-full overflow-hidden"
            style={{ width: 80, height: 5, background: "var(--border)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${completionPct}%`, background: "#10b981" }}
            />
          </div>
        </div>

        <div style={{ width: 1, height: 28, background: "var(--border)" }} />

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}
            onClick={() => setZoomCentered(Math.max(ZOOM_MIN, zoomRef.current - 0.15))}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 6h10" />
            </svg>
          </button>
          <span
            className="tabular-nums text-xs font-medium"
            style={{ minWidth: 38, textAlign: "center", color: "var(--text-2)" }}
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}
            onClick={() => setZoomCentered(Math.min(ZOOM_MAX, zoomRef.current + 0.15))}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 1v10M1 6h10" />
            </svg>
          </button>
          <button
            className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-medium ml-1"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}
            onClick={fitToView}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" />
            </svg>
            Fit
          </button>
        </div>
      </div>

      {/* ── Canvas stage ──────────────────────────────────────────────────────────── */}
      <div
        ref={stageRef}
        className="relative flex-1 overflow-hidden"
        style={{
          cursor: dragRef.current?.kind === "pan" ? "grabbing" : dragRef.current?.kind === "connect" ? "crosshair" : "default",
          backgroundImage: `radial-gradient(circle, rgba(99,102,241,0.15) 1px, transparent 1.5px)`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
        onPointerDown={handleStagePointerDown}
        onWheel={handleWheel}
      >
        {/* ── World transform root ──────────────────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: 0,
            height: 0,
          }}
        >
          {/* ── SVG edges layer ─────────────────────────────────────────────────── */}
          <svg
            style={{ position: "absolute", overflow: "visible", pointerEvents: "none", zIndex: 0 }}
            width={0}
            height={0}
          >
            <defs>
              <marker id="arrow-blue" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                <path d="M0,0 L0,7 L7,3.5 z" fill="#3b82f6" opacity="0.7" />
              </marker>
              <marker id="arrow-purple" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                <path d="M0,0 L0,7 L7,3.5 z" fill="#8b5cf6" opacity="0.8" />
              </marker>
            </defs>

            {/* Job → Container edges */}
            {jobEdges.map((e) => (
              <path
                key={e.key}
                d={bezierPath(e.x1, e.y1, e.x2, e.y2)}
                stroke="#3b82f6"
                strokeWidth={1.8}
                strokeDasharray="6,4"
                fill="none"
                opacity={0.65}
                markerEnd="url(#arrow-blue)"
              />
            ))}

            {/* Container → Vessel edges */}
            {ctrEdges.map((e) => (
              <path
                key={e.key}
                d={bezierPath(e.x1, e.y1, e.x2, e.y2)}
                stroke="#8b5cf6"
                strokeWidth={2.2}
                fill="none"
                opacity={0.7}
                markerEnd="url(#arrow-purple)"
              />
            ))}

            {/* Ghost connect edge */}
            {ghostEdge && (
              <path
                d={bezierPath(ghostEdge.fx, ghostEdge.fy, ghostEdge.tx, ghostEdge.ty)}
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="8,5"
                fill="none"
                opacity={0.85}
              />
            )}
          </svg>

          {/* ── Column labels ─────────────────────────────────────────────────── */}
          {vessels.length > 0 && (
            <>
              <div
                style={{
                  position: "absolute",
                  left: COL_JOB,
                  top: 20,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#6366f1",
                  textTransform: "uppercase",
                  opacity: 0.7,
                }}
              >
                Jobs
              </div>
              <div
                style={{
                  position: "absolute",
                  left: COL_CTR,
                  top: 20,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#3b82f6",
                  textTransform: "uppercase",
                  opacity: 0.7,
                }}
              >
                Containers
              </div>
              <div
                style={{
                  position: "absolute",
                  left: COL_VSL,
                  top: 20,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#8b5cf6",
                  textTransform: "uppercase",
                  opacity: 0.7,
                }}
              >
                Vessels
              </div>
            </>
          )}

          {/* ── Vessel nodes ────────────────────────────────────────────────────── */}
          {vessels.map((vessel) => {
            const pos = getPos(vessel.id);
            const ctrCount = containers.filter((c) => c.vessel_id === vessel.id).length;
            return (
              <div key={vessel.id} data-node="true" style={{ position: "absolute", zIndex: 1 }}>
                <VesselNodeCard
                  vessel={vessel}
                  pos={pos}
                  isDragging={draggingId === vessel.id}
                  isCtrDropTarget={dropTargetId === vessel.id}
                  isConnectTarget={isValidConnectTarget(vessel.id, "vessel")}
                  containerCount={ctrCount}
                  onGripDown={(e) => startNodeDrag(e, vessel.id, "vessel")}
                  onContextMenu={(e) => handleCtxMenu(e, vessel.id, "vessel")}
                />
              </div>
            );
          })}

          {/* ── Container nodes ─────────────────────────────────────────────────── */}
          {containers.map((ctr) => {
            const pos = getPos(ctr.id);
            const jobCount = jobs.filter((j) => j.container_id === ctr.id).length;
            const isJobDrop = dropTargetId === ctr.id && dragRef.current?.kind === "node" && (dragRef.current as Extract<DragMode, { kind: "node" }>).nodeKind === "job";
            const isConnDrop = dropTargetId === ctr.id && dragRef.current?.kind === "connect";
            return (
              <div key={ctr.id} data-node="true" style={{ position: "absolute", zIndex: 2 }}>
                <ContainerNodeCard
                  ctr={ctr}
                  pos={pos}
                  isDragging={draggingId === ctr.id}
                  isJobDropTarget={isJobDrop || isConnDrop}
                  isConnectTarget={isValidConnectTarget(ctr.id, "container")}
                  jobCount={jobCount}
                  onGripDown={(e) => startNodeDrag(e, ctr.id, "container")}
                  onPortDown={(e) => startConnect(e, ctr.id, "container")}
                  onContextMenu={(e) => handleCtxMenu(e, ctr.id, "container")}
                />
              </div>
            );
          })}

          {/* ── Job nodes ───────────────────────────────────────────────────────── */}
          {jobs.map((job) => {
            const pos = getPos(job.id);
            return (
              <div key={job.id} data-node="true" style={{ position: "absolute", zIndex: 3 }}>
                <JobNodeCard
                  job={job}
                  pos={pos}
                  isDragging={draggingId === job.id}
                  isGlowing={dropTargetId !== null && dragRef.current?.kind === "node" && (dragRef.current as Extract<DragMode, { kind: "node" }>).id === job.id && (dragRef.current as Extract<DragMode, { kind: "node" }>).nodeKind === "job"}
                  isConnectTarget={false}
                  onGripDown={(e) => startNodeDrag(e, job.id, "job")}
                  onPortDown={(e) => startConnect(e, job.id, "job")}
                  onContextMenu={(e) => handleCtxMenu(e, job.id, "job")}
                />
              </div>
            );
          })}
        </div>

        {/* ── Empty state ──────────────────────────────────────────────────────────── */}
        {vessels.length === 0 && containers.length === 0 && jobs.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-3 text-center">
              <ShipIcon size={40} color="#c4b5fd" />
              <div>
                <p className="font-semibold" style={{ color: "var(--text-2)" }}>No vessels yet</p>
                <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>
                  Add a vessel to get started, then attach containers and jobs.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Legend (bottom-left) ─────────────────────────────────────────────────── */}
        <div
          className="absolute bottom-4 left-4 flex items-center gap-4 px-3 py-2 rounded-xl select-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", pointerEvents: "none", zIndex: 10 }}
        >
          <span className="text-xs font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.06em" }}>
            LEGEND
          </span>
          <div className="flex items-center gap-1.5">
            <svg width="24" height="8" viewBox="0 0 24 8">
              <path d="M0,4 C6,4 18,4 24,4" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="5,3" fill="none" />
            </svg>
            <span className="text-xs" style={{ color: "var(--text-3)" }}>Job→Container</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="24" height="8" viewBox="0 0 24 8">
              <path d="M0,4 L24,4" stroke="#8b5cf6" strokeWidth="2" fill="none" />
            </svg>
            <span className="text-xs" style={{ color: "var(--text-3)" }}>Container→Vessel</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", border: "1.5px solid white", boxShadow: "0 0 0 1.5px #6366f1" }} />
            <span className="text-xs" style={{ color: "var(--text-3)" }}>Port = drag to connect</span>
          </div>
        </div>

        {/* ── Unassigned counter badge (top-right of canvas) ──────────────────────── */}
        {unassignedCtrCount > 0 && (
          <div
            className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-medium pointer-events-none"
            style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", zIndex: 10 }}
          >
            {unassignedCtrCount} container{unassignedCtrCount !== 1 ? "s" : ""} without vessel
          </div>
        )}
      </div>

      {/* ── Context menu ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {ctxMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.1 }}
            className="fixed z-50 rounded-xl shadow-xl py-1.5 min-w-[168px]"
            style={{
              left: ctxMenu.x,
              top: ctxMenu.y,
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {ctxMenu.kind === "job" && (() => {
              const job = jobs.find((j) => j.id === ctxMenu.nodeId);
              return job?.container_id ? (
                <button
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2"
                  style={{ color: "#b91c1c" }}
                  onClick={() => handleCtxAction("detachContainer")}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M1 1l10 10M11 1L1 11" />
                  </svg>
                  Detach from container
                </button>
              ) : (
                <div className="px-3 py-1.5 text-xs" style={{ color: "var(--text-3)" }}>Not in a container</div>
              );
            })()}
            {ctxMenu.kind === "container" && (() => {
              const ctr = containers.find((c) => c.id === ctxMenu.nodeId);
              return ctr?.vessel_id ? (
                <button
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2"
                  style={{ color: "#b91c1c" }}
                  onClick={() => handleCtxAction("detachVessel")}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M1 1l10 10M11 1L1 11" />
                  </svg>
                  Detach from vessel
                </button>
              ) : (
                <div className="px-3 py-1.5 text-xs" style={{ color: "var(--text-3)" }}>No vessel assigned</div>
              );
            })()}
            {ctxMenu.kind === "vessel" && (
              <div className="px-3 py-1.5 text-xs" style={{ color: "var(--text-3)" }}>No actions</div>
            )}
            <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
            <button
              className="w-full px-3 py-1.5 text-left text-xs"
              style={{ color: "var(--text-2)" }}
              onClick={() => setCtxMenu(null)}
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create modal ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {createModal && (
          <CreateModal
            kind={createModal}
            onClose={() => setCreateModal(null)}
            onCreate={(vals) => handleCreate(createModal, vals)}
          />
        )}
      </AnimatePresence>

      {/* ── Toast ───────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl z-50 pointer-events-none"
            style={{ background: "#1e293b", color: "white", fontSize: 13, fontWeight: 500 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

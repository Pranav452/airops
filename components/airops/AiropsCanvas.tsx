"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  useAiropsJobs,
  useAiropsContainers,
  useAiropsVessels,
  useUpdateJob,
  useUpdateContainer,
  useUpdateVessel,
  useCreateJob,
  useCreateContainer,
  useCreateVessel,
} from "@/lib/queries/airops";
import type { AiropsJob, AiropsContainer, AiropsVessel } from "@/lib/types/airops";

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_W = 220;
const JOB_H = 90;
const CTR_H = 100;
const VSL_H = 110;

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2.5;

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeKind = "job" | "container" | "vessel";

interface DragState {
  nodeId: string;
  kind: NodeKind;
  startCanvasX: number;
  startCanvasY: number;
  startPointerX: number;
  startPointerY: number;
  moved: boolean;
}

interface CtxMenu {
  x: number;
  y: number;
  nodeId: string;
  kind: NodeKind;
}

interface CreateModal {
  kind: "job" | "container" | "vessel" | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
  } catch {
    return iso;
  }
}

// ─── SVG grip icon (6 dots) ───────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      {[0, 4, 8].map((cx) =>
        [2, 6, 10].map((cy) => (
          <circle key={`${cx}-${cy}`} cx={cy} cy={cx + 2} r="1.2" fill="currentColor" />
        ))
      )}
    </svg>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({
  kind,
  onClose,
  onCreate,
}: {
  kind: "job" | "container" | "vessel";
  onClose: () => void;
  onCreate: (values: Record<string, string>) => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>({});

  const fields: { key: string; label: string; placeholder?: string; type?: string }[] =
    kind === "job"
      ? [{ key: "order_no", label: "Order No", placeholder: "e.g. ORD-0042" }]
      : kind === "container"
      ? [
          { key: "container_number", label: "Container No", placeholder: "e.g. MSCU1234567" },
          { key: "container_type", label: "Type", placeholder: "e.g. 20GP" },
        ]
      : [
          { key: "name", label: "Vessel Name", placeholder: "e.g. MSC OSCAR" },
          { key: "etd", label: "ETD", type: "date" },
        ];

  const titles = { job: "New Job", container: "New Container", vessel: "New Vessel" };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onCreate(vals);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onPointerDown={onClose}
    >
      <div
        className="w-72 rounded-xl p-5 shadow-xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>
            {titles[kind]}
          </h3>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded"
            style={{ color: "var(--text-3)" }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {fields.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--text-2)" }}>
                {f.label}
              </label>
              <input
                type={f.type ?? "text"}
                placeholder={f.placeholder}
                value={vals[f.key] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm rounded-lg outline-none"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
                autoFocus={f.key === fields[0].key}
              />
            </div>
          ))}
          <button
            type="submit"
            className="mt-1 w-full py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "#6366f1" }}
          >
            Create
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Node components ──────────────────────────────────────────────────────────

function JobNode({
  job,
  containers,
  isDropTarget,
  onGripPointerDown,
  onContextMenu,
}: {
  job: AiropsJob;
  containers: AiropsContainer[];
  isDropTarget: boolean;
  onGripPointerDown: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const assignedCtr = containers.find((c) => c.id === job.container_id);

  return (
    <div
      className="absolute select-none"
      style={{
        width: NODE_W,
        height: JOB_H,
        left: job.canvas_x,
        top: job.canvas_y,
        background: "var(--surface)",
        border: isDropTarget ? "2px solid #3b82f6" : "1.5px solid #c7d2fe",
        borderRadius: "var(--radius-md)",
        boxShadow: isDropTarget ? "0 0 0 3px #bfdbfe" : "0 2px 8px rgba(0,0,0,0.07)",
        overflow: "hidden",
        cursor: "default",
        transition: "box-shadow 0.1s, border-color 0.1s",
      }}
      onContextMenu={onContextMenu}
    >
      {/* Indigo accent top bar */}
      <div style={{ height: 3, background: "#6366f1" }} />

      <div className="px-3 py-2 h-full flex flex-col justify-between" style={{ height: JOB_H - 3 }}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span
              className="font-semibold truncate"
              style={{ fontSize: 13, color: "var(--text)", lineHeight: "1.3" }}
            >
              {job.data.order_no ?? "(no order no)"}
            </span>
            {job.data.consignee_name && (
              <span
                className="truncate"
                style={{ fontSize: 11, color: "var(--text-2)", lineHeight: "1.3" }}
              >
                {job.data.consignee_name}
              </span>
            )}
          </div>
          <div
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded cursor-grab active:cursor-grabbing"
            style={{ color: "var(--text-3)" }}
            onPointerDown={onGripPointerDown}
          >
            <GripIcon />
          </div>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {job.data.quantity_pcs != null && (
            <span
              className="px-1.5 py-0.5 rounded text-xs font-medium"
              style={{ background: "#fef3c7", color: "#92400e" }}
            >
              {job.data.quantity_pcs} pcs
            </span>
          )}
          {assignedCtr ? (
            <span
              className="px-1.5 py-0.5 rounded text-xs font-medium truncate max-w-[100px]"
              style={{ background: "#dbeafe", color: "#1d4ed8" }}
            >
              {assignedCtr.container_number ?? "CTR"}
            </span>
          ) : (
            <span
              className="px-1.5 py-0.5 rounded text-xs"
              style={{ background: "var(--surface-2)", color: "var(--text-3)" }}
            >
              Unassigned
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ContainerNode({
  ctr,
  isDropTarget,
  isVesselDropTarget,
  jobCount,
  onGripPointerDown,
  onContextMenu,
}: {
  ctr: AiropsContainer;
  isDropTarget: boolean;
  isVesselDropTarget: boolean;
  jobCount: number;
  onGripPointerDown: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className="absolute select-none"
      style={{
        width: NODE_W,
        height: isDropTarget ? CTR_H + 4 : CTR_H,
        left: ctr.canvas_x,
        top: ctr.canvas_y,
        background: isDropTarget ? "#f0fdf4" : "#eff6ff",
        border: isDropTarget
          ? "2px solid #22c55e"
          : "1.5px solid #93c5fd",
        borderRadius: "var(--radius-md)",
        boxShadow: isDropTarget
          ? "0 0 0 6px #86efac"
          : "0 2px 8px rgba(0,0,0,0.07)",
        overflow: "visible",
        cursor: "default",
        transition: "box-shadow 0.12s, border-color 0.12s, background 0.12s",
        transform: isDropTarget ? "scale(1.04)" : "scale(1)",
      }}
      onContextMenu={onContextMenu}
    >
      {/* Blue accent bar */}
      <div style={{ height: 3, background: isDropTarget ? "#22c55e" : "#3b82f6" }} />

      {/* Drop hint overlay */}
      {isDropTarget && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 10, top: 3 }}
        >
          <span
            className="px-2 py-1 rounded-md text-xs font-semibold"
            style={{ background: "#22c55e", color: "white", letterSpacing: "0.01em" }}
          >
            Drop to assign
          </span>
        </div>
      )}

      <div className="px-3 py-2 h-full flex flex-col justify-between" style={{ height: CTR_H - 3 }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span
              className="font-semibold truncate"
              style={{ fontSize: 13, color: "#1e40af", lineHeight: "1.3" }}
            >
              {ctr.container_number ?? "(no number)"}
            </span>
            {ctr.container_type && (
              <span
                className="px-1.5 py-0 rounded-sm text-xs inline-block self-start"
                style={{ background: "#dbeafe", color: "#1d4ed8", fontSize: 10, lineHeight: "1.6" }}
              >
                {ctr.container_type}
              </span>
            )}
          </div>
          <div
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded cursor-grab active:cursor-grabbing"
            style={{ color: "#93c5fd" }}
            onPointerDown={onGripPointerDown}
          >
            <GripIcon />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span style={{ fontSize: 11, color: "#60a5fa" }}>
            {jobCount} {jobCount === 1 ? "job" : "jobs"}
          </span>
          {!ctr.vessel_id && (
            <span
              className="px-1.5 py-0.5 rounded text-xs"
              style={{ background: "#dbeafe", color: "#3b82f6" }}
            >
              No vessel
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function VesselNode({
  vessel,
  isDropTarget,
  containerCount,
  onGripPointerDown,
  onContextMenu,
}: {
  vessel: AiropsVessel;
  isDropTarget: boolean;
  containerCount: number;
  onGripPointerDown: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className="absolute select-none"
      style={{
        width: NODE_W,
        height: VSL_H,
        left: vessel.canvas_x,
        top: vessel.canvas_y,
        background: isDropTarget ? "#fef9c3" : "#f5f3ff",
        border: isDropTarget ? "2px solid #eab308" : "1.5px solid #c4b5fd",
        borderRadius: "var(--radius-md)",
        boxShadow: isDropTarget ? "0 0 0 6px #fde68a" : "0 2px 8px rgba(0,0,0,0.07)",
        overflow: "visible",
        cursor: "default",
        transition: "box-shadow 0.12s, border-color 0.12s, background 0.12s",
        transform: isDropTarget ? "scale(1.04)" : "scale(1)",
      }}
      onContextMenu={onContextMenu}
    >
      {/* Purple accent bar */}
      <div style={{ height: 3, background: isDropTarget ? "#eab308" : "#8b5cf6" }} />

      {/* Drop hint overlay */}
      {isDropTarget && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 10, top: 3 }}
        >
          <span
            className="px-2 py-1 rounded-md text-xs font-semibold"
            style={{ background: "#eab308", color: "white", letterSpacing: "0.01em" }}
          >
            Drop to assign
          </span>
        </div>
      )}

      <div className="px-3 py-2 h-full flex flex-col justify-between" style={{ height: VSL_H - 3 }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span
              className="font-semibold truncate"
              style={{ fontSize: 13, color: "#4c1d95", lineHeight: "1.3" }}
            >
              {vessel.name}
            </span>
            <span style={{ fontSize: 11, color: "#7c3aed" }}>
              ETD {fmtDate(vessel.etd)}
            </span>
          </div>
          <div
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded cursor-grab active:cursor-grabbing"
            style={{ color: "#c4b5fd" }}
            onPointerDown={onGripPointerDown}
          >
            <GripIcon />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span style={{ fontSize: 11, color: "#a78bfa" }}>
            {containerCount} {containerCount === 1 ? "container" : "containers"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AiropsCanvas() {
  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: jobs = [] } = useAiropsJobs();
  const { data: containers = [] } = useAiropsContainers();
  const { data: vessels = [] } = useAiropsVessels();

  const updateJob = useUpdateJob();
  const updateContainer = useUpdateContainer();
  const updateVessel = useUpdateVessel();
  const createJob = useCreateJob();
  const createContainer = useCreateContainer();
  const createVessel = useCreateVessel();

  // ── Canvas state ──────────────────────────────────────────────────────────────
  const stageRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 60, y: 60 });
  const [zoom, setZoom] = useState(1);

  // ── Drag state (refs to avoid re-renders) ─────────────────────────────────────
  const dragRef = useRef<DragState | null>(null);
  // Optimistic positions: nodeId → {x, y}
  const [optPos, setOptPos] = useState<Record<string, { x: number; y: number }>>({});

  // ── Drop target state ─────────────────────────────────────────────────────────
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // ── Pan state ─────────────────────────────────────────────────────────────────
  const panRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

  // ── Context menu ──────────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  // ── Create modal ──────────────────────────────────────────────────────────────
  const [createModal, setCreateModal] = useState<CreateModal>({ kind: null });

  // ── Right rail ────────────────────────────────────────────────────────────────
  const [railOpen, setRailOpen] = useState(true);

  // ── Unassigned filter ─────────────────────────────────────────────────────────
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  // ── Assignment toast ──────────────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  // ─── Coordinate helpers ───────────────────────────────────────────────────────

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = stageRef.current!.getBoundingClientRect();
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // ─── Get current position of a node (optimistic or real) ──────────────────────

  function nodePos(id: string, fallback: { canvas_x: number; canvas_y: number }) {
    return optPos[id] ?? { x: fallback.canvas_x, y: fallback.canvas_y };
  }

  // ─── Hit test: is canvas point inside a container/vessel node ─────────────────

  function hitContainer(cx: number, cy: number): AiropsContainer | null {
    for (const ctr of containers) {
      const pos = nodePos(ctr.id, ctr);
      if (cx >= pos.x && cx <= pos.x + NODE_W && cy >= pos.y && cy <= pos.y + CTR_H) {
        return ctr;
      }
    }
    return null;
  }

  function hitVessel(cx: number, cy: number): AiropsVessel | null {
    for (const vsl of vessels) {
      const pos = nodePos(vsl.id, vsl);
      if (cx >= pos.x && cx <= pos.x + NODE_W && cy >= pos.y && cy <= pos.y + VSL_H) {
        return vsl;
      }
    }
    return null;
  }

  // ─── Zoom (centered on point) ─────────────────────────────────────────────────

  function setZoomAt(newZoom: number, pivotX: number, pivotY: number) {
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
    setPan((prev) => ({
      x: pivotX - ((pivotX - prev.x) / zoom) * clamped,
      y: pivotY - ((pivotY - prev.y) / zoom) * clamped,
    }));
    setZoom(clamped);
  }

  function setZoomCentered(newZoom: number) {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    setZoomAt(newZoom, rect.width / 2, rect.height / 2);
  }

  function fitToScreen() {
    if (!stageRef.current) return;
    const allNodes = [
      ...jobs.map((j) => ({ x: nodePos(j.id, j).x, y: nodePos(j.id, j).y, w: NODE_W, h: JOB_H })),
      ...containers.map((c) => ({ x: nodePos(c.id, c).x, y: nodePos(c.id, c).y, w: NODE_W, h: CTR_H })),
      ...vessels.map((v) => ({ x: nodePos(v.id, v).x, y: nodePos(v.id, v).y, w: NODE_W, h: VSL_H })),
    ];
    if (!allNodes.length) return;
    const minX = Math.min(...allNodes.map((n) => n.x));
    const minY = Math.min(...allNodes.map((n) => n.y));
    const maxX = Math.max(...allNodes.map((n) => n.x + n.w));
    const maxY = Math.max(...allNodes.map((n) => n.y + n.h));
    const rect = stageRef.current.getBoundingClientRect();
    const pad = 60;
    const scaleX = (rect.width - pad * 2) / (maxX - minX || 1);
    const scaleY = (rect.height - pad * 2) / (maxY - minY || 1);
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(scaleX, scaleY)));
    setPan({
      x: pad - minX * newZoom,
      y: pad - minY * newZoom,
    });
    setZoom(newZoom);
  }

  // ─── Canvas wheel handler ─────────────────────────────────────────────────────

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = stageRef.current!.getBoundingClientRect();
    const pivotX = e.clientX - rect.left;
    const pivotY = e.clientY - rect.top;
    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY * 0.002;
      setZoomAt(zoom * (1 + delta), pivotX, pivotY);
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }

  // ─── Canvas pan ───────────────────────────────────────────────────────────────

  function handleStagePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    // Only pan on the stage itself (not nodes)
    if (e.target !== stageRef.current && (e.target as HTMLElement).dataset.stage !== "true") return;
    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
    stageRef.current!.setPointerCapture(e.pointerId);
  }

  function handleStagePointerMove(e: React.PointerEvent) {
    // Handle pan
    if (panRef.current) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setPan({ x: panRef.current.startPanX + dx, y: panRef.current.startPanY + dy });
    }

    // Handle node drag
    if (dragRef.current) {
      const { nodeId, kind, startCanvasX, startCanvasY, startPointerX, startPointerY } = dragRef.current;
      const dx = (e.clientX - startPointerX) / zoom;
      const dy = (e.clientY - startPointerY) / zoom;
      const newX = startCanvasX + dx;
      const newY = startCanvasY + dy;
      dragRef.current.moved = true;

      setOptPos((prev) => ({ ...prev, [nodeId]: { x: newX, y: newY } }));

      // Compute drop targets
      const cx = newX + NODE_W / 2;
      const cy = newY;

      if (kind === "job") {
        const ctr = hitContainer(cx, cy + JOB_H / 2);
        setDropTargetId(ctr ? ctr.id : null);
      } else if (kind === "container") {
        const vsl = hitVessel(cx, cy + CTR_H / 2);
        setDropTargetId(vsl ? vsl.id : null);
      } else {
        setDropTargetId(null);
      }
    }
  }

  function handleStagePointerUp(e: React.PointerEvent) {
    panRef.current = null;

    if (dragRef.current) {
      const { nodeId, kind, moved } = dragRef.current;
      const pos = optPos[nodeId];

      if (moved && pos) {
        const snapped = { x: Math.round(pos.x), y: Math.round(pos.y) };

        if (kind === "job") {
          const job = jobs.find((j) => j.id === nodeId);
          if (job) {
            const cx = snapped.x + NODE_W / 2;
            const cy = snapped.y + JOB_H / 2;
            const hitCtr = hitContainer(cx, cy);
            if (hitCtr && hitCtr.id !== job.container_id) {
              updateJob.mutate(
                { id: nodeId, updates: { container_id: hitCtr.id, canvas_x: snapped.x, canvas_y: snapped.y } },
                { onSuccess: () => showToast(`Assigned to ${hitCtr.container_number ?? "container"}`) }
              );
            } else {
              updateJob.mutate({ id: nodeId, updates: { canvas_x: snapped.x, canvas_y: snapped.y } });
            }
          }
        } else if (kind === "container") {
          const ctr = containers.find((c) => c.id === nodeId);
          if (ctr) {
            const cx = snapped.x + NODE_W / 2;
            const cy = snapped.y + CTR_H / 2;
            const hitVsl = hitVessel(cx, cy);
            if (hitVsl && hitVsl.id !== ctr.vessel_id) {
              updateContainer.mutate(
                { id: nodeId, updates: { vessel_id: hitVsl.id, canvas_x: snapped.x, canvas_y: snapped.y } },
                { onSuccess: () => showToast(`Container assigned to ${hitVsl.name}`) }
              );
            } else {
              updateContainer.mutate({ id: nodeId, updates: { canvas_x: snapped.x, canvas_y: snapped.y } });
            }
          }
        } else if (kind === "vessel") {
          updateVessel.mutate({ id: nodeId, updates: { canvas_x: snapped.x, canvas_y: snapped.y } });
        }
      }

      dragRef.current = null;
      setDropTargetId(null);
    }
  }

  // ─── Node drag start ──────────────────────────────────────────────────────────

  function startNodeDrag(e: React.PointerEvent, nodeId: string, kind: NodeKind) {
    e.stopPropagation();
    e.preventDefault();
    const fallback =
      kind === "job"
        ? jobs.find((j) => j.id === nodeId)!
        : kind === "container"
        ? containers.find((c) => c.id === nodeId)!
        : vessels.find((v) => v.id === nodeId)!;

    const pos = nodePos(nodeId, fallback);
    dragRef.current = {
      nodeId,
      kind,
      startCanvasX: pos.x,
      startCanvasY: pos.y,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  // ─── Context menu ─────────────────────────────────────────────────────────────

  function handleContextMenu(e: React.MouseEvent, nodeId: string, kind: NodeKind) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, nodeId, kind });
  }

  function dismissCtxMenu() {
    setCtxMenu(null);
  }

  function handleCtxAction(action: string) {
    if (!ctxMenu) return;
    const { nodeId, kind } = ctxMenu;
    if (action === "removeContainer" && kind === "job") {
      updateJob.mutate({ id: nodeId, updates: { container_id: null } });
    } else if (action === "removeVessel" && kind === "container") {
      updateContainer.mutate({ id: nodeId, updates: { vessel_id: null } });
    }
    dismissCtxMenu();
  }

  // ─── Create handlers ──────────────────────────────────────────────────────────

  function handleCreate(kind: "job" | "container" | "vessel", vals: Record<string, string>) {
    // Place new nodes at a random position on visible canvas
    const cx = (-pan.x + 120) / zoom;
    const cy = (-pan.y + 120) / zoom;
    const randOffset = () => Math.random() * 200 - 100;

    if (kind === "job") {
      createJob.mutate({
        data: { order_no: vals.order_no },
      });
    } else if (kind === "container") {
      createContainer.mutate({
        container_number: vals.container_number || null,
        container_type: vals.container_type || null,
        canvas_x: cx + randOffset(),
        canvas_y: cy + randOffset(),
      } as Parameters<typeof createContainer.mutate>[0]);
    } else {
      createVessel.mutate({
        name: vals.name,
        etd: vals.etd || null,
        canvas_x: cx + randOffset(),
        canvas_y: cy + randOffset(),
      } as Parameters<typeof createVessel.mutate>[0]);
    }
  }

  // ─── Global click to dismiss context menu ─────────────────────────────────────
  useEffect(() => {
    if (!ctxMenu) return;
    function handler() { setCtxMenu(null); }
    window.addEventListener("pointerdown", handler);
    return () => window.removeEventListener("pointerdown", handler);
  }, [ctxMenu]);

  // ─── Keyboard shortcut: Escape ────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setCtxMenu(null);
        setCreateModal({ kind: null });
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ─── Derived data ─────────────────────────────────────────────────────────────

  const visibleJobs = unassignedOnly ? jobs.filter((j) => !j.container_id) : jobs;
  const visibleContainers = unassignedOnly ? containers.filter((c) => !c.vessel_id) : containers;
  const visibleVessels = vessels;

  const unassignedJobs = jobs.filter((j) => !j.container_id);
  const unassignedCtrs = containers.filter((c) => !c.vessel_id);

  const totalAssigned = jobs.filter((j) => j.container_id).length;
  const completionPct = jobs.length > 0 ? Math.round((totalAssigned / jobs.length) * 100) : 0;

  // ─── Edge calculations ────────────────────────────────────────────────────────

  function jobEdges() {
    const lines: { key: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const job of visibleJobs) {
      if (!job.container_id) continue;
      const ctr = containers.find((c) => c.id === job.container_id);
      if (!ctr) continue;
      const jp = nodePos(job.id, job);
      const cp = nodePos(ctr.id, ctr);
      lines.push({
        key: `j-${job.id}`,
        x1: jp.x + NODE_W / 2,
        y1: jp.y + JOB_H,
        x2: cp.x + NODE_W / 2,
        y2: cp.y,
      });
    }
    return lines;
  }

  function containerEdges() {
    const lines: { key: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const ctr of visibleContainers) {
      if (!ctr.vessel_id) continue;
      const vsl = vessels.find((v) => v.id === ctr.vessel_id);
      if (!vsl) continue;
      const cp = nodePos(ctr.id, ctr);
      const vp = nodePos(vsl.id, vsl);
      lines.push({
        key: `c-${ctr.id}`,
        x1: cp.x + NODE_W / 2,
        y1: cp.y + CTR_H,
        x2: vp.x + NODE_W / 2,
        y2: vp.y,
      });
    }
    return lines;
  }

  const jEdges = jobEdges();
  const cEdges = containerEdges();

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
      {/* ── Top toolbar ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-2 shrink-0 z-10"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Title */}
        <div className="flex flex-col mr-3">
          <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
            AirOps Canvas
          </span>
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            Job → Container → Vessel planning
          </span>
        </div>

        <div style={{ width: 1, height: 28, background: "var(--border)" }} />

        {/* Create buttons */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            background: "#eef2ff",
            color: "#4f46e5",
            border: "1px solid #c7d2fe",
          }}
          onClick={() => setCreateModal({ kind: "job" })}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 1v10M1 6h10" />
          </svg>
          Job
        </button>

        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            background: "#eff6ff",
            color: "#1d4ed8",
            border: "1px solid #93c5fd",
          }}
          onClick={() => setCreateModal({ kind: "container" })}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 1v10M1 6h10" />
          </svg>
          Container
        </button>

        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            background: "#f5f3ff",
            color: "#6d28d9",
            border: "1px solid #c4b5fd",
          }}
          onClick={() => setCreateModal({ kind: "vessel" })}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 1v10M1 6h10" />
          </svg>
          Vessel
        </button>

        <div style={{ width: 1, height: 28, background: "var(--border)" }} />

        {/* Unassigned only toggle */}
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            background: unassignedOnly ? "#fef3c7" : "var(--surface-2)",
            color: unassignedOnly ? "#92400e" : "var(--text-2)",
            border: `1px solid ${unassignedOnly ? "#fcd34d" : "var(--border)"}`,
          }}
          onClick={() => setUnassignedOnly((v) => !v)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="6" cy="6" r="5" />
            <path d="M4 6l1.5 1.5L8 4" />
          </svg>
          Unassigned only
        </button>

        <div className="flex-1" />

        {/* Rail toggle */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            background: railOpen ? "#f0fdf4" : "var(--surface-2)",
            color: railOpen ? "#166534" : "var(--text-2)",
            border: `1px solid ${railOpen ? "#86efac" : "var(--border)"}`,
          }}
          onClick={() => setRailOpen((v) => !v)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <rect x="1" y="1" width="10" height="10" rx="1.5" />
            <path d="M8 1v10" />
          </svg>
          {railOpen ? "Hide panel" : "Show panel"}
        </button>
      </div>

      {/* ── Main area ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Canvas ───────────────────────────────────────────────────────────────── */}
        <div
          ref={stageRef}
          className="relative flex-1 overflow-hidden"
          data-stage="true"
          style={{
            cursor: panRef.current ? "grabbing" : "default",
            backgroundImage: `radial-gradient(circle, #d9d9d6 1px, transparent 1.5px)`,
            backgroundSize: `${22 * zoom}px ${22 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
          onWheel={handleWheel}
        >
          {/* ── Transform root ───────────────────────────────────────────────────── */}
          <div
            style={{
              position: "absolute",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              width: 0,
              height: 0,
            }}
          >
            {/* ── SVG edges layer ──────────────────────────────────────────────── */}
            <svg
              style={{ position: "absolute", overflow: "visible", pointerEvents: "none", zIndex: 0 }}
              width={0}
              height={0}
            >
              {/* Job → Container: dashed blue */}
              {jEdges.map((e) => (
                <g key={e.key}>
                  <line
                    x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    strokeDasharray="5,4"
                    opacity={0.7}
                  />
                  <circle cx={e.x1} cy={e.y1} r={3} fill="#3b82f6" opacity={0.85} />
                  <circle cx={e.x2} cy={e.y2} r={3} fill="#3b82f6" opacity={0.85} />
                </g>
              ))}
              {/* Container → Vessel: solid purple */}
              {cEdges.map((e) => (
                <g key={e.key}>
                  <line
                    x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    opacity={0.7}
                  />
                  <circle cx={e.x1} cy={e.y1} r={3.5} fill="#8b5cf6" opacity={0.9} />
                  <circle cx={e.x2} cy={e.y2} r={3.5} fill="#8b5cf6" opacity={0.9} />
                </g>
              ))}
            </svg>

            {/* ── Vessel nodes ─────────────────────────────────────────────────── */}
            {visibleVessels.map((vessel) => {
              const pos = nodePos(vessel.id, vessel);
              const ctrCount = containers.filter((c) => c.vessel_id === vessel.id).length;
              return (
                <div
                  key={vessel.id}
                  style={{ position: "absolute", left: pos.x, top: pos.y, zIndex: 1 }}
                >
                  <VesselNode
                    vessel={{ ...vessel, canvas_x: pos.x, canvas_y: pos.y }}
                    isDropTarget={dropTargetId === vessel.id}
                    containerCount={ctrCount}
                    onGripPointerDown={(e) => startNodeDrag(e, vessel.id, "vessel")}
                    onContextMenu={(e) => handleContextMenu(e, vessel.id, "vessel")}
                  />
                </div>
              );
            })}

            {/* ── Container nodes ──────────────────────────────────────────────── */}
            {visibleContainers.map((ctr) => {
              const pos = nodePos(ctr.id, ctr);
              const jobCount = jobs.filter((j) => j.container_id === ctr.id).length;
              const isJobDropTarget = dropTargetId === ctr.id && dragRef.current?.kind === "job";
              const isVslDropTarget = dropTargetId === ctr.id && dragRef.current?.kind === "container";
              return (
                <div
                  key={ctr.id}
                  style={{ position: "absolute", left: pos.x, top: pos.y, zIndex: 2 }}
                >
                  <ContainerNode
                    ctr={{ ...ctr, canvas_x: pos.x, canvas_y: pos.y }}
                    isDropTarget={isJobDropTarget}
                    isVesselDropTarget={isVslDropTarget}
                    jobCount={jobCount}
                    onGripPointerDown={(e) => startNodeDrag(e, ctr.id, "container")}
                    onContextMenu={(e) => handleContextMenu(e, ctr.id, "container")}
                  />
                </div>
              );
            })}

            {/* ── Job nodes ────────────────────────────────────────────────────── */}
            {visibleJobs.map((job) => {
              const pos = nodePos(job.id, job);
              return (
                <div
                  key={job.id}
                  style={{ position: "absolute", left: pos.x, top: pos.y, zIndex: 3 }}
                >
                  <JobNode
                    job={{ ...job, canvas_x: pos.x, canvas_y: pos.y }}
                    containers={containers}
                    isDropTarget={false}
                    onGripPointerDown={(e) => startNodeDrag(e, job.id, "job")}
                    onContextMenu={(e) => handleContextMenu(e, job.id, "job")}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right rail ───────────────────────────────────────────────────────────── */}
        {railOpen && (
          <div
            className="flex flex-col shrink-0 overflow-hidden"
            style={{
              width: 280,
              background: "var(--surface)",
              borderLeft: "1px solid var(--border)",
            }}
          >
            {/* Rail header */}
            <div
              className="px-4 py-3 shrink-0"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <span className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                OVERVIEW
              </span>
            </div>

            <div className="flex flex-col gap-0 overflow-y-auto flex-1">
              {/* Stats */}
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Jobs", value: jobs.length, color: "#6366f1" },
                    { label: "Containers", value: containers.length, color: "#3b82f6" },
                    { label: "Vessels", value: vessels.length, color: "#8b5cf6" },
                    { label: "Assigned", value: `${completionPct}%`, color: "#10b981" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="flex flex-col px-3 py-2 rounded-lg"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <span className="text-xs" style={{ color: "var(--text-3)" }}>
                        {s.label}
                      </span>
                      <span className="font-bold text-base" style={{ color: s.color }}>
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Completion bar */}
                <div className="mt-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs" style={{ color: "var(--text-3)" }}>
                      Assignment completion
                    </span>
                    <span className="text-xs font-medium" style={{ color: "#10b981" }}>
                      {completionPct}%
                    </span>
                  </div>
                  <div
                    className="w-full rounded-full overflow-hidden"
                    style={{ height: 5, background: "var(--border)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${completionPct}%`, background: "#10b981" }}
                    />
                  </div>
                </div>
              </div>

              {/* Unassigned Jobs */}
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                    Unassigned Jobs
                  </span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: "#fef3c7", color: "#92400e" }}
                  >
                    {unassignedJobs.length}
                  </span>
                </div>
                {unassignedJobs.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>
                    All jobs assigned.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {unassignedJobs.slice(0, 12).map((job) => (
                      <div
                        key={job.id}
                        className="flex flex-col px-2.5 py-2 rounded-lg"
                        style={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <span className="text-xs font-medium truncate" style={{ color: "var(--text)" }}>
                          {job.data.order_no ?? "(no order no)"}
                        </span>
                        {job.data.consignee_name && (
                          <span className="text-xs truncate" style={{ color: "var(--text-3)" }}>
                            {job.data.consignee_name}
                          </span>
                        )}
                      </div>
                    ))}
                    {unassignedJobs.length > 12 && (
                      <p className="text-xs" style={{ color: "var(--text-3)" }}>
                        +{unassignedJobs.length - 12} more
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Unassigned Containers */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                    Unassigned Containers
                  </span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: "#dbeafe", color: "#1d4ed8" }}
                  >
                    {unassignedCtrs.length}
                  </span>
                </div>
                {unassignedCtrs.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>
                    All containers assigned.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {unassignedCtrs.slice(0, 10).map((ctr) => (
                      <div
                        key={ctr.id}
                        className="flex flex-col px-2.5 py-2 rounded-lg"
                        style={{
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                        }}
                      >
                        <span className="text-xs font-medium truncate" style={{ color: "#1e40af" }}>
                          {ctr.container_number ?? "(no number)"}
                        </span>
                        {ctr.container_type && (
                          <span className="text-xs" style={{ color: "#60a5fa" }}>
                            {ctr.container_type}
                          </span>
                        )}
                      </div>
                    ))}
                    {unassignedCtrs.length > 10 && (
                      <p className="text-xs" style={{ color: "var(--text-3)" }}>
                        +{unassignedCtrs.length - 10} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom toolbar (zoom controls) ─────────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-2 py-2 shrink-0"
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
        }}
      >
        {/* Zoom out */}
        <button
          className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-medium transition-colors"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-2)",
            border: "1px solid var(--border)",
          }}
          onClick={() => setZoomCentered(Math.max(ZOOM_MIN, zoom - 0.1))}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 6h10" />
          </svg>
        </button>

        {/* Zoom percentage */}
        <span
          className="text-xs font-medium tabular-nums select-none"
          style={{ color: "var(--text-2)", minWidth: 38, textAlign: "center" }}
        >
          {Math.round(zoom * 100)}%
        </span>

        {/* Zoom in */}
        <button
          className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-medium transition-colors"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-2)",
            border: "1px solid var(--border)",
          }}
          onClick={() => setZoomCentered(Math.min(ZOOM_MAX, zoom + 0.1))}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 1v10M1 6h10" />
          </svg>
        </button>

        <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 4px" }} />

        {/* Fit to screen */}
        <button
          className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-2)",
            border: "1px solid var(--border)",
          }}
          onClick={fitToScreen}
          title="Fit all nodes to screen"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" />
          </svg>
          Fit
        </button>
      </div>

      {/* ── Context menu ─────────────────────────────────────────────────────────── */}
      {ctxMenu && (
        <div
          className="fixed z-50 rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{
            left: ctxMenu.x,
            top: ctxMenu.y,
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {ctxMenu.kind === "job" && (
            <>
              {jobs.find((j) => j.id === ctxMenu.nodeId)?.container_id ? (
                <button
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 transition-colors"
                  style={{ color: "#b91c1c" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  onClick={() => handleCtxAction("removeContainer")}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M1 1l10 10M11 1L1 11" />
                  </svg>
                  Remove from container
                </button>
              ) : (
                <div className="px-3 py-1.5 text-xs" style={{ color: "var(--text-3)" }}>
                  Not in a container
                </div>
              )}
            </>
          )}
          {ctxMenu.kind === "container" && (
            <>
              {containers.find((c) => c.id === ctxMenu.nodeId)?.vessel_id ? (
                <button
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 transition-colors"
                  style={{ color: "#b91c1c" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  onClick={() => handleCtxAction("removeVessel")}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M1 1l10 10M11 1L1 11" />
                  </svg>
                  Remove from vessel
                </button>
              ) : (
                <div className="px-3 py-1.5 text-xs" style={{ color: "var(--text-3)" }}>
                  Not assigned to a vessel
                </div>
              )}
            </>
          )}
          {ctxMenu.kind === "vessel" && (
            <div className="px-3 py-1.5 text-xs" style={{ color: "var(--text-3)" }}>
              No actions available
            </div>
          )}
          <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          <button
            className="w-full px-3 py-1.5 text-left text-xs transition-colors"
            style={{ color: "var(--text-2)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            onClick={dismissCtxMenu}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Create modal ─────────────────────────────────────────────────────────── */}
      {createModal.kind && (
        <CreateModal
          kind={createModal.kind}
          onClose={() => setCreateModal({ kind: null })}
          onCreate={(vals) => handleCreate(createModal.kind!, vals)}
        />
      )}

      {/* ── Assignment toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg z-50"
          style={{
            background: "#1e293b",
            color: "white",
            fontSize: 13,
            fontWeight: 500,
            pointerEvents: "none",
          }}
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

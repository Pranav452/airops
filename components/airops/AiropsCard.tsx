"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { AiropsJob, AiropsJobData } from "@/lib/types/airops";

// ─── Cutoff helpers ───────────────────────────────────────────────────────────

const CUTOFF_LABELS: { key: "port_cutoff" | "si_cutoff" | "docs_cutoff" | "vgm_cutoff" | "cargo_handover_cutoff"; abbr: string }[] = [
  { key: "port_cutoff",             abbr: "Port" },
  { key: "si_cutoff",               abbr: "SI" },
  { key: "docs_cutoff",             abbr: "Docs" },
  { key: "vgm_cutoff",              abbr: "VGM" },
  { key: "cargo_handover_cutoff",   abbr: "Cargo" },
];

const H48 = 48 * 60 * 60 * 1000;
const D7  = 7  * 24 * 60 * 60 * 1000;

interface CutoffAlert {
  abbr: string;
  isOverdue: boolean;
}

function getNearestCutoffAlert(job: AiropsJob): CutoffAlert | null {
  const vessel = job.container?.vessel;
  if (!vessel) return null;

  const now = Date.now();
  let nearest: { abbr: string; isOverdue: boolean; delta: number } | null = null;

  for (const { key, abbr } of CUTOFF_LABELS) {
    const raw = vessel[key];
    if (!raw) continue;
    const t = new Date(raw).getTime();
    const delta = t - now; // negative = past
    if (delta > H48) continue; // more than 48h away, skip
    if (delta < -D7) continue; // more than 7 days past, skip
    const isOverdue = delta < 0;
    const absDelta = Math.abs(delta);
    if (!nearest || absDelta < nearest.delta) {
      nearest = { abbr, isOverdue, delta: absDelta };
    }
  }

  if (!nearest) return null;
  return { abbr: nearest.abbr, isOverdue: nearest.isOverdue };
}

interface AiropsCardProps {
  job: AiropsJob;
  isSelected: boolean;
  statusColor: string;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

const MILESTONE_KEYS: { key: keyof AiropsJobData; label: string; color: string }[] = [
  { key: "booking_released",  label: "BR",  color: "#22c55e" },
  { key: "container_lifted",  label: "CL",  color: "#3b82f6" },
  { key: "clearance",         label: "CLR", color: "#0d9488" },
  { key: "gate_in_done",      label: "GI",  color: "#f59e0b" },
  { key: "bl_released",       label: "BL",  color: "#8b5cf6" },
  { key: "billing_done",      label: "BLG", color: "#6366f1" },
];

export function AiropsCard({ job, isSelected, statusColor, onSelect, onDragStart }: AiropsCardProps) {
  const d = job.data;
  const isFcr = (d.container_type ?? "").toUpperCase() === "FCR";
  const hexColor = `#${statusColor.replace(/^#/, "")}`;

  const vesselName = d.vessel_name ?? job.container?.vessel?.name;
  const etd = d.etd ?? d.current_etd ?? job.container?.vessel?.etd;
  const containerNo = job.container?.container_number ?? null;
  const hasContainerNoVessel = !!containerNo && !vesselName;
  const cutoffAlert = getNearestCutoffAlert(job);

  const activeMilestones = MILESTONE_KEYS.filter((m) => !!d[m.key]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      className={cn(
        "mb-1.5 rounded-lg select-none transition-all overflow-hidden group cursor-grab active:cursor-grabbing",
        isSelected
          ? "ring-2 shadow-md"
          : "shadow-sm hover:shadow-md"
      )}
      style={{
        background: "var(--surface)",
        border: isSelected
          ? `2px solid ${hexColor}`
          : isFcr
          ? "1px solid #fcd34d"
          : "1px solid var(--border)",
        boxShadow: isSelected ? `0 0 0 3px ${hexColor}22` : undefined,
      }}
    >
      {/* Top accent bar */}
      <div className="h-0.5" style={{ background: hexColor }} />

      <div className="px-2.5 pt-2 pb-2">
        {/* Job no + drag dots */}
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-[10px] font-mono font-medium tracking-wide px-1.5 py-0.5 rounded"
            style={{ background: `${hexColor}18`, color: hexColor }}
          >
            {d.order_no ?? job.id.slice(0, 8).toUpperCase()}
          </span>
          {isFcr && (
            <span
              className="text-[9px] font-bold px-1 py-0.5 rounded"
              style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" }}
            >
              FCR
            </span>
          )}
          <svg
            width="10" height="14" viewBox="0 0 10 14"
            className="opacity-0 group-hover:opacity-40 transition-opacity ml-auto"
            style={{ color: "var(--text-3)" }}
          >
            <circle cx="3" cy="3" r="1" fill="currentColor" />
            <circle cx="7" cy="3" r="1" fill="currentColor" />
            <circle cx="3" cy="7" r="1" fill="currentColor" />
            <circle cx="7" cy="7" r="1" fill="currentColor" />
            <circle cx="3" cy="11" r="1" fill="currentColor" />
            <circle cx="7" cy="11" r="1" fill="currentColor" />
          </svg>
        </div>

        {/* Consignee name (title) */}
        {d.consignee_name && (
          <p className="text-[12.5px] font-semibold leading-snug line-clamp-1 mb-0.5" style={{ color: "var(--text)" }}>
            {d.consignee_name}
          </p>
        )}

        {/* Shipper name */}
        {d.shipper_name && (
          <p className="text-[11px] leading-snug line-clamp-1 mb-1.5" style={{ color: "var(--text-3)" }}>
            {d.shipper_name}
          </p>
        )}

        {/* Container badge (when assigned but no vessel yet) */}
        {hasContainerNoVessel && (
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              {containerNo}
            </span>
          </div>
        )}

        {/* Vessel + ETD */}
        {(vesselName || etd) && (
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {vesselName && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}
              >
                {vesselName}
              </span>
            )}
            {etd && (
              <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
                ETD {etd}
              </span>
            )}
          </div>
        )}

        {/* Active milestone dots */}
        {activeMilestones.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            {activeMilestones.map((m) => (
              <span
                key={m.key}
                title={m.label}
                className="text-[9px] font-semibold px-1 py-0 rounded"
                style={{ background: `${m.color}20`, color: m.color, border: `1px solid ${m.color}40` }}
              >
                {m.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Cutoff warning strip */}
      {cutoffAlert && (
        <div
          className="flex items-center gap-1 px-2.5 py-1"
          style={{
            background: cutoffAlert.isOverdue ? "#fef2f2" : "#fffbeb",
            borderTop: `1px solid ${cutoffAlert.isOverdue ? "#fecaca" : "#fde68a"}`,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.04em",
              padding: "1px 6px",
              borderRadius: 20,
              background: cutoffAlert.isOverdue ? "#ef4444" : "#f59e0b",
              color: "#fff",
            }}
          >
            {cutoffAlert.isOverdue ? "OVERDUE" : "DUE SOON"}
          </span>
          <span
            style={{
              fontSize: 10,
              color: cutoffAlert.isOverdue ? "#b91c1c" : "#92400e",
              fontWeight: 500,
            }}
          >
            {cutoffAlert.abbr} cutoff
          </span>
        </div>
      )}
    </div>
  );
}

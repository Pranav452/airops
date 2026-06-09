"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  useAiropsStatuses,
  useAiropsJobs,
  useAiropsVessels,
  useUpdateJob,
} from "@/lib/queries/airops";
import { useAiropsStore } from "@/lib/stores/airops-store";
import { AiropsColumn } from "@/components/airops/AiropsColumn";
import { AiropsDetailPanel } from "@/components/airops/AiropsDetailPanel";
import { createClient } from "@/lib/supabase/client";
import type { AiropsFilters, AiropsJob } from "@/lib/types/airops";

type ViewMode = "board" | "sheets";
type SortDir = "asc" | "desc";

type TeamView = "all" | "pol" | "france";

// ─── Sheets columns ───────────────────────────────────────────────────────────
const SHEET_COLS: { key: string; label: string; get: (j: AiropsJob) => string }[] = [
  { key: "order_no",          label: "Order No",      get: (j) => j.data.order_no ?? "—" },
  { key: "status",            label: "Status",        get: (j) => j.status?.name ?? "—" },
  { key: "consignee_name",    label: "Consignee",     get: (j) => j.data.consignee_name ?? "—" },
  { key: "shipper_name",      label: "Shipper",       get: (j) => j.data.shipper_name ?? "—" },
  { key: "job_type",          label: "Job Type",      get: (j) => (j.data.job_type ?? "").toUpperCase() || "—" },
  { key: "vessel",            label: "Vessel",        get: (j) => j.container?.vessel?.name ?? "—" },
  { key: "etd",               label: "ETD",           get: (j) => j.data.etd ?? "—" },
  { key: "eta",               label: "ETA",           get: (j) => j.data.eta ?? "—" },
  { key: "container_numbers", label: "Container No",  get: (j) => (j.data.container_numbers ?? []).join(", ") || "—" },
  { key: "volume",            label: "Vol (CBM)",     get: (j) => j.data.volume != null ? String(j.data.volume) : "—" },
  { key: "gross_weight",      label: "Gross Wt",      get: (j) => j.data.gross_weight != null ? String(j.data.gross_weight) : "—" },
  { key: "console_no",        label: "Console No",    get: (j) => j.console_no ?? "—" },
  { key: "cross_verified",    label: "Verified",      get: (j) => j.cross_verified ? "✓" : "—" },
  { key: "created_at",        label: "Created",       get: (j) => j.created_at?.slice(0, 10) ?? "—" },
];

function SheetsView({ jobs, onSelectJob, selectedId, sortCol, setSortCol, sortDir, setSortDir }: {
  jobs: AiropsJob[];
  onSelectJob: (id: string) => void;
  selectedId: string | null;
  sortCol: string;
  setSortCol: (c: string) => void;
  sortDir: SortDir;
  setSortDir: (d: SortDir) => void;
}) {
  const sorted = useMemo(() => {
    return [...jobs].sort((a, b) => {
      const col = SHEET_COLS.find((c) => c.key === sortCol);
      if (!col) return 0;
      const av = col.get(a);
      const bv = col.get(b);
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [jobs, sortCol, sortDir]);

  function handleSort(key: string) {
    if (sortCol === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortCol(key); setSortDir("asc"); }
  }

  return (
    <div className="flex-1 overflow-auto" style={{ background: "var(--background)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "var(--surface)", position: "sticky", top: 0, zIndex: 10 }}>
            {SHEET_COLS.map((c) => (
              <th
                key={c.key}
                onClick={() => handleSort(c.key)}
                style={{
                  padding: "8px 12px", borderBottom: "1px solid var(--border)",
                  textAlign: "left", whiteSpace: "nowrap", cursor: "pointer",
                  color: sortCol === c.key ? "#6366f1" : "var(--text-2)",
                  fontWeight: 600, fontSize: 11, letterSpacing: "0.03em", textTransform: "uppercase",
                  userSelect: "none",
                }}
              >
                {c.label}
                {sortCol === c.key && (
                  <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((j, i) => {
            const isSelected = j.id === selectedId;
            return (
              <tr
                key={j.id}
                onClick={() => onSelectJob(j.id)}
                style={{
                  background: isSelected ? "#eef2ff" : i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                  cursor: "pointer",
                  borderLeft: isSelected ? "3px solid #6366f1" : "3px solid transparent",
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#f5f3ff"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = i % 2 === 0 ? "var(--surface)" : "var(--surface-2)"; }}
              >
                {SHEET_COLS.map((c) => {
                  const val = c.get(j);
                  if (c.key === "status") {
                    const hex = j.status?.color_hex ?? "a3a3a3";
                    const color = hex.startsWith("#") ? hex : `#${hex}`;
                    return (
                      <td key={c.key} style={{ padding: "6px 12px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: color + "22", color, border: `1px solid ${color}55` }}>
                          {val}
                        </span>
                      </td>
                    );
                  }
                  if (c.key === "cross_verified") {
                    return (
                      <td key={c.key} style={{ padding: "6px 12px", borderBottom: "1px solid var(--border)", textAlign: "center" }}>
                        <span style={{ color: val === "✓" ? "#16a34a" : "var(--text-3)", fontWeight: 700 }}>{val}</span>
                      </td>
                    );
                  }
                  return (
                    <td key={c.key} style={{ padding: "6px 12px", borderBottom: "1px solid var(--border)", color: val === "—" ? "var(--text-3)" : "var(--text)", whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={SHEET_COLS.length} style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                No jobs found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const TEAM_LABELS: Record<TeamView, string> = {
  all: "All columns",
  pol: "POL Team",
  france: "France Team",
};

const TEAM_COLORS: Record<TeamView, { bg: string; color: string; border: string }> = {
  all: { bg: "#f8fafc", color: "var(--text-2)", border: "var(--border)" },
  pol:    { bg: "#eef2ff", color: "#4f46e5", border: "#c7d2fe" },
  france: { bg: "#fdf4ff", color: "#9333ea", border: "#e9d5ff" },
};

export function AiropsBoard() {
  const [search, setSearch] = useState("");
  const [vesselFilter, setVesselFilter] = useState<string | null>(null);
  const [teamView, setTeamView] = useState<TeamView>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [sortCol, setSortCol] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Read team from user metadata on mount — default board to their team
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const t = data.user?.user_metadata?.team;
      if (t === "pol" || t === "france") setTeamView(t);
    });
  }, []);

  const filters: AiropsFilters = {
    search: search || undefined,
    vessel_id: vesselFilter ?? undefined,
  };

  const { data: statuses = [], isLoading: statusLoading } = useAiropsStatuses();
  const { data: jobs = [], isLoading: jobsLoading } = useAiropsJobs(filters);
  const { data: vessels = [] } = useAiropsVessels();
  const updateJob = useUpdateJob();
  const { selectedJobId, isPanelOpen, openPanel, closePanel } = useAiropsStore();

  // Filter statuses by team view
  const visibleStatuses =
    teamView === "pol"
      ? statuses.filter((s) => s.display_order <= 15)
      : teamView === "france"
      ? statuses.filter((s) => s.display_order > 15)
      : statuses;

  function handleDrop(jobId: string, newStatusId: string, newOrder: number) {
    updateJob.mutate({ id: jobId, updates: { status_id: newStatusId, column_order: newOrder } });
  }

  const isLoading = statusLoading || jobsLoading;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Board header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        {/* Title + view toggle */}
        <div className="flex items-center gap-2 mr-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "#6366f1" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="18" rx="1" />
              <rect x="14" y="3" width="7" height="10" rx="1" />
              <rect x="14" y="17" width="7" height="4" rx="1" />
            </svg>
          </div>
          <span className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
            AirOps
          </span>
          {/* Board / Sheets toggle */}
          <div
            className="flex items-center rounded-lg p-0.5 ml-1"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            {(["board", "sheets"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className="flex items-center gap-1.5 px-2.5 h-6 rounded-md text-xs font-medium transition-all"
                style={{
                  background: viewMode === m ? "var(--surface)" : "transparent",
                  color: viewMode === m ? "#6366f1" : "var(--text-3)",
                  boxShadow: viewMode === m ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {m === "board" ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="10" rx="1" /></svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /></svg>
                )}
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 h-8 rounded-lg px-3 min-w-[200px]"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ color: "var(--text-3)", flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs…"
            className="flex-1 bg-transparent text-[13px]"
            style={{ color: "var(--text)", border: "none", outline: "none" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ color: "var(--text-3)" }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m4 4 8 8M12 4l-8 8" /></svg>
            </button>
          )}
        </div>

        {/* Vessel filter chips */}
        {vessels.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setVesselFilter(null)}
              className="px-2.5 h-7 rounded-md text-xs font-medium shrink-0 transition-colors"
              style={{
                background: vesselFilter === null ? "#6366f1" : "var(--surface-2)",
                color: vesselFilter === null ? "white" : "var(--text-2)",
                border: vesselFilter === null ? "none" : "1px solid var(--border)",
              }}
            >
              All vessels
            </button>
            {vessels.map((v) => (
              <button
                key={v.id}
                onClick={() => setVesselFilter(v.id === vesselFilter ? null : v.id)}
                className="px-2.5 h-7 rounded-md text-xs font-medium shrink-0 transition-colors"
                style={{
                  background: vesselFilter === v.id ? "#6366f1" : "var(--surface-2)",
                  color: vesselFilter === v.id ? "white" : "var(--text-2)",
                  border: vesselFilter === v.id ? "none" : "1px solid var(--border)",
                }}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        {/* Team view toggle */}
        <div className="flex items-center rounded-lg overflow-hidden shrink-0" style={{ border: "1px solid var(--border)" }}>
          {(["all", "pol", "france"] as TeamView[]).map((t) => {
            const active = teamView === t;
            const tc = TEAM_COLORS[t];
            return (
              <button
                key={t}
                onClick={() => setTeamView(t)}
                className="px-3 h-7 text-xs font-medium transition-colors"
                style={{
                  background: active ? tc.bg : "var(--surface-2)",
                  color: active ? tc.color : "var(--text-3)",
                  borderRight: t !== "france" ? "1px solid var(--border)" : "none",
                }}
              >
                {TEAM_LABELS[t]}
              </button>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Stats */}
        <span className="text-xs tabular-nums" style={{ color: "var(--text-3)" }}>
          {jobs.length} job{jobs.length !== 1 ? "s" : ""}
        </span>

        {/* Canvas link */}
        <Link
          href="/airops/canvas"
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-2)",
            border: "1px solid var(--border)",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="8" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="12" cy="17" r="2" />
            <path d="M8 8h8M7 10l4 6M17 10l-4 6" />
          </svg>
          Canvas
        </Link>

        {/* New job */}
        <Link
          href="/booking"
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-white"
          style={{ background: "#6366f1" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Job
        </Link>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden relative">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center gap-2.5">
            {[0, 150, 300].map((d) => (
              <div key={d} className="size-2 rounded-full animate-pulse" style={{ background: "var(--border-2)", animationDelay: `${d}ms` }} />
            ))}
          </div>
        ) : viewMode === "board" ? (
          <div className="flex items-stretch overflow-x-auto overflow-y-hidden flex-1">
            {visibleStatuses.map((status, idx) => (
              <AiropsColumn
                key={status.id}
                status={status}
                jobs={jobs.filter(
                  (j) =>
                    j.status_id === status.id ||
                    (idx === 0 && teamView === "all" && (j.status_id === null || j.status_id === undefined))
                )}
                selectedId={selectedJobId}
                onSelectCard={openPanel}
                onDrop={handleDrop}
              />
            ))}
          </div>
        ) : (
          /* ── Sheets view ── */
          <SheetsView jobs={jobs} onSelectJob={openPanel} selectedId={selectedJobId} sortCol={sortCol} setSortCol={setSortCol} sortDir={sortDir} setSortDir={setSortDir} />
        )}

        {/* Detail panel */}
        {isPanelOpen && <AiropsDetailPanel />}
      </div>
    </div>
  );
}
